import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ParsedEdit {
  product_name: string;
  new_price?: number | null;
  new_description?: string | null;
  new_name?: string | null;
}

export interface PreviewChange {
  menu_item_id: string;
  current_name: string;
  current_price: number;
  current_description: string | null;
  new_name: string | null;
  new_price: number | null;
  new_description: string | null;
  matched_query: string;
  // Optional: when the price applies to a specific pizza size
  pizza_size_id?: string | null;
  pizza_size_name?: string | null;
  size_price_id?: string | null; // existing menu_item_size_prices row id, if any
}

export interface PreviewResult {
  changes: PreviewChange[];
  not_found: string[];
}

const SYSTEM_PROMPT = `Você ajuda um administrador de loja a aplicar alterações em massa em produtos.
O usuário escreve em linguagem natural (português BR) instruções sobre vários produtos.
Sua tarefa: extrair uma lista estruturada de alterações, UMA POR PRODUTO mencionado.

Regras CRÍTICAS:
- "product_name": o nome do produto EXATAMENTE como o usuário escreveu, INCLUINDO variações de tamanho como "Grande", "Broto", "Média", "Pequena", "Família", "P", "M", "G". Ex: se o usuário escreve "Pizza Grande de Calabresa", use "Pizza Grande de Calabresa". Se escreve "Broto de Calabresa", use "Broto de Calabresa". NÃO remova essas palavras.
- "new_price": novo preço em REAIS como number (ex: 49.90). Aceite formatos "R$ 50", "50,00", "50.00", "50 reais". SEMPRE extraia se houver qualquer número ao lado do produto que pareça preço. Omita SOMENTE se realmente não houver preço.
- "new_description": nova descrição/ingredientes do produto. Extraia QUALQUER texto descritivo após o nome (ex: "deliciosa pizza com molho artesanal", "feita com mussarela e calabresa fatiada"). Omita só se não houver nenhuma descrição.
- "new_name": SOMENTE se o usuário pedir explicitamente para renomear ("renomear para X", "trocar nome para X"). NUNCA preencha apenas porque o nome no comando difere do cadastrado.
- Cada produto distinto mencionado pelo usuário = um item separado no array. "Pizza Grande" e "Broto" da mesma pizza são DOIS itens separados, cada um com seu próprio preço e descrição.
- Não invente produtos, preços ou descrições que não estejam no texto.`;

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
              new_price: { type: "number" },
              new_description: { type: "string" },
              new_name: { type: "string" },
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
  // Token overlap
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

// Known pizza size keywords -> match against pizza_sizes.name
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

export const previewBulkEdit = createServerFn({ method: "POST" })
  .inputValidator((input: { storeId: string; prompt: string; accessToken: string }) => {
    if (!input?.storeId || typeof input.storeId !== "string") throw new Error("storeId inválido");
    if (!input?.prompt || typeof input.prompt !== "string") throw new Error("Descreva as alterações");
    if (input.prompt.length > 10_000) throw new Error("Texto muito longo (máx 10.000 caracteres)");
    if (!input?.accessToken) throw new Error("Não autenticado");
    return input;
  })
  .handler(async ({ data }) => {
    await ensureAdminFromToken(data.accessToken);

    const edits = await callAI(data.prompt);

    const { data: items, error } = await supabaseAdmin
      .from("menu_items")
      .select("id, name, price, description, category_id, menu_categories!inner(is_pizza)")
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);

    const { data: sizes } = await supabaseAdmin
      .from("pizza_sizes")
      .select("id, name")
      .eq("store_id", data.storeId)
      .eq("is_active", true);

    const { data: sizePrices } = await supabaseAdmin
      .from("menu_item_size_prices")
      .select("id, menu_item_id, pizza_size_id, price");

    const changes: PreviewChange[] = [];
    const notFound: string[] = [];

    for (const e of edits) {
      const { base, sizeKeyword } = extractSize(e.product_name);
      const queryName = base || e.product_name;

      // Find matching pizza_size by keyword
      let matchedSize: { id: string; name: string } | null = null;
      if (sizeKeyword && sizes) {
        matchedSize =
          sizes.find((s) => normalize(s.name) === sizeKeyword) ??
          sizes.find((s) => normalize(s.name).startsWith(sizeKeyword)) ??
          null;
      }

      // Find best matching menu_item using BASE name
      let bestScore = 0;
      let bestItem: (typeof items)[number] | null = null;
      for (const it of items ?? []) {
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
      if (e.new_price == null && e.new_description == null && e.new_name == null) continue;

      // For pizza items with a size keyword, route price to menu_item_size_prices
      const isPizza = (bestItem as { menu_categories?: { is_pizza?: boolean } }).menu_categories?.is_pizza === true;
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

export const applyBulkEdit = createServerFn({ method: "POST" })
  .inputValidator((input: { changes: PreviewChange[]; accessToken: string }) => {
    if (!Array.isArray(input?.changes)) throw new Error("changes inválido");
    if (input.changes.length === 0) throw new Error("Nenhuma alteração para aplicar");
    if (input.changes.length > 500) throw new Error("Muitas alterações de uma vez (máx 500)");
    if (!input?.accessToken) throw new Error("Não autenticado");
    return input;
  })
  .handler(async ({ data }) => {
    await ensureAdminFromToken(data.accessToken);

    let applied = 0;
    for (const c of data.changes) {
      let ok = false;

      // 1) menu_items update (description, name, and price ONLY when not size-specific)
      const update: { price?: number; description?: string; name?: string } = {};
      if (c.new_description != null) update.description = c.new_description;
      if (c.new_name != null) update.name = c.new_name;
      if (c.new_price != null && !c.pizza_size_id) update.price = c.new_price;
      if (Object.keys(update).length > 0) {
        const { error } = await supabaseAdmin
          .from("menu_items")
          .update(update)
          .eq("id", c.menu_item_id);
        if (error) {
          console.error("update menu_items error", c.menu_item_id, error);
        } else {
          ok = true;
        }
      }

      // 2) menu_item_size_prices upsert (when price targets a pizza size)
      if (c.new_price != null && c.pizza_size_id) {
        if (c.size_price_id) {
          const { error } = await supabaseAdmin
            .from("menu_item_size_prices")
            .update({ price: c.new_price })
            .eq("id", c.size_price_id);
          if (error) console.error("update size_price error", c.size_price_id, error);
          else ok = true;
        } else {
          const { error } = await supabaseAdmin
            .from("menu_item_size_prices")
            .insert({
              menu_item_id: c.menu_item_id,
              pizza_size_id: c.pizza_size_id,
              price: c.new_price,
            });
          if (error) console.error("insert size_price error", error);
          else ok = true;
        }
      }

      if (ok) applied++;
    }
    return { applied };
  });
