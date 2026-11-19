export const RIDE_WORK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type RideWorkDay = typeof RIDE_WORK_DAYS[number];
export interface RideWorkShift { day: RideWorkDay; enabled: boolean; start: string; end: string }

/** Stored in the merchant's existing openingHours field, in Monday–Sunday order. */
export function readRideWorkSchedule(value: string): RideWorkShift[] {
  const shifts = new Map(value.split(";").map((part) => {
    const match = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{2}:\d{2})?-(\d{2}:\d{2})?$/.exec(part.trim());
    return match ? [match[1], { start: match[2] ?? "", end: match[3] ?? "" }] as const : ["", null] as const;
  }));
  return RIDE_WORK_DAYS.map((day) => ({ day, enabled: !!shifts.get(day), start: shifts.get(day)?.start ?? "08:00", end: shifts.get(day)?.end ?? "17:00" }));
}

export function writeRideWorkSchedule(shifts: RideWorkShift[]): string {
  return RIDE_WORK_DAYS.flatMap((day) => {
    const shift = shifts.find((item) => item.day === day && item.enabled);
    return shift ? [`${day} ${shift.start}-${shift.end}`] : [];
  }).join("; ");
}

export function validRideWorkSchedule(value: string): boolean {
  if (!value.trim()) return true; // No checked days means the merchant has no scheduled working days.
  const seen = new Set<string>();
  return value.length <= 200 && value.split(";").every((part) => {
    const match = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) ((?:[01]\d|2[0-3]):[0-5]\d)-((?:[01]\d|2[0-3]):[0-5]\d)$/.exec(part.trim());
    if (!match || seen.has(match[1]) || match[2] === match[3]) return false;
    seen.add(match[1]);
    return true;
  });
}

/** Show stored weekday codes in the visitor's language without changing saved data. */
export function formatRideWorkSchedule(value: string, dayLabel: (day: RideWorkDay) => string): string {
  if (!validRideWorkSchedule(value)) return value; // Legacy free-text business hours.
  return readRideWorkSchedule(value).filter((shift) => shift.enabled)
    .map((shift) => `${dayLabel(shift.day)} ${shift.start}–${shift.end}`).join("; ");
}
