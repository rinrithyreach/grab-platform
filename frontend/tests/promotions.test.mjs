import assert from "node:assert/strict";
import test from "node:test";
import { loadLibGroup } from "./load-lib.mjs";

const { "promotion-rules": rules, pricing } = await loadLibGroup("promotion-rules", "pricing", "catalog", "brand", "hours");
const base = { ...rules.DEFAULT_PROMOTIONS[1], id: "test", name: "Product offer", code: null, value: 50, maxDiscount: null, storeId: "store", productId: "a" };
const lines = [{ productId: "a", price: 10, qty: 2 }, { productId: "b", price: 20, qty: 1 }];

test("product offers discount only eligible products, select the best automatic offer and stack one code", () => {
  const code = { ...base, id: "code", name: "Coupon", code: "SAVE5", kind: "amount", value: 5, productId: null };
  const smaller = { ...base, id: "smaller", value: 10 };
  const shipping = { ...base, id: "shipping", kind: "freeDelivery" };
  const result = rules.promotionTotals("store", lines, " save5 ", true, 1.5, [base, smaller, code, shipping]);
  assert.equal(result.subtotal, 40); assert.equal(result.discount, 10); assert.equal(result.codeDiscount, 5);
  assert.equal(result.deliveryFee, 0); assert.equal(result.total, 25); assert.equal(result.codeValid, true);
  assert.equal(rules.promotionTotals("other-store", lines, "SAVE5", true, 1.5, [base, code]).codeValid, false);
});

test("paused, scheduled, expired, minimum-spend and first-order rules are enforced", () => {
  const now = Date.parse("2026-11-22T12:00:00Z");
  for (const changes of [{ isActive: false }, { startsAt: "2026-11-23T00:00:00Z" }, { endsAt: "2026-11-22T12:00:00Z" }, { minSubtotal: 41 }, { firstOrderOnly: true }]) {
    const p = { ...base, ...changes };
    assert.equal(rules.promotionTotals("store", lines, undefined, false, 1.5, [p], now).discount, 0);
  }
  const p = { ...base, code: "MINIMUM", minSubtotal: 41 };
  assert.equal(rules.promotionTotals("store", lines, "MINIMUM", true, 1.5, [p], now).codeError, "minSpend");
});

test("caps and buy/get quantities apply per product without negative totals", () => {
  const p = { ...base, kind: "buyGetFree", buyQuantity: 2, freeQuantity: 1, productId: null };
  const result = rules.promotionTotals("store", [{ productId: "a", price: 3, qty: 3 }, { productId: "b", price: 10, qty: 2 }], undefined, true, 1.5, [p]);
  assert.equal(result.discount, 3);
  const capped = rules.promotionTotals("store", lines, undefined, true, 1.5, [{ ...base, value: 100, maxDiscount: 4 }]);
  assert.equal(capped.discount, 4);
  assert.equal(rules.promotionTotals("store", lines, undefined, true, 1.5, [{ ...base, kind: "amount", value: 999 }]).discount, 20);
  const stacked = rules.promotionTotals("store", lines, "SAME", true, 1.5, [{ ...base, value: 75 }, { ...base, id: "same", kind: "amount", code: "SAME", value: 100 }]);
  assert.equal(stacked.discount, 15); assert.equal(stacked.codeDiscount, 5); assert.equal(stacked.total, 21.5);
});

test("admin edits and deletions replace demo offers in cart pricing", () => {
  const cart = { storeId: "golden-noodle", lines: [{ itemId: "beef-noodle", qty: 2 }], promoCode: "WELCOME10" };
  const first = pricing.cartDetails(cart);
  assert.ok(first.discount > 0);
  rules.setPromotionRules([]);
  const removed = pricing.cartDetails(cart);
  assert.equal(removed.discount, 0); assert.equal(removed.codeDiscount, 0); assert.equal(removed.codeValid, false);
  rules.setPromotionRules([{ ...base, storeId: "golden-noodle", productId: "beef-noodle", value: 25 }]);
  assert.equal(pricing.cartDetails(cart).discount, Math.round(first.subtotal * .25 * 100) / 100);
  rules.setPromotionRules(rules.DEFAULT_PROMOTIONS);
});
