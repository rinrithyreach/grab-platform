import { PLACES, distanceKm } from "./places";
import { isValidAddress, round } from "./pricing";

export const PARCEL_SIZES = {
  document: { maxKg: 0.5, surcharge: 0 },
  small: { maxKg: 3, surcharge: 0.5 },
  medium: { maxKg: 10, surcharge: 1.5 },
} as const;
export type ParcelSize = keyof typeof PARCEL_SIZES;
export type DeliveryStatus = "Pending" | "Accepted" | "PickedUp" | "Delivered" | "Cancelled";

export interface DeliveryRequest {
  senderName: string; senderPhone: string; pickupAddress: string; pickupPlace: number;
  recipientName: string; recipientPhone: string; dropoffAddress: string; dropoffPlace: number;
  parcelSize: ParcelSize; weightKg: number; description: string; note: string;
}
export interface Delivery extends DeliveryRequest {
  id: string; fare: number; distanceKm: number; createdAt: string; cancelledAt?: string;
}
export type DeliveryError = "contact" | "address" | "route" | "parcel";

export function isValidPhone(value: string) {
  return /^\+?[\d\s()-]+$/.test(value.trim()) && /^\d{8,15}$/.test(value.replace(/\D/g, ""));
}

export function validateDelivery(body: DeliveryRequest): DeliveryError | null {
  if (![body.senderName, body.recipientName].every((s) => s.trim().length >= 2 && s.trim().length <= 120)
    || ![body.senderPhone, body.recipientPhone].every(isValidPhone)) return "contact";
  if (![body.pickupAddress, body.dropoffAddress].every((s) => isValidAddress(s) && s.trim().length <= 300)) return "address";
  if (!Number.isInteger(body.pickupPlace) || !Number.isInteger(body.dropoffPlace)
    || !PLACES[body.pickupPlace] || !PLACES[body.dropoffPlace] || body.pickupPlace === body.dropoffPlace) return "route";
  if (!Object.hasOwn(PARCEL_SIZES, body.parcelSize) || !Number.isFinite(body.weightKg)
    || body.weightKg <= 0 || body.weightKg > PARCEL_SIZES[body.parcelSize].maxKg
    || body.description.trim().length < 3 || body.description.trim().length > 300 || body.note.length > 500) return "parcel";
  return null;
}

/** A demo estimate using straight-line distance, never a production price quote. */
export function deliveryQuote(pickup: number, dropoff: number, size: ParcelSize) {
  const from = PLACES[pickup], to = PLACES[dropoff];
  if (!from || !to || pickup === dropoff || !Object.hasOwn(PARCEL_SIZES, size)) return null;
  const km = distanceKm(from, to);
  return { distanceKm: km, fare: round(1.5 + km * 0.45 + PARCEL_SIZES[size].surcharge), etaMinutes: Math.max(10, Math.round(km / 20 * 60) + 10) };
}

/** Demo-only progression: searching, assigned, collected, delivered in one minute. */
export function deliveryStatus(delivery: Pick<Delivery, "createdAt" | "cancelledAt">, now: number): DeliveryStatus {
  if (delivery.cancelledAt) return "Cancelled";
  const seconds = (now - Date.parse(delivery.createdAt)) / 1000;
  return seconds >= 60 ? "Delivered" : seconds >= 30 ? "PickedUp" : seconds >= 10 ? "Accepted" : "Pending";
}

export const canCancelDelivery = (status: DeliveryStatus) => status === "Pending" || status === "Accepted";
