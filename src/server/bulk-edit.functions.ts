import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
}

export interface PreviewResult {
  changes: PreviewChange[];
  not_found: string[];
}

const SYSTEM_PROMPT = `Você ajuda um administrador de loja a aplicar alterações em massa em produtos.
O usuário escreve em linguagem natural (português BR) instruções sobre vários produtos.
Sua tarefa: extrair uma lista estruturada de alterações.

Regras:
- "product_name": o nome EXATO ou aproximado do produto que o usuário mencionou (sem preço nem descrição).
- "new_price": novo preço em REAIS (number, sem R$, ponto decimal). Aceite vírgula como decimal e converta. Omita se não foi mencionado preço.
- "new_description": nova descrição do produto. Omita se não foi mencionada.
- "new_name": novo nome SE o usuário pedir explicitamente para renomear. Caso contrário omita.
- Cada produto vira um item separado no array.
- Não invente produtos nem campos.`;

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

async function ensureAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Acesso restrito a administradores");
}

export const previewBulkEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { storeId: string; prompt: string }) => {
    if (!input?.storeId || typeof input.storeId !== "string") throw new Error("storeId inválido");
    if (!input?.prompt || typeof input.prompt !== "string") throw new Error("Descreva as alterações");
    if (input.prompt.length > 10_000) throw new Error("Texto muito longo (máx 10.000 caracteres)");
    return input;
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);

    const edits = await callAI(data.prompt);

    const { data: items, error } = await supabaseAdmin
      .from("menu_items")
      .select("id, name, price, description")
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);

    const changes: PreviewChange[] = [];
    const notFound: string[] = [];

    for (const e of edits) {
      let bestId = "";
      let bestScore = 0;
      let bestItem: typeof items![number] | null = null;
      for (const it of items ?? []) {
        const s = similarity(it.name, e.product_name);
        if (s > bestScore) {
          bestScore = s;
          bestId = it.id;
          bestItem = it;
        }
      }
      if (!bestItem || bestScore < 0.5) {
        notFound.push(e.product_name);
        continue;
      }
      // Skip if no actual change requested
      if (e.new_price == null && e.new_description == null && e.new_name == null) continue;
      changes.push({
        menu_item_id: bestItem.id,
        current_name: bestItem.name,
        current_price: Number(bestItem.price),
        current_description: bestItem.description ?? null,
        new_name: e.new_name ?? null,
        new_price: e.new_price != null ? Number(e.new_price) : null,
        new_description: e.new_description ?? null,
        matched_query: e.product_name,
      });
    }

    return { changes, not_found: notFound } satisfies PreviewResult;
  });

export const applyBulkEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { changes: PreviewChange[] }) => {
    if (!Array.isArray(input?.changes)) throw new Error("changes inválido");
    if (input.changes.length === 0) throw new Error("Nenhuma alteração para aplicar");
    if (input.changes.length > 500) throw new Error("Muitas alterações de uma vez (máx 500)");
    return input;
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);

    let applied = 0;
    for (const c of data.changes) {
      const update: Record<string, unknown> = {};
      if (c.new_price != null) update.price = c.new_price;
      if (c.new_description != null) update.description = c.new_description;
      if (c.new_name != null) update.name = c.new_name;
      if (Object.keys(update).length === 0) continue;
      const { error } = await supabaseAdmin
        .from("menu_items")
        .update(update)
        .eq("id", c.menu_item_id);
      if (error) {
        console.error("update error", c.menu_item_id, error);
        continue;
      }
      applied++;
    }
    return { applied };
  });
