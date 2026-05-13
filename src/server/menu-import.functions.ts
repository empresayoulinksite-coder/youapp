import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function ensureAdminFromToken(accessToken: string): Promise<void> {
  if (!accessToken) throw new Error("Não autenticado");
  const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (authErr || !userData?.user) throw new Error("Sessão inválida");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Acesso restrito a administradores");
}

export interface ParsedItem {
  name: string;
  description?: string | null;
  price: number;
  original_price?: number | null;
}

export interface ParsedCategory {
  name: string;
  is_pizza?: boolean;
  items: ParsedItem[];
}

export interface ParsedMenu {
  categories: ParsedCategory[];
}

const SYSTEM_PROMPT = `Você extrai cardápios de restaurantes/lojas em JSON estruturado em português do Brasil.
Regras:
- Preços em REAIS (number, sem R$, use ponto decimal). Se não houver preço, use 0.
- "original_price" só quando há preço promocional/riscado (preço antigo > preço atual).
- Agrupe itens em categorias lógicas (Entradas, Pratos, Bebidas, Sobremesas, etc.). Se não houver categorias claras, use "Cardápio".
- Descrição: ingredientes/detalhes do prato. Omita se não houver.
- Ignore textos institucionais, endereços, horários, formas de pagamento.
- Nunca invente itens. Extraia apenas o que está no conteúdo.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "save_menu",
    description: "Salva o cardápio extraído",
    parameters: {
      type: "object",
      properties: {
        categories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    price: { type: "number" },
                    original_price: { type: "number" },
                  },
                  required: ["name", "price"],
                },
              },
            },
            required: ["name", "items"],
          },
        },
      },
      required: ["categories"],
    },
  },
};

async function callAIWithTool(messages: unknown[]): Promise<ParsedMenu> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "function", function: { name: "save_menu" } },
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
  if (!toolCall?.function?.arguments) throw new Error("IA não retornou um cardápio estruturado");

  try {
    const parsed = JSON.parse(toolCall.function.arguments) as ParsedMenu;
    if (!Array.isArray(parsed.categories)) throw new Error("Formato inválido");
    return parsed;
  } catch (e) {
    console.error("Parse error", e);
    throw new Error("Não foi possível interpretar o cardápio extraído");
  }
}

export const importMenuFromUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string; accessToken: string }) => {
    if (!input?.url || typeof input.url !== "string") throw new Error("URL inválida");
    if (!input?.accessToken) throw new Error("Não autenticado");
    try {
      new URL(input.url);
    } catch {
      throw new Error("URL inválida");
    }
    return input;
  })
  .handler(async ({ data }) => {
    await ensureAdminFromToken(data.accessToken);
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) throw new Error("Firecrawl não configurado");

    const scrapeRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: data.url,
        formats: ["markdown"],
        onlyMainContent: true,
        maxAge: 3600000,
        timeout: 20000,
        blockAds: true,
      }),
    });

    if (scrapeRes.status === 402) {
      throw new Error("Créditos do Firecrawl esgotados. Reabasteça para continuar importando.");
    }
    if (!scrapeRes.ok) {
      const t = await scrapeRes.text();
      console.error("Firecrawl error", scrapeRes.status, t);
      throw new Error(`Falha ao acessar o site (${scrapeRes.status}). Verifique se a URL está pública.`);
    }

    const scrape = await scrapeRes.json();
    const markdown: string = scrape?.data?.markdown ?? scrape?.markdown ?? "";
    if (!markdown || markdown.length < 50) {
      throw new Error("Não foi possível extrair conteúdo da página");
    }

    const truncated = markdown.slice(0, 15000);
    const menu = await callAIWithTool([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Extraia o cardápio do conteúdo abaixo (markdown da página):\n\n${truncated}`,
      },
    ]);
    return menu;
  });

export const importMenuFromImage = createServerFn({ method: "POST" })
  .inputValidator((input: { imageDataUrl: string; accessToken: string }) => {
    if (!input?.imageDataUrl?.startsWith("data:image/")) {
      throw new Error("Imagem inválida (envie um data URL)");
    }
    if (input.imageDataUrl.length > 8_000_000) {
      throw new Error("Imagem muito grande (máx ~6MB)");
    }
    if (!input?.accessToken) throw new Error("Não autenticado");
    return input;
  })
  .handler(async ({ data }) => {
    await ensureAdminFromToken(data.accessToken);
    return callAIWithTool([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Extraia o cardápio desta foto de cardápio." },
          { type: "image_url", image_url: { url: data.imageDataUrl } },
        ],
      },
    ]);
  });
