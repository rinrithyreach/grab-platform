import assert from "node:assert/strict";
import test from "node:test";
import { loadLib } from "./load-lib.mjs";

const { readRideWorkSchedule, writeRideWorkSchedule, validRideWorkSchedule } = await loadLib("ride-work-schedule");

test("weekly working hours round-trip all seven days, overnight shifts and days off", () => {
  const shifts = readRideWorkSchedule("").map((shift) => ({ ...shift, enabled: true }));
  shifts[6] = { ...shifts[6], start: "18:00", end: "02:00" };
  const value = writeRideWorkSchedule(shifts);
  assert.ok(value.length <= 200);
  assert.ok(validRideWorkSchedule(value));
  assert.deepEqual(readRideWorkSchedule(value), shifts);
  shifts[0].enabled = false;
  assert.equal(readRideWorkSchedule(writeRideWorkSchedule(shifts))[0].enabled, false);
  assert.equal(writeRideWorkSchedule(readRideWorkSchedule("")), "");
  assert.ok(validRideWorkSchedule(""));
});

test("incomplete time edits remain checked and invalid hours or duplicate days cannot be saved", () => {
  assert.deepEqual(readRideWorkSchedule("Mon -17:00")[0], { day: "Mon", enabled: true, start: "", end: "17:00" });
  for (const value of ["Mon -17:00", "Mon 08:00-", "Mon 08:00-08:00", "Mon 24:00-17:00", "Mon 08:60-17:00",
    "Mon 08:00-17:00; Mon 09:00-18:00", "Everyday 08:00-17:00", "Mon 08:00-17:00;"])
    assert.equal(validRideWorkSchedule(value), false, value);
});
