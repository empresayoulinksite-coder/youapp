export type PromoPrice =
  | { type: "weekday"; weekday: number; price: number; label?: string }
  | { type: "date"; date: string; price: number; label?: string };

export interface ServicePricingInput {
  price: number;
  promo_prices?: PromoPrice[] | null;
}

/**
 * Returns the promo entry that applies to a given date, or null.
 * A date-specific rule wins over a weekday rule.
 * `date` is a Date object; only the local Y/M/D and weekday are considered.
 */
export function findActivePromo(
  promos: PromoPrice[] | null | undefined,
  date: Date,
): PromoPrice | null {
  if (!promos || promos.length === 0) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const isoDate = `${y}-${m}-${d}`;
  const weekday = date.getDay(); // 0=domingo

  const byDate = promos.find((p) => p.type === "date" && p.date === isoDate);
  if (byDate) return byDate;
  const byWeekday = promos.find((p) => p.type === "weekday" && p.weekday === weekday);
  return byWeekday ?? null;
}

export function getEffectivePrice(svc: ServicePricingInput, date: Date): number {
  const promo = findActivePromo(svc.promo_prices ?? null, date);
  return promo ? Number(promo.price) : Number(svc.price);
}

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
