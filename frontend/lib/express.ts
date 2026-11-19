"use client";

import { useSyncExternalStore } from "react";
import { createLocalStore } from "./local-store";
import { canCancelDelivery, deliveryQuote, deliveryStatus, validateDelivery, type Delivery, type DeliveryRequest } from "./express-pricing";

// Separate from food orders; the shared store persists signed-in demo state
// through /api/account-data. Dedicated fulfillment endpoints remain future work.
const store = createLocalStore<{ deliveries: Delivery[] }>("grab-express-demo-v1", { deliveries: [] },
  (value): value is { deliveries: Delivery[] } => {
    const deliveries = (value as { deliveries?: unknown })?.deliveries;
    return Array.isArray(deliveries) && deliveries.every((d) => {
      try {
        return d && typeof d.id === "string" && Number.isFinite(d.fare) && d.fare > 0
          && Number.isFinite(d.distanceKm) && Number.isFinite(Date.parse(d.createdAt))
          && (d.cancelledAt === undefined || Number.isFinite(Date.parse(d.cancelledAt))) && validateDelivery(d) === null;
      } catch { return false; }
    });
  });
export const useDeliveries = () => useSyncExternalStore(store.subscribe, store.get, store.getInitial).deliveries;

export function bookDelivery(body: DeliveryRequest): { delivery: Delivery } | { error: ReturnType<typeof validateDelivery> } {
  const error = validateDelivery(body);
  if (error) return { error };
  const quote = deliveryQuote(body.pickupPlace, body.dropoffPlace, body.parcelSize)!;
  const delivery: Delivery = {
    ...body,
    senderName: body.senderName.trim(), senderPhone: body.senderPhone.trim(), pickupAddress: body.pickupAddress.trim(),
    recipientName: body.recipientName.trim(), recipientPhone: body.recipientPhone.trim(), dropoffAddress: body.dropoffAddress.trim(),
    description: body.description.trim(), note: body.note.trim(),
    id: `EXP-${crypto.randomUUID()}`, fare: quote.fare, distanceKm: quote.distanceKm, createdAt: new Date().toISOString(),
  };
  store.update((s) => ({ deliveries: [delivery, ...s.deliveries] }));
  return { delivery };
}

export function cancelDelivery(id: string) {
  const delivery = store.get().deliveries.find((d) => d.id === id);
  if (!delivery || !canCancelDelivery(deliveryStatus(delivery, Date.now()))) return false;
  store.update((s) => ({ deliveries: s.deliveries.map((d) => d.id === id ? { ...d, cancelledAt: new Date().toISOString() } : d) }));
  return true;
}
