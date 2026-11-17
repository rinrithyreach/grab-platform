"use client";

import { useT } from "@/lib/i18n";
import { readRideWorkSchedule, writeRideWorkSchedule, type RideWorkShift } from "@/lib/ride-work-schedule";

export default function RideWorkSchedule({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useT();
  const shifts = readRideWorkSchedule(value);
  const allSelected = shifts.every((shift) => shift.enabled);
  const someSelected = shifts.some((shift) => shift.enabled);
  function update(day: RideWorkShift["day"], patch: Partial<RideWorkShift>) {
    onChange(writeRideWorkSchedule(shifts.map((shift) => shift.day === day ? { ...shift, ...patch } : shift)));
  }

  return <fieldset aria-describedby="ride-work-hint ride-work-timezone">
    <legend className="text-xl font-bold">{t("merchant.workSchedule")}</legend>
    <p id="ride-work-hint" className="mb-5 mt-2 text-sm text-muted">{t("merchant.workScheduleHint")}</p>
    <label className="mb-4 flex cursor-pointer items-center gap-3 font-semibold">
      <input type="checkbox" name="selectAllWorkingDays" className="h-5 w-5 accent-brand" checked={allSelected}
        ref={(input) => { if (input) input.indeterminate = someSelected && !allSelected; }}
        onChange={(e) => onChange(writeRideWorkSchedule(shifts.map((shift) => ({ ...shift, enabled: e.target.checked }))))} />
      {t("merchant.workSelectAll")}
    </label>
    <div className="space-y-3">
      {shifts.map((shift) => <div key={shift.day} className={`grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(9rem,1fr)_1fr_1fr] sm:items-center ${shift.enabled ? "border-brand bg-brand-soft/40" : "border-border"}`}>
        <label className="flex cursor-pointer items-center gap-3 font-semibold">
          <input type="checkbox" name="workingDay" value={shift.day} checked={shift.enabled} onChange={(e) => update(shift.day, { enabled: e.target.checked })} className="h-5 w-5 accent-brand" />
          {t(`merchant.day.${shift.day}`)}
        </label>
        <div><label className="label text-xs" htmlFor={`ride-work-${shift.day}-start`}>{t("merchant.workStart")}</label><input id={`ride-work-${shift.day}-start`} name={`workStart-${shift.day}`} type="time" className="input disabled:opacity-40" disabled={!shift.enabled} required={shift.enabled} value={shift.start} onChange={(e) => update(shift.day, { start: e.target.value })} /></div>
        <div><label className="label text-xs" htmlFor={`ride-work-${shift.day}-end`}>{t("merchant.workEnd")}</label><input id={`ride-work-${shift.day}-end`} name={`workEnd-${shift.day}`} type="time" className="input disabled:opacity-40" disabled={!shift.enabled} required={shift.enabled} value={shift.end} onChange={(e) => update(shift.day, { end: e.target.value })} />{shift.enabled && shift.end && shift.start && shift.end < shift.start && <p className="mt-1 text-xs text-muted">{t("merchant.workNextDay")}</p>}</div>
      </div>)}
    </div>
    <p id="ride-work-timezone" className="mt-4 text-xs text-muted">{t("merchant.workTimezone")}</p>
  </fieldset>;
}
