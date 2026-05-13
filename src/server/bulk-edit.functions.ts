import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type BulkAction =
  | "update" // alterar nome/preço/descrição
  | "activate" // disponibilizar
  | "deactivate" // pausar/indisponibilizar
  | "delete" // excluir produto
  | "adjust_price" // ajuste em massa por % ou valor
  | "set_price"; // definir preço fixo (ex: "todos a R$ 29,90")

export interface ParsedEdit {
  product_name: string;
  action?: BulkAction;
  new_price?: number | null;
  new_description?: string | null;
  new_name?: string | null;
  category_name?: string | null;
  // For adjust_price: percentage (10 = +10%, -15 = -15%) OR fixed delta in BRL
  adjust_percent?: number | null;
  adjust_amount?: number | null;
  // When user wants to apply to ALL products in scope (e.g. "aumente todos os preços em 10%")
  apply_to_all?: boolean;
  // Per-size prices for pizza/portion categories (Inteira/Meia, Grande/Broto, etc.)
  size_prices?: { size_name: string; price: number }[] | null;
}

export interface PreviewChange {
  menu_item_id: string;
  action: BulkAction;
  current_name: string;
  current_price: number;
  current_description: string | null;
  current_is_available?: boolean;
  new_name: string | null;
  new_price: number | null;
  new_description: string | null;
  new_is_available?: boolean | null;
  matched_query: string;
  // Optional: when the price applies to a specific pizza size
  pizza_size_id?: string | null;
  pizza_size_name?: string | null;
  size_price_id?: string | null;
}

export interface PreviewResult {
  changes: PreviewChange[];
  not_found: string[];
}

