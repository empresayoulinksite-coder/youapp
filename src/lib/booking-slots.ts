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
): SlotOption[] {
  const weekday = day.getDay();
  const dayHours = storeHours.filter((h) => h.is_active && h.weekday === weekday);
  if (dayHours.length === 0) return [];

  const slots: SlotOption[] = [];
  const now = new Date();
  const isToday = day.toDateString() === now.toDateString();

  // Sort bookings by start time once
  const sortedBookings = [...bookings]
    .map((b) => ({ start: new Date(b.starts_at).getTime(), end: new Date(b.ends_at).getTime() }))
    .sort((a, b) => a.start - b.start);

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
    let safety = 0;
    while (safety++ < 1000) {
      if (cursor.getTime() > closeDate.getTime()) break;
      const end = new Date(cursor.getTime() + durationMinutes * 60_000);

      // Find any booking that overlaps [cursor, end)
      const overlap = sortedBookings.find(
        (b) => cursor.getTime() < b.end && end.getTime() > b.start,
      );

      if (overlap) {
        // Re-anchor the grid: jump cursor to the end of this booking and continue
        const nextCursor = new Date(overlap.end);
        if (nextCursor.getTime() <= cursor.getTime()) break;
        cursor = nextCursor;
        continue;
      }

      const inPast = isToday && cursor.getTime() <= now.getTime();
      slots.push({
        start: new Date(cursor),
        end,
        available: !inPast,
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
