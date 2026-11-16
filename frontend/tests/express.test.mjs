import assert from "node:assert/strict";
import test from "node:test";
import { loadLib } from "./load-lib.mjs";

const { deliveryQuote, validateDelivery, deliveryStatus, canCancelDelivery } = await loadLib("express-pricing", "places", "pricing", "catalog", "brand", "hours");
const request = {
  senderName: "Test Sender", senderPhone: "+855 12 345 678", pickupAddress: "House 12, Street 1", pickupPlace: 0,
  recipientName: "Test Recipient", recipientPhone: "012345679", dropoffAddress: "House 34, Street 2", dropoffPlace: 1,
  parcelSize: "small", weightKg: 1, description: "Study books", note: "Call on arrival",
};

test("Express validates contacts, street addresses, distinct areas, size and weight", () => {
  assert.equal(validateDelivery(request), null);
  for (const patch of [{ senderName: " " }, { recipientPhone: "123" }, { senderPhone: "letters012345678" }]) assert.equal(validateDelivery({ ...request, ...patch }), "contact");
  assert.equal(validateDelivery({ ...request, dropoffAddress: "Phnom Penh" }), "address");
  for (const dropoffPlace of [0, -1, 100, 1.5]) assert.equal(validateDelivery({ ...request, dropoffPlace }), "route");
  for (const weightKg of [0, -1, 3.01, NaN, Infinity]) assert.equal(validateDelivery({ ...request, weightKg }), "parcel");
  assert.equal(validateDelivery({ ...request, parcelSize: "document", weightKg: 0.5 }), null);
  assert.equal(validateDelivery({ ...request, parcelSize: "document", weightKg: 0.51 }), "parcel");
  assert.equal(validateDelivery({ ...request, parcelSize: "unknown" }), "parcel");
});

test("Express quote depends on route and size; identical areas cannot be booked", () => {
  const small = deliveryQuote(0, 1, "small");
  assert.ok(small.fare > 0 && small.distanceKm > 0 && small.etaMinutes >= 10);
  assert.equal(Math.round((deliveryQuote(0, 1, "medium").fare - small.fare) * 100), 100);
  assert.ok(deliveryQuote(0, 6, "small").fare > small.fare);
  assert.equal(deliveryQuote(0, 0, "small"), null);
  assert.equal(deliveryQuote(-1, 1, "small"), null);
});

test("Express tracks collection and delivery, and cancellation stops the timeline", () => {
  const start = Date.parse("2026-11-16T05:00:00Z");
  const delivery = { createdAt: new Date(start).toISOString() };
  for (const [seconds, status] of [[0, "Pending"], [10, "Accepted"], [30, "PickedUp"], [60, "Delivered"]]) {
    assert.equal(deliveryStatus(delivery, start + seconds * 1000), status);
    assert.equal(canCancelDelivery(status), seconds < 30);
  }
  assert.equal(deliveryStatus({ ...delivery, cancelledAt: new Date(start + 5000).toISOString() }, start + 100000), "Cancelled");
});
