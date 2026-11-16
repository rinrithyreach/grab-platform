/**
 * Store opening hours. Times are "HH:MM" in the shopper's local time.
 * A closing time earlier than the opening time means "open past midnight" (e.g. 18:00–02:00).
 * "00:00"–"24:00" means open 24 hours.
 */
export interface Hours { open: string; close: string }

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function isOpenAt(hours: Hours | undefined, date: Date) {
  if (!hours) return true;
  const now = date.getHours() * 60 + date.getMinutes();
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  if (open === close) return true;                       // e.g. 00:00–00:00 = always open
  return open < close ? now >= open && now < close        // same day
                      : now >= open || now < close;       // past midnight
}

export const isOpen24h = (hours: Hours | undefined) => !hours || (hours.open === "00:00" && hours.close === "24:00");

/** "7:00 AM" / "19:30" style label for a "HH:MM" time, in the given locale. */
export function formatTime(hhmm: string, locale: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2000, 0, 1, h % 24, m).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}
