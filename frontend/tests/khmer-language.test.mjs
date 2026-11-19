import assert from "node:assert/strict";
import test from "node:test";
import { loadLib, loadLibGroup } from "./load-lib.mjs";

test("English and Khmer dictionaries cover the same UI messages and placeholders", async () => {
  const { en, km } = await loadLib("messages", "express-messages", "merchant-messages", "ride-tracking-messages");
  assert.deepEqual(Object.keys(km).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en)) {
    assert.ok(km[key].trim(), `Missing Khmer text for ${key}`);
    const variables = (text) => [...text.matchAll(/\{\w+\}/g)].map(([value]) => value).sort();
    assert.deepEqual(variables(km[key]), variables(en[key]), `Placeholder mismatch: ${key}`);
  }
  assert.equal(km["ride.moto"], "ម៉ូតូ");
  assert.equal(km["ride.tuktuk"], "រ៉ឺម៉ក");
  assert.equal(km["ride.car"], "ឡាន");
});

test("API errors show localized guidance in Khmer mode", async () => {
  const { auth: { errorMessage }, api: { ApiError } } = await loadLibGroup("auth", "api", "local-store");
  const { km, en } = await loadLib("messages", "express-messages", "merchant-messages", "ride-tracking-messages");
  const originalDocument = globalThis.document;
  globalThis.document = { documentElement: { lang: "km" } };
  try {
    // A server error's English detail must not appear in Khmer mode.
    assert.equal(errorMessage(new Error("Internal server error"), (key) => km[key]), km["error.generic"]);
    assert.equal(errorMessage(new TypeError("Failed to fetch"), (key) => km[key]), km["error.network"]);
    assert.equal(errorMessage(new ApiError(400, { detail: "Invalid phone number" }), (key) => km[key]), km["error.validation"]);
    globalThis.document.documentElement.lang = "en";
    assert.equal(errorMessage(new Error("Try again"), (key) => en[key]), "Try again");
  } finally {
    globalThis.document = originalDocument;
  }
});

test("saved opening hours use Khmer weekday names on public pages", async () => {
  const { formatRideWorkSchedule } = await loadLib("ride-work-schedule");
  const { km } = await loadLib("messages", "express-messages", "merchant-messages", "ride-tracking-messages");
  assert.equal(formatRideWorkSchedule("Mon 08:00-17:00; Sun 18:00-02:00", (day) => km[`merchant.day.${day}`]),
    "ថ្ងៃចន្ទ 08:00–17:00; ថ្ងៃអាទិត្យ 18:00–02:00");
  assert.equal(formatRideWorkSchedule("Daily, 9 AM–5 PM", (day) => km[`merchant.day.${day}`]), "Daily, 9 AM–5 PM");
});
