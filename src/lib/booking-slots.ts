import type { StoreHour } from "./store-hours";

export interface BookedRange {
  starts_at: string; // ISO
  ends_at: string; // ISO
}

export interface SlotOption {
  start: Date;
  end: Date;
  available: boolean;
}

/**
 * Generates time slots for a given day, respecting store_hours and existing bookings.
 *
 * @param day The day to generate slots for (only date matters, time set to 00:00)
 * @param storeHours Active store hours for that weekday
 * @param slotMinutes Slot grid size (e.g. 30)
 * @param durationMinutes How long the chosen service takes
 * @param bookings Existing bookings for that store/day (any status that occupies the slot — pending+confirmed)
 */
export function generateSlots(
  day: Date,
  storeHours: StoreHour[],
  slotMinutes: number,
  durationMinutes: number,
  bookings: BookedRange[],
  isPaused: boolean = false,
): SlotOption[] {
  const weekday = day.getDay();
  const dayHours = storeHours.filter((h) => h.is_active && h.weekday === weekday);
  if (dayHours.length === 0) return [];

  const slots: SlotOption[] = [];
  const now = new Date();
  const isToday = day.toDateString() === now.toDateString();

  for (const range of dayHours) {
    const [openH, openM] = range.opens_at.split(":").map(Number);
    const [closeH, closeM] = range.closes_at.split(":").map(Number);

    const openDate = new Date(day);
    openDate.setHours(openH, openM, 0, 0);

    const closeDate = new Date(day);
    closeDate.setHours(closeH, closeM, 0, 0);
    // Handle midnight crossover — close time before open means next day
    if (closeDate <= openDate) closeDate.setDate(closeDate.getDate() + 1);

    let cursor = new Date(openDate);
    while (true) {
      const end = new Date(cursor.getTime() + durationMinutes * 60_000);
      if (end > closeDate) break;

      const pauseCutoff = isPaused ? now.getTime() + slotMinutes * 60_000 : now.getTime();
      const inPast = isToday && cursor.getTime() <= pauseCutoff;
      const overlaps = bookings.some((b) => {
        const bs = new Date(b.starts_at).getTime();
        const be = new Date(b.ends_at).getTime();
        return cursor.getTime() < be && end.getTime() > bs;
      });

      slots.push({
        start: new Date(cursor),
        end,
        available: !inPast && !overlaps,
      });

      cursor = new Date(cursor.getTime() + slotMinutes * 60_000);
    }
  }

  return slots;
}

export function formatSlotLabel(d: Date): string {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}
