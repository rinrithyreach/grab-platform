import assert from "node:assert/strict";
import test from "node:test";
import { loadLib } from "./load-lib.mjs";

const { cardBrand, formatCardNumber, formatExpiry, luhn, validateCard, cardIsValid } = await loadLib("card");
const now = new Date(2026, 10, 22); // 22 Nov 2026
const good = { number: "4242 4242 4242 4242", name: "Sok Dara", expiry: "08/28", cvc: "123" };

test("detects Visa and Mastercard (51–55 and 2221–2720) and nothing else", () => {
  assert.equal(cardBrand("4111"), "visa");
  assert.equal(cardBrand("5500 0000"), "mastercard");
  assert.equal(cardBrand("2221 00"), "mastercard");
  assert.equal(cardBrand("2720 99"), "mastercard");
  assert.equal(cardBrand("2721"), null);
  assert.equal(cardBrand("3782 822463 10005"), null, "Amex is not accepted");
  assert.equal(cardBrand("6011"), null);
});

test("formats the number in groups of four and the expiry as MM/YY", () => {
  assert.equal(formatCardNumber("4242a4242-4242 42424242"), "4242 4242 4242 4242 424");
  assert.equal(formatExpiry("3"), "03");
  assert.equal(formatExpiry("1228"), "12/28");
  assert.equal(formatExpiry("12/2"), "12/2");
});

test("Luhn check catches a mistyped digit", () => {
  assert.equal(luhn("4242424242424242"), true);
  assert.equal(luhn("4242424242424241"), false);
  assert.equal(luhn("5555555555554444"), true);
});

test("validates every field with a specific reason", () => {
  assert.equal(cardIsValid(good, now), true);
  assert.equal(cardIsValid({ ...good, number: "5555 5555 5555 4444" }, now), true);
  assert.deepEqual(validateCard({ number: "", name: "", expiry: "", cvc: "" }, now), { number: "required", name: "required", expiry: "required", cvc: "required" });
  assert.equal(validateCard({ ...good, number: "3782 822463 10005" }, now).number, "brand");
  assert.equal(validateCard({ ...good, number: "4242 4242 4242 4241" }, now).number, "invalid");
  assert.equal(validateCard({ ...good, number: "5555 5555 5555 444" }, now).number, "invalid", "Mastercard needs 16 digits");
  assert.equal(validateCard({ ...good, name: "D4ra" }, now).name, "invalid");
  assert.equal(validateCard({ ...good, expiry: "13/28" }, now).expiry, "invalid");
  assert.equal(validateCard({ ...good, expiry: "10/26" }, now).expiry, "expired");
  assert.equal(validateCard({ ...good, expiry: "11/26" }, now).expiry, undefined, "Valid until the end of its expiry month");
  assert.equal(validateCard({ ...good, cvc: "12" }, now).cvc, "invalid");
});
