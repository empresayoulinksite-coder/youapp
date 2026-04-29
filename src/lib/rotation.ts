/**
 * Rotação justa diária para lojas e stories.
 *
 * Objetivo: garantir que TODAS as lojas/stories tenham chance de aparecer no topo
 * ao longo dos dias, sem prejudicar a relevância para o usuário logado.
 *
 * Como funciona:
 *  - Cada dia gera uma "semente" estável (dia do ano + identificador do visitante).
 *  - Para cada item (loja/story), calculamos um score pseudoaleatório [0..1] estável
 *    durante o dia inteiro — a mesma loja recebe o mesmo boost de exibição até a meia-noite.
 *  - Esse boost é combinado com sinais de interesse (favoritos, pedidos) e proximidade.
 *
 * Resultado: a vitrine "respira" — lojas diferentes sobem e descem todo dia,
 * mas ainda priorizamos o que faz sentido para o usuário.
 */

const VISITOR_KEY = "yl_visitor_id";

/** Hash determinístico simples (FNV-1a 32 bits) → string. */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/** Gera/recupera um id estável para visitantes anônimos. */
export function getVisitorId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id =
        (crypto?.randomUUID?.() as string) ||
        Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

/** "2026-04-29" — muda à meia-noite local. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Semente diária. Combina o dia com o id do visitante (ou usuário logado),
 * para que cada pessoa veja uma rotação ligeiramente diferente — mas estável
 * durante o dia.
 */
export function getRotationSeed(userId?: string | null): string {
  const who = userId ?? getVisitorId();
  return `${todayKey()}::${who}`;
}

/**
 * Boost de rotação para um item, no intervalo [0..1].
 * Mesmo (seed, itemId) → mesmo valor. Muda quando o dia vira.
 */
export function rotationBoost(seed: string, itemId: string): number {
  return hash32(`${seed}::${itemId}`) / 0xffffffff;
}

/**
 * Ordena uma lista aplicando rotação justa diária + sinais opcionais.
 *
 * @param items lista a ordenar
 * @param getId extrai o id estável do item
 * @param opts.seed semente da rotação (use getRotationSeed)
 * @param opts.interest pontuação de interesse do usuário [0..∞] (opcional)
 * @param opts.distanceKm distância em km (opcional, menor é melhor)
 * @param opts.rotationWeight peso do rodízio diário (default 1)
 * @param opts.interestWeight peso do interesse (default 1.2)
 * @param opts.distanceWeight peso da distância (default 0.15 por km)
 */
export function sortWithRotation<T>(
  items: T[],
  getId: (item: T) => string,
  opts: {
    seed: string;
    interest?: (item: T) => number;
    distanceKm?: (item: T) => number | null;
    rotationWeight?: number;
    interestWeight?: number;
    distanceWeight?: number;
  },
): T[] {
  const {
    seed,
    interest,
    distanceKm,
    rotationWeight = 1,
    interestWeight = 1.2,
    distanceWeight = 0.15,
  } = opts;

  return [...items]
    .map((item) => {
      const rot = rotationBoost(seed, getId(item));
      const inter = interest ? interest(item) : 0;
      const km = distanceKm ? distanceKm(item) : null;
      const score =
        rot * rotationWeight +
        inter * interestWeight -
        (km ?? 0) * distanceWeight;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}
