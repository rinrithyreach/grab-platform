"use client";

/**
 * One interface for ride pages, with two implementations:
 *  - "live": the real backend through lib/api.ts (needs login)
 *  - "demo": used automatically when the backend can't be reached. Rides are saved in the
 *    browser and a pretend driver accepts → drives → completes the trip over about a minute.
 */
import { useMemo } from "react";
import type { BookRideRequest, Payment, Ride, RideStatus } from "./api";
import { useAuth } from "./auth";
import { createLocalStore } from "./local-store";

export type VehicleId = "bike" | "tuk" | "car";

/** A ride as the pages show it. Demo rides also know their vehicle and driver name. */
export type RideView = Ride & { vehicle?: VehicleId; driverName?: string; reviewed?: boolean };

export interface RideService {
  mode: "live" | "demo";
  bookRide(body: BookRideRequest, vehicle: VehicleId, distanceKm: number): Promise<RideView>;
  myRides(signal?: AbortSignal): Promise<RideView[]>;
  myPayments(): Promise<Payment[]>;
  cancel(id: string): Promise<unknown>;
  pay(id: string): Promise<unknown>;
  review(id: string, rating: number, comment?: string): Promise<unknown>;
}

// ---------- demo ----------

/** Demo pricing: base fare + price per km, by vehicle. */
export const DEMO_PRICING: Record<VehicleId, { base: number; perKm: number }> = {
  bike: { base: 0.75, perKm: 0.35 },
  tuk: { base: 1.25, perKm: 0.55 },
  car: { base: 2, perKm: 0.85 },
};
export const demoFare = (vehicle: VehicleId, km: number) =>
  Math.round((DEMO_PRICING[vehicle].base + DEMO_PRICING[vehicle].perKm * km) * 100) / 100;

const DRIVERS = ["Sokha", "Dara", "Vanna", "Pisey", "Rithy", "Bopha"];
// Seconds after booking when the pretend driver moves to the next status.
const TIMELINE: { after: number; status: RideStatus }[] = [
  { after: 0, status: "Pending" },
  { after: 10, status: "Accepted" },
  { after: 30, status: "InProgress" },
  { after: 60, status: "Completed" },
];

interface DemoRide extends RideView { cancelled?: boolean }
interface DemoState { rides: DemoRide[]; payments: Payment[] }
const demoStore = createLocalStore<DemoState>("grab-demo-rides-v1", { rides: [], payments: [] });

function withLiveStatus(r: DemoRide): RideView {
  if (r.cancelled) return { ...r, status: "Cancelled" };
  const secs = (Date.now() - Date.parse(r.createdAt)) / 1000;
  const status = [...TIMELINE].reverse().find((s) => secs >= s.after)!.status;
  const completedAt = status === "Completed"
    ? new Date(Date.parse(r.createdAt) + TIMELINE[TIMELINE.length - 1].after * 1000).toISOString()
    : null;
  return { ...r, status, completedAt, driverId: status === "Pending" ? null : r.driverId };
}

const demoService: RideService = {
  mode: "demo",
  async bookRide(body, vehicle, km) {
    const id = `demo-${Date.now().toString(36)}`;
    const ride: DemoRide = {
      ...body, id, customerId: "demo-user", vehicle,
      driverId: `driver-${id}`, driverName: DRIVERS[Math.floor(Math.random() * DRIVERS.length)],
      fare: demoFare(vehicle, km), pricingMode: "Demo", status: "Pending",
      createdAt: new Date().toISOString(), completedAt: null,
    };
    demoStore.update((s) => ({ ...s, rides: [ride, ...s.rides] }));
    return ride;
  },
  async myRides() {
    return demoStore.get().rides.map(withLiveStatus);
  },
  async myPayments() {
    return demoStore.get().payments;
  },
  async cancel(id) {
    const ride = demoStore.get().rides.find((r) => r.id === id);
    const status = ride && withLiveStatus(ride).status;
    if (status !== "Pending" && status !== "Accepted") throw new Error("Only rides that haven't started can be cancelled.");
    demoStore.update((s) => ({ ...s, rides: s.rides.map((r) => (r.id === id ? { ...r, cancelled: true } : r)) }));
  },
  async pay(id) {
    const ride = demoStore.get().rides.find((r) => r.id === id);
    if (!ride || withLiveStatus(ride).status !== "Completed") throw new Error("Ride must be completed first.");
    if (demoStore.get().payments.some((p) => p.rideId === id)) throw new Error("Ride already paid.");
    const payment: Payment = { id: `pay-${id}`, rideId: id, amount: ride.fare, paymentMethod: "Demo", status: "Completed", createdAt: new Date().toISOString() };
    demoStore.update((s) => ({ ...s, payments: [payment, ...s.payments] }));
  },
  async review(id) {
    demoStore.update((s) => ({ ...s, rides: s.rides.map((r) => (r.id === id ? { ...r, reviewed: true } : r)) }));
  },
};

// ---------- live ----------

function liveService(api: ReturnType<typeof useAuth>["api"]): RideService {
  return {
    mode: "live",
    bookRide: (body) => api.bookRide(body), // the backend sets the fare; it doesn't take a vehicle type yet
    myRides: (signal) => api.myRides(1, signal),
    myPayments: () => api.myPayments(),
    cancel: (id) => api.updateRideStatus(id, "Cancelled"),
    pay: (id) => api.simulatePayment(id),
    review: (id, rating, comment) => api.reviewRide(id, rating, comment),
  };
}

/**
 * The ride service for the current situation:
 * `null` while still checking whether the backend is up.
 */
export function useRideService(): RideService | null {
  const { api, online } = useAuth();
  // Memoized so pages can safely use the service in effect dependency lists.
  return useMemo(() => (online === null ? null : online ? liveService(api) : demoService), [api, online]);
}
