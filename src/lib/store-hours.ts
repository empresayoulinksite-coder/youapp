export interface StoreHour {
  id: string;
  store_id: string;
  weekday: number; // 0=Dom, 6=Sáb
  opens_at: string; // "HH:MM:SS" or "HH:MM"
  closes_at: string;
  is_active: boolean;
}

export const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatTime(t: string): string {
  const [h, m] = t.split(":");
  return `${h?.padStart(2, "0") ?? "00"}:${m?.padStart(2, "0") ?? "00"}`;
}

/**
 * Returns true if the store is "available" right now: not manually paused
 * AND within its configured opening hours.
 */
export function isStoreAvailable(
  hours: StoreHour[],
  isPaused: boolean,
  now: Date = new Date(),
): boolean {
  if (isPaused) return false;
  return isStoreOpen(hours, now);
}

/**
 * Returns true if the store is currently open based on its hours.
 * Handles intervals that cross midnight (e.g. 18:00 → 02:00).
 */
export function isStoreOpen(hours: StoreHour[], now: Date = new Date()): boolean {
  if (!hours || hours.length === 0) return false;
  const today = now.getDay();
  const yesterday = (today + 6) % 7;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const h of hours) {
    if (!h.is_active) continue;
    const open = toMinutes(h.opens_at);
    const close = toMinutes(h.closes_at);

    if (close > open) {
      // same-day interval
      if (h.weekday === today && nowMin >= open && nowMin < close) return true;
    } else {
      // crosses midnight
      if (h.weekday === today && nowMin >= open) return true;
      if (h.weekday === yesterday && nowMin < close) return true;
    }
  }
  return false;
}

/**
 * Returns the next opening as a friendly label, e.g. "abre hoje às 18:00" or "abre seg às 11:00".
 */
export function nextOpeningLabel(hours: StoreHour[], now: Date = new Date()): string | null {
  const active = hours.filter((h) => h.is_active);
  if (active.length === 0) return null;
  const today = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset < 7; offset++) {
    const day = (today + offset) % 7;
    const dayHours = active
      .filter((h) => h.weekday === day)
      .sort((a, b) => toMinutes(a.opens_at) - toMinutes(b.opens_at));
    for (const h of dayHours) {
      const open = toMinutes(h.opens_at);
      if (offset === 0 && open <= nowMin) continue;
      const label = offset === 0 ? "hoje" : offset === 1 ? "amanhã" : WEEKDAYS_SHORT[day].toLowerCase();
      return `abre ${label} às ${formatTime(h.opens_at)}`;
    }
  }
  return null;
}

export function groupByWeekday(hours: StoreHour[]): Record<number, StoreHour[]> {
  const grouped: Record<number, StoreHour[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const h of hours) {
    grouped[h.weekday] = grouped[h.weekday] || [];
    grouped[h.weekday].push(h);
  }
  for (const k of Object.keys(grouped)) {
    grouped[Number(k)].sort((a, b) => toMinutes(a.opens_at) - toMinutes(b.opens_at));
  }
  return grouped;
}
