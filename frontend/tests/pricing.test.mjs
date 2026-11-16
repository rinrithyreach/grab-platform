import assert from "node:assert/strict";
import test from "node:test";
import { loadLib } from "./load-lib.mjs";

const { cartDetails, unitPrice, lineKey, isValidAddress, canPayWithWallet } = await loadLib("pricing", "catalog", "brand", "hours");
const { getItem } = await loadLib("catalog", "hours");
const cart = (storeId, lines, extra = {}) => ({ storeId, lines, ...extra });

test("subtotal, delivery fee and total for a plain order", () => {
  const d = cartDetails(cart("burger-yard", [{ itemId: "classic", qty: 2 }, { itemId: "fries", qty: 1 }]));
  assert.equal(d.subtotal, 13.5);   // 2 × 5.50 + 2.50
  assert.equal(d.deliveryFee, 1.5);
  assert.equal(d.total, 15);
  assert.equal(d.count, 3);
});

test("empty cart costs nothing", () => {
  const d = cartDetails(cart(null, []));
  assert.equal(d.total, 0);
  assert.equal(d.deliveryFee, 0);
});

test("item options change the unit price and make separate lines", () => {
  const noodle = getItem("golden-noodle", "beef-noodle");
  assert.equal(unitPrice(noodle, []), 3.5);
  assert.equal(unitPrice(noodle, ["size:large", "extras:beef", "extras:egg"]), 6.5); // 3.50 + 1 + 1.50 + 0.50
  assert.notEqual(lineKey({ itemId: "beef-noodle", options: ["size:large"] }), lineKey({ itemId: "beef-noodle" }));
  assert.equal(lineKey({ itemId: "x", options: ["b:1", "a:2"] }), lineKey({ itemId: "x", options: ["a:2", "b:1"] })); // order doesn't matter
});

test("store deal: free delivery (Rice & Co.)", () => {
  const d = cartDetails(cart("rice-bowl", [{ itemId: "pork-rice", qty: 1 }]));
  assert.equal(d.deliveryFee, 0);
  assert.equal(d.total, 2.5);
});

test("store deal: 10% off over $20, with a hint below $20 (Home Plus)", () => {
  const big = cartDetails(cart("home-plus", [{ itemId: "detergent", qty: 10 }]));
  assert.equal(big.discount, 4.5);
  assert.equal(big.total, 42);
  const small = cartDetails(cart("home-plus", [{ itemId: "detergent", qty: 2 }]));
  assert.equal(small.discount, 0);
  assert.equal(small.amountToUnlock, 11);
});

test("store deal: buy 2 get 1 counts the same drink across different options (Sweet Spot)", () => {
  const d = cartDetails(cart("sweet-spot", [
    { itemId: "bubble-tea", qty: 2, options: ["size:m", "sugar:100"] },
    { itemId: "bubble-tea", qty: 1, options: ["size:m", "sugar:50"] },
  ]));
  assert.equal(d.discount, 2.5);
});

test("store deal: 20% off only on the very first order (Golden Noodle)", () => {
  const lines = [{ itemId: "beef-noodle", qty: 2 }];
  assert.equal(cartDetails(cart("golden-noodle", lines), []).discount, 1.4);
  assert.equal(cartDetails(cart("golden-noodle", lines), [{ id: "old" }]).discount, 0);
});

test("promo codes: GROUP6, WELCOME10 (capped), FREESHIP and unknown codes", () => {
  const lines = [{ itemId: "margherita", qty: 2 }]; // $14
  assert.equal(cartDetails(cart("pizza-lab", lines, { promoCode: "GROUP6" })).codeDiscount, 1);
  assert.equal(cartDetails(cart("pizza-lab", lines, { promoCode: "WELCOME10" })).codeDiscount, 1.4);
  const many = [{ itemId: "margherita", qty: 6 }]; // $42 → 10% would be $4.20, capped at $3
  assert.equal(cartDetails(cart("pizza-lab", many, { promoCode: "WELCOME10" })).codeDiscount, 3);
  assert.equal(cartDetails(cart("pizza-lab", lines, { promoCode: "FREESHIP" })).deliveryFee, 0);
  assert.equal(cartDetails(cart("pizza-lab", lines, { promoCode: "NOPE" })).codeDiscount, 0);
  const tiny = [{ itemId: "coconut", qty: 1 }]; // $1.25 is under GROUP6's $3 minimum
  assert.equal(cartDetails(cart("rice-bowl", tiny, { promoCode: "GROUP6" })).codeValid, false);
});

test("rider tip is added to the total", () => {
  const d = cartDetails(cart("burger-yard", [{ itemId: "classic", qty: 1 }], { tip: 1 }));
  assert.equal(d.tip, 1);
  assert.equal(d.total, 8); // 5.50 + 1.50 delivery + 1 tip
});

test("wallet check uses the current total (the $20 vs $15.50 bug)", () => {
  assert.equal(canPayWithWallet(20, 15.5), true);
  assert.equal(canPayWithWallet(20, 20), true);
  assert.equal(canPayWithWallet(20, 23.5), false);
});

test("address must have letters and numbers", () => {
  assert.equal(isValidAddress("House 12, St. 271"), true);
  assert.equal(isValidAddress("ផ្ទះលេខ ១២ ផ្លូវ ២៧១"), true); // Khmer letters + Khmer digits
  assert.equal(isValidAddress("123456"), false);
  assert.equal(isValidAddress("Street abc"), false);
  assert.equal(isValidAddress("a1"), false);
});