const SYSTEM_PROMPT = `Você ajuda um administrador de loja a aplicar alterações em massa em produtos.
O usuário escreve em português BR. Extraia uma lista estruturada de alterações.

CAMPO "action" — escolha UM por item:
- "update": alterar nome, preço ou descrição de um produto específico (padrão).
- "activate": ativar/disponibilizar/voltar a vender um produto.
- "deactivate": desativar/pausar/indisponibilizar/esgotar um produto.
- "delete": excluir/remover/apagar um produto do cardápio.
- "adjust_price": ajuste de preço por percentual ou valor fixo (ex: "aumente 10%", "desconto de R$ 5", "20% off").
- "set_price": DEFINIR um preço fixo idêntico (ex: "todos os produtos a R$ 29,90", "deixe tudo por R$ 50", "Pizza Calabresa por R$ 45").

REGRAS:
- "product_name": nome do produto EXATAMENTE como escrito, INCLUINDO tamanhos como "Grande", "Broto", "Média", "P", "M", "G".
- Para "update": preencha new_price (number em reais, ex 49.90) e/ou new_description e/ou new_name (apenas se renomear explicitamente).
- Para "adjust_price": preencha adjust_percent (ex: 10 = +10%, -15 = -15%) OU adjust_amount (delta fixo em reais, positivo ou negativo). Não preencha new_price.
- Para "set_price": preencha new_price com o valor desejado.
- Para ajuste em TODOS os produtos (ex: "aumente todos os preços em 10%", "20% off em tudo", "deixe todos os produtos a R$ 29,90"), use apply_to_all=true e product_name="*".
- Quando o usuário mencionar uma categoria/departamento (ex: "porções", "bebidas", "pizzas doces"), preencha category_name com esse texto e aplique só nessa categoria.
- Para "activate"/"deactivate"/"delete": só preencha product_name e action.
- Cada produto distinto = um item separado. "Pizza Grande" e "Broto" são DOIS itens.
- Não invente produtos.

PREÇO POR TAMANHO (size_prices):
- Categorias de pizza/porção podem ter tamanhos como "Inteira"/"Meia" ou "Grande"/"Broto".
- Se o usuário citar valores POR TAMANHO no mesmo comando, preencha "size_prices" com um item por tamanho citado, usando o nome do tamanho como aparece (ex: "Inteira", "Meia"). NÃO preencha new_price nesse caso.
- Exemplos:
  • "Frango à parmegiana: Inteira R$ 44,90 e Meia R$ 24,90" → action="update", product_name="Frango à parmegiana", size_prices=[{size_name:"Inteira", price:44.9},{size_name:"Meia", price:24.9}]
  • "porção de calabresa inteira 50, meia 28" → product_name="porção de calabresa", size_prices=[{size_name:"Inteira", price:50},{size_name:"Meia", price:28}]
  • "todas as porções: inteira 45 e meia 25" → apply_to_all=true, category_name="porções", size_prices=[{size_name:"Inteira", price:45},{size_name:"Meia", price:25}]
- Se o usuário disser apenas "mude X para R$ Y" sem citar tamanhos e X for de categoria com tamanhos, preencha new_price normalmente — o sistema decide.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "save_edits",
    description: "Salva as alterações em massa interpretadas",
    parameters: {
      type: "object",
      properties: {
        edits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              product_name: { type: "string" },
              action: {
                type: "string",
                enum: ["update", "activate", "deactivate", "delete", "adjust_price", "set_price"],
              },
              new_price: { type: "number" },
              new_description: { type: "string" },
              new_name: { type: "string" },
              category_name: { type: "string" },
              adjust_percent: { type: "number" },
              adjust_amount: { type: "number" },
              apply_to_all: { type: "boolean" },
              size_prices: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    size_name: { type: "string" },
                    price: { type: "number" },
                  },
                  required: ["size_name", "price"],
                },
              },
            },
            required: ["product_name"],
          },
        },
      },
      required: ["edits"],
    },
  },
};

async function callAI(prompt: string): Promise<ParsedEdit[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "function", function: { name: "save_edits" } },
    }),
  });

  if (res.status === 429) throw new Error("Limite de uso da IA excedido. Tente em alguns minutos.");
  if (res.status === 402) throw new Error("Créditos da IA esgotados. Adicione em Configurações.");
  if (!res.ok) {
    const t = await res.text();
    console.error("AI error", res.status, t);
    throw new Error(`Falha na IA (${res.status})`);
  }

  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) throw new Error("IA não retornou alterações estruturadas");

  const parsed = JSON.parse(toolCall.function.arguments) as { edits: ParsedEdit[] };
  if (!Array.isArray(parsed.edits)) throw new Error("Formato inválido da IA");
  console.log("[bulk-edit] AI parsed edits:", JSON.stringify(parsed.edits));
  return parsed.edits;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  const A = normalize(a);
  const B = normalize(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  if (A.includes(B) || B.includes(A)) return 0.85;
  const ta = new Set(A.split(" ").filter((t) => t.length > 1));
  const tb = new Set(B.split(" ").filter((t) => t.length > 1));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((t) => {
    if (tb.has(t)) inter++;
  });
  return inter / Math.max(ta.size, tb.size);
}

async function ensureAdminFromToken(accessToken: string): Promise<string> {
  if (!accessToken) throw new Error("Não autenticado");
  const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (authErr || !userData?.user) throw new Error("Sessão inválida");
  const userId = userData.user.id;
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Acesso restrito a administradores");
  return userId;
}

const SIZE_KEYWORDS = [
  "grande",
  "broto",
  "media",
  "média",
  "pequena",
  "familia",
  "família",
  "gigante",
  "individual",
  "p",
  "m",
  "g",
];

function extractSize(productName: string): { base: string; sizeKeyword: string | null } {
  const tokens = normalize(productName).split(" ");
  let sizeKeyword: string | null = null;
  const baseTokens: string[] = [];
  for (const t of tokens) {
    if (!sizeKeyword && SIZE_KEYWORDS.includes(t)) {
      sizeKeyword = t;
    } else {
      baseTokens.push(t);
    }
  }
  return { base: baseTokens.join(" ").trim(), sizeKeyword };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export const listStoreCategories = createServerFn({ method: "POST" })
  .inputValidator((input: { storeId: string; accessToken: string }) => {
    if (!input?.storeId) throw new Error("storeId inválido");
    if (!input?.accessToken) throw new Error("Não autenticado");
    return input;
  })
  .handler(async ({ data }) => {
    await ensureAdminFromToken(data.accessToken);
    const { data: cats, error } = await supabaseAdmin
      .from("menu_categories")
      .select("id, name, position")
      .eq("store_id", data.storeId)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return { categories: cats ?? [] };
  });

export const previewBulkEdit = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { storeId: string; prompt: string; accessToken: string; categoryId?: string | null }) => {
      if (!input?.storeId || typeof input.storeId !== "string") throw new Error("storeId inválido");
      if (!input?.prompt || typeof input.prompt !== "string") throw new Error("Descreva as alterações");
      if (input.prompt.length > 10_000) throw new Error("Texto muito longo (máx 10.000 caracteres)");
      if (!input?.accessToken) throw new Error("Não autenticado");
      return input;
    },
  )
  .handler(async ({ data }) => {
    await ensureAdminFromToken(data.accessToken);

    const edits = await callAI(data.prompt);

    const { data: categories, error: categoriesError } = await supabaseAdmin
      .from("menu_categories")
      .select("id, name")
      .eq("store_id", data.storeId);
    if (categoriesError) throw new Error(categoriesError.message);

    const categoryIdFromEdit = (edit: ParsedEdit) => {
      const categoryName = edit.category_name?.trim();
      if (!categoryName) return null;
      let bestScore = 0;
      let bestCategoryId: string | null = null;
      for (const cat of categories ?? []) {
        const score = similarity(cat.name, categoryName);
        if (score > bestScore) {
          bestScore = score;
          bestCategoryId = cat.id;
        }
      }
      return bestScore >= 0.5 ? bestCategoryId : null;
    };

    let query = supabaseAdmin
      .from("menu_items")
      .select("id, name, price, description, is_available, category_id, menu_categories!inner(is_pizza)")
      .eq("store_id", data.storeId);
    if (data.categoryId) query = query.eq("category_id", data.categoryId);
    const { data: items, error } = await query;
    if (error) throw new Error(error.message);

    const { data: sizes } = await supabaseAdmin
      .from("pizza_sizes")
      .select("id, name, category_id")
      .eq("store_id", data.storeId)
      .eq("is_active", true);

    const { data: sizePrices } = await supabaseAdmin
      .from("menu_item_size_prices")
      .select("id, menu_item_id, pizza_size_id, price");

    const changes: PreviewChange[] = [];
    const notFound: string[] = [];

    // Helper: emit per-size changes for an item from e.size_prices.
    // Returns true if at least one change was emitted (so callers can skip the base-price branch).
    const emitSizePriceChangesForItem = (
      it: { id: string; name: string; price: number | string; description: string | null; category_id: string },
      e: ParsedEdit,
    ): boolean => {
      if (!e.size_prices?.length) return false;
      const catSizes = (sizes ?? []).filter((s) => s.category_id === it.category_id);
      if (catSizes.length === 0) return false;
      let emitted = false;
      for (const sp of e.size_prices) {
        if (sp == null || typeof sp.price !== "number" || !Number.isFinite(sp.price)) continue;
        // Match size by name (case/accent-insensitive, with similarity for "inteira" vs "Inteira")
        let bestSize: (typeof catSizes)[number] | null = null;
        let bestScore = 0;
        for (const cs of catSizes) {
          const score = similarity(cs.name, sp.size_name);
          if (score > bestScore) {
            bestScore = score;
            bestSize = cs;
          }
        }
        if (!bestSize || bestScore < 0.5) continue;
        const existing = (sizePrices ?? []).find(
          (row) => row.menu_item_id === it.id && row.pizza_size_id === bestSize!.id,
        );
        const cur = existing ? Number(existing.price) : 0;
        const next = Math.max(0, round2(sp.price));
        if (existing && cur === next) continue;
        changes.push({
          menu_item_id: it.id,
          action: "set_price",
          current_name: it.name,
          current_price: cur,
          current_description: it.description ?? null,
          new_name: null,
          new_price: next,
          new_description: null,
          matched_query: e.product_name,
          pizza_size_id: bestSize.id,
          pizza_size_name: bestSize.name,
          size_price_id: existing?.id ?? null,
        });
        emitted = true;
      }
      return emitted;
    };

    for (const e of edits) {
      const action: BulkAction = e.action ?? "update";
      const targetCategoryId = categoryIdFromEdit(e);
      if (e.category_name?.trim() && !targetCategoryId) {
        notFound.push(`Categoria: ${e.category_name}`);
        continue;
      }
      const scopedItems = targetCategoryId
        ? (items ?? []).filter((it) => it.category_id === targetCategoryId)
        : (items ?? []);

      // ===== Apply per-size prices to ALL items in scope =====
      if (e.apply_to_all && e.size_prices?.length) {
        for (const it of scopedItems) {
          emitSizePriceChangesForItem(it, e);
        }
        continue;
      }

      // ===== Set fixed price applied to ALL items in scope =====
      if (action === "set_price" && e.apply_to_all && e.new_price != null) {
        const target = Number(e.new_price);
        for (const it of scopedItems) {
          const itemSizes = (sizePrices ?? []).filter((sp) => sp.menu_item_id === it.id);
          const isPizza =
            (it as { menu_categories?: { is_pizza?: boolean } }).menu_categories?.is_pizza === true &&
            itemSizes.length > 0;
          if (isPizza) {
            for (const sp of itemSizes) {
              const cur = Number(sp.price);
              if (cur === target) continue;
              const sizeName = sizes?.find((s) => s.id === sp.pizza_size_id)?.name ?? null;
              changes.push({
                menu_item_id: it.id,
                action: "set_price",
                current_name: it.name,
                current_price: cur,
                current_description: it.description ?? null,
                new_name: null,
                new_price: target,
                new_description: null,
                matched_query: e.product_name,
                pizza_size_id: sp.pizza_size_id,
                pizza_size_name: sizeName,
                size_price_id: sp.id,
              });
            }
          } else {
            const cur = Number(it.price);
            if (cur === target) continue;
            changes.push({
              menu_item_id: it.id,
              action: "set_price",
              current_name: it.name,
              current_price: cur,
              current_description: it.description ?? null,
              new_name: null,
              new_price: target,
              new_description: null,
              matched_query: e.product_name,
            });
          }
        }
        continue;
      }

      // ===== Bulk adjust applied to ALL items in scope =====
      if (action === "adjust_price" && e.apply_to_all) {
        for (const it of scopedItems) {
          const itemSizes = (sizePrices ?? []).filter((sp) => sp.menu_item_id === it.id);
          const isPizza =
            (it as { menu_categories?: { is_pizza?: boolean } }).menu_categories?.is_pizza === true &&
            itemSizes.length > 0;
          if (isPizza) {
            // adjust each size price
            for (const sp of itemSizes) {
              const cur = Number(sp.price);
              const next = computeAdjustedPrice(cur, e);
              if (next == null || next === cur) continue;
              const sizeName = sizes?.find((s) => s.id === sp.pizza_size_id)?.name ?? null;
              changes.push({
                menu_item_id: it.id,
                action: "adjust_price",
                current_name: it.name,
                current_price: cur,
                current_description: it.description ?? null,
                new_name: null,
                new_price: next,
                new_description: null,
                matched_query: e.product_name,
                pizza_size_id: sp.pizza_size_id,
                pizza_size_name: sizeName,
                size_price_id: sp.id,
              });
            }
          } else {
            const cur = Number(it.price);
            const next = computeAdjustedPrice(cur, e);
            if (next == null || next === cur) continue;
            changes.push({
              menu_item_id: it.id,
              action: "adjust_price",
              current_name: it.name,
              current_price: cur,
              current_description: it.description ?? null,
              new_name: null,
              new_price: next,
              new_description: null,
              matched_query: e.product_name,
            });
          }
        }
        continue;
      }

      // ===== Single product targeted =====
      const { base, sizeKeyword } = extractSize(e.product_name);
      const queryName = base || e.product_name;

      let matchedSize: { id: string; name: string } | null = null;
      if (sizeKeyword && sizes) {
        matchedSize =
          sizes.find((s) => normalize(s.name) === sizeKeyword) ??
          sizes.find((s) => normalize(s.name).startsWith(sizeKeyword)) ??
          null;
      }

      let bestScore = 0;
      let bestItem: (typeof items)[number] | null = null;
      for (const it of scopedItems) {
        const s = similarity(it.name, queryName);
        if (s > bestScore) {
          bestScore = s;
          bestItem = it;
        }
      }
      if (!bestItem || bestScore < 0.5) {
        notFound.push(e.product_name);
        continue;
      }

      const bestItemSizes = (sizePrices ?? []).filter((sp) => sp.menu_item_id === bestItem.id);
      const isPizza =
        (bestItem as { menu_categories?: { is_pizza?: boolean } }).menu_categories?.is_pizza === true &&
        bestItemSizes.length > 0;

      // Activate / deactivate / delete
      if (action === "activate" || action === "deactivate") {
        const desired = action === "activate";
        if (bestItem.is_available === desired) continue;
        changes.push({
          menu_item_id: bestItem.id,
          action,
          current_name: bestItem.name,
          current_price: Number(bestItem.price),
          current_description: bestItem.description ?? null,
          current_is_available: bestItem.is_available,
          new_name: null,
          new_price: null,
          new_description: null,
          new_is_available: desired,
          matched_query: e.product_name,
        });
        continue;
      }
      if (action === "delete") {
        changes.push({
          menu_item_id: bestItem.id,
          action: "delete",
          current_name: bestItem.name,
          current_price: Number(bestItem.price),
          current_description: bestItem.description ?? null,
          new_name: null,
          new_price: null,
          new_description: null,
          matched_query: e.product_name,
        });
        continue;
      }

      // adjust_price for a specific product
      if (action === "adjust_price") {
        if (isPizza && matchedSize) {
          const row = (sizePrices ?? []).find(
            (sp) => sp.menu_item_id === bestItem!.id && sp.pizza_size_id === matchedSize!.id,
          );
          const cur = row ? Number(row.price) : Number(bestItem.price);
          const next = computeAdjustedPrice(cur, e);
          if (next == null || next === cur) continue;
          changes.push({
            menu_item_id: bestItem.id,
            action: "adjust_price",
            current_name: bestItem.name,
            current_price: cur,
            current_description: bestItem.description ?? null,
            new_name: null,
            new_price: next,
            new_description: null,
            matched_query: e.product_name,
            pizza_size_id: matchedSize.id,
            pizza_size_name: matchedSize.name,
            size_price_id: row?.id ?? null,
          });
        } else if (isPizza) {
          // No size given: adjust ALL sizes of this pizza
          const rows = (sizePrices ?? []).filter((sp) => sp.menu_item_id === bestItem!.id);
          for (const sp of rows) {
            const cur = Number(sp.price);
            const next = computeAdjustedPrice(cur, e);
            if (next == null || next === cur) continue;
            const sizeName = sizes?.find((s) => s.id === sp.pizza_size_id)?.name ?? null;
            changes.push({
              menu_item_id: bestItem.id,
              action: "adjust_price",
              current_name: bestItem.name,
              current_price: cur,
              current_description: bestItem.description ?? null,
              new_name: null,
              new_price: next,
              new_description: null,
              matched_query: e.product_name,
              pizza_size_id: sp.pizza_size_id,
              pizza_size_name: sizeName,
              size_price_id: sp.id,
            });
          }
        } else {
          const cur = Number(bestItem.price);
          const next = computeAdjustedPrice(cur, e);
          if (next == null || next === cur) continue;
          changes.push({
            menu_item_id: bestItem.id,
            action: "adjust_price",
            current_name: bestItem.name,
            current_price: cur,
            current_description: bestItem.description ?? null,
            new_name: null,
            new_price: next,
            new_description: null,
            matched_query: e.product_name,
          });
        }
        continue;
      }

      // ===== Per-size prices targeted at a single product (Inteira/Meia, Grande/Broto, ...) =====
      if (e.size_prices?.length) {
        const emitted = emitSizePriceChangesForItem(bestItem, e);
        if (emitted) continue;
      }

      // action === "update" or single-product "set_price"
      if (e.new_price == null && e.new_description == null && e.new_name == null) continue;

      const useSizePrice = isPizza && matchedSize && e.new_price != null;
      let currentSizePrice: number | null = null;
      let sizePriceRowId: string | null = null;
      if (useSizePrice && matchedSize) {
        const row = (sizePrices ?? []).find(
          (sp) => sp.menu_item_id === bestItem!.id && sp.pizza_size_id === matchedSize!.id,
        );
        currentSizePrice = row ? Number(row.price) : null;
        sizePriceRowId = row?.id ?? null;
      }

      changes.push({
        menu_item_id: bestItem.id,
        action: action === "set_price" ? "set_price" : "update",
        current_name: bestItem.name,
        current_price: useSizePrice && currentSizePrice != null ? currentSizePrice : Number(bestItem.price),
        current_description: bestItem.description ?? null,
        new_name: e.new_name ?? null,
        new_price: e.new_price != null ? Number(e.new_price) : null,
        new_description: e.new_description ?? null,
        matched_query: e.product_name,
        pizza_size_id: useSizePrice ? matchedSize!.id : null,
        pizza_size_name: useSizePrice ? matchedSize!.name : null,
        size_price_id: sizePriceRowId,
      });
    }

    return { changes, not_found: notFound } satisfies PreviewResult;
  });

function computeAdjustedPrice(current: number, e: ParsedEdit): number | null {
  if (e.adjust_percent != null && Number.isFinite(e.adjust_percent)) {
    return Math.max(0, round2(current * (1 + e.adjust_percent / 100)));
  }
  if (e.adjust_amount != null && Number.isFinite(e.adjust_amount)) {
    return Math.max(0, round2(current + e.adjust_amount));
  }
  return null;
}

export const applyBulkEdit = createServerFn({ method: "POST" })
  .inputValidator((input: { changes: PreviewChange[]; accessToken: string }) => {
    if (!Array.isArray(input?.changes)) throw new Error("changes inválido");
    if (input.changes.length === 0) throw new Error("Nenhuma alteração para aplicar");
    if (input.changes.length > 1000) throw new Error("Muitas alterações de uma vez (máx 1000)");
    if (!input?.accessToken) throw new Error("Não autenticado");
    return input;
  })
  .handler(async ({ data }) => {
    await ensureAdminFromToken(data.accessToken);

    let applied = 0;

    // Split changes by type so we can batch aggressively.
    const deletes: string[] = [];
    const activates: string[] = [];
    const deactivates: string[] = [];
    // menu_items price/name/desc updates that share the SAME payload can be batched with .in()
    const itemPriceGroups = new Map<number, string[]>(); // price -> [menu_item_id]
    // Other menu_items updates (name/desc, or price combined w/ other fields) go individually
    const itemMisc: { id: string; update: { price?: number; description?: string; name?: string } }[] =
      [];
    // size_price updates batched by price
    const sizePriceUpdateGroups = new Map<number, string[]>(); // price -> [size_price_id]
    // size_price inserts (no row yet)
    const sizePriceInserts: { menu_item_id: string; pizza_size_id: string; price: number }[] = [];

    for (const c of data.changes) {
      const action = c.action ?? "update";
      if (action === "delete") {
        deletes.push(c.menu_item_id);
        continue;
      }
      if (action === "activate") {
        activates.push(c.menu_item_id);
        continue;
      }
      if (action === "deactivate") {
        deactivates.push(c.menu_item_id);
        continue;
      }

      // price/desc/name updates
      if (c.new_price != null && c.pizza_size_id) {
        if (c.size_price_id) {
          const arr = sizePriceUpdateGroups.get(c.new_price) ?? [];
          arr.push(c.size_price_id);
          sizePriceUpdateGroups.set(c.new_price, arr);
        } else {
          sizePriceInserts.push({
            menu_item_id: c.menu_item_id,
            pizza_size_id: c.pizza_size_id,
            price: c.new_price,
          });
        }
        // size price changes don't touch menu_items
        continue;
      }

      const update: { price?: number; description?: string; name?: string } = {};
      if (c.new_description != null) update.description = c.new_description;
      if (c.new_name != null) update.name = c.new_name;
      if (c.new_price != null) update.price = c.new_price;

      // If only price is changing, group it for batched .in() update
      if (
        update.price != null &&
        update.description === undefined &&
        update.name === undefined
      ) {
        const arr = itemPriceGroups.get(update.price) ?? [];
        arr.push(c.menu_item_id);
        itemPriceGroups.set(update.price, arr);
      } else if (Object.keys(update).length > 0) {
        itemMisc.push({ id: c.menu_item_id, update });
      }
    }

    // Helper: run an array of promise factories with bounded concurrency
    async function runConcurrent<T>(tasks: (() => Promise<T>)[], limit = 10): Promise<T[]> {
      const results: T[] = [];
      let i = 0;
      const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
        while (i < tasks.length) {
          const idx = i++;
          results[idx] = await tasks[idx]();
        }
      });
      await Promise.all(workers);
      return results;
    }

    // Chunk helper to keep IN() lists reasonable
    function chunk<T>(arr: T[], size: number): T[][] {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    }

    // 1) Deletes (batched by .in)
    for (const ids of chunk(deletes, 200)) {
      const { error } = await supabaseAdmin.from("menu_items").delete().in("id", ids);
      if (error) console.error("bulk delete error", error);
      else applied += ids.length;
    }

    // 2) Activate / deactivate (batched)
    for (const ids of chunk(activates, 200)) {
      const { error } = await supabaseAdmin
        .from("menu_items")
        .update({ is_available: true })
        .in("id", ids);
      if (error) console.error("bulk activate error", error);
      else applied += ids.length;
    }
    for (const ids of chunk(deactivates, 200)) {
      const { error } = await supabaseAdmin
        .from("menu_items")
        .update({ is_available: false })
        .in("id", ids);
      if (error) console.error("bulk deactivate error", error);
      else applied += ids.length;
    }

    // 3) menu_items price-only updates: one query per distinct price
    const itemPriceTasks: (() => Promise<void>)[] = [];
    for (const [price, ids] of itemPriceGroups) {
      for (const idChunk of chunk(ids, 200)) {
        itemPriceTasks.push(async () => {
          const { error } = await supabaseAdmin
            .from("menu_items")
            .update({ price })
            .in("id", idChunk);
          if (error) console.error("bulk item price error", error);
          else applied += idChunk.length;
        });
      }
    }
    await runConcurrent(itemPriceTasks, 8);

    // 4) menu_items misc (name/description or mixed): individual but in parallel
    await runConcurrent(
      itemMisc.map((m) => async () => {
        const { error } = await supabaseAdmin.from("menu_items").update(m.update).eq("id", m.id);
        if (error) console.error("update menu_items error", m.id, error);
        else applied++;
      }),
      10,
    );

    // 5) size_prices updates grouped by price
    const sizeTasks: (() => Promise<void>)[] = [];
    for (const [price, ids] of sizePriceUpdateGroups) {
      for (const idChunk of chunk(ids, 200)) {
        sizeTasks.push(async () => {
          const { error } = await supabaseAdmin
            .from("menu_item_size_prices")
            .update({ price })
            .in("id", idChunk);
          if (error) console.error("bulk size_price update error", error);
          else applied += idChunk.length;
        });
      }
    }
    await runConcurrent(sizeTasks, 8);

    // 6) size_prices inserts (batched)
    for (const rows of chunk(sizePriceInserts, 200)) {
      const { error } = await supabaseAdmin.from("menu_item_size_prices").insert(rows);
      if (error) console.error("bulk size_price insert error", error);
      else applied += rows.length;
    }

    // 7) Recompute menu_items.price = max(size_prices) for any item touched by size changes,
    //    so the editor's "preço base" and the product list stay coherent.
    const touchedItemIds = new Set<string>();
    for (const c of data.changes) {
      if (c.pizza_size_id) touchedItemIds.add(c.menu_item_id);
    }
    if (touchedItemIds.size > 0) {
      const ids = Array.from(touchedItemIds);
      const { data: rows } = await supabaseAdmin
        .from("menu_item_size_prices")
        .select("menu_item_id, price")
        .in("menu_item_id", ids);
      const maxByItem = new Map<string, number>();
      for (const r of rows ?? []) {
        const cur = maxByItem.get(r.menu_item_id) ?? 0;
        const p = Number(r.price) || 0;
        if (p > cur) maxByItem.set(r.menu_item_id, p);
      }
      const baseTasks: (() => Promise<void>)[] = [];
      for (const [itemId, price] of maxByItem) {
        baseTasks.push(async () => {
          const { error } = await supabaseAdmin
            .from("menu_items")
            .update({ price })
            .eq("id", itemId);
          if (error) console.error("recompute base price error", itemId, error);
        });
      }
      await runConcurrent(baseTasks, 10);
    }

    return { applied };
  });
