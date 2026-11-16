import assert from "node:assert/strict";
import test from "node:test";
import { loadLib } from "./load-lib.mjs";

const { matchesSearch } = await loadLib("search");
const { isOpenAt } = await loadLib("hours");

test("search matches plurals, every word, any case, and Khmer", () => {
  assert.equal(matchesSearch("Burgers", "Burger Yard"), true);
  assert.equal(matchesSearch("burger", "Classic Cheeseburger"), true);
  assert.equal(matchesSearch("PORK rice", "Grilled Pork Rice"), true);
  assert.equal(matchesSearch("dishes", "Rice dishes"), true);
  assert.equal(matchesSearch("pizza", "Burger Yard"), false);
  assert.equal(matchesSearch("pork pizza", "Grilled Pork Rice"), false); // every word must match
  assert.equal(matchesSearch("គុយទាវ", "គុយទាវសាច់គោ"), true);
  assert.equal(matchesSearch("", "anything"), true);
});

test("opening hours: same day, past midnight and 24 hours", () => {
  const at = (h, m = 0) => new Date(2026, 10, 16, h, m);
  const lunch = { open: "06:00", close: "14:00" };
  assert.equal(isOpenAt(lunch, at(5, 59)), false);
  assert.equal(isOpenAt(lunch, at(6)), true);
  assert.equal(isOpenAt(lunch, at(13, 59)), true);
  assert.equal(isOpenAt(lunch, at(14)), false);
  const night = { open: "18:00", close: "02:00" };
  assert.equal(isOpenAt(night, at(23)), true);
  assert.equal(isOpenAt(night, at(1, 30)), true);
  assert.equal(isOpenAt(night, at(12)), false);
  assert.equal(isOpenAt({ open: "00:00", close: "24:00" }, at(3)), true);
  assert.equal(isOpenAt(undefined, at(3)), true);
});
