/**
 * How wallet top-ups get paid. Two providers with the same functions:
 *
 *  - "demo" (default): pretends to be Bakong. Makes a demo QR code; a "Simulate payment"
 *    button marks it paid. Saved in the browser so a refresh doesn't lose a pending top-up.
 *  - "api": the real thing, through the backend's /api/wallet/topups endpoints
 *    (contract documented above `TopUp` in lib/api.ts). The backend talks to Bakong.
 *
 * Switch with NEXT_PUBLIC_PAYMENT_PROVIDER=api once the backend endpoints exist.
 * No page needs to change — they only use the `PaymentProvider` functions below.
 */
import type { TopUp } from "./api";
import { createLocalStore } from "./local-store";
import { usdToKhr, type Currency } from "./currency";

export type { TopUp, TopUpStatus } from "./api";

export interface PaymentProvider {
  kind: "demo" | "api";
  /** Start a top-up of `amount` USD, paid in `currency`: returns the QR code to show. */
  create(amount: number, currency?: Currency): Promise<TopUp>;
  /** Latest state of a top-up (poll this while it's "pending"). */
  status(id: string, signal?: AbortSignal): Promise<TopUp>;
  cancel(id: string): Promise<TopUp>;
  /** Demo only: pretend the customer paid in their banking app. */
  simulatePaid?(id: string): Promise<TopUp>;
}

/** Top-up limits (USD credited to the wallet, whichever currency pays for it). */
export const MIN_TOPUP = 1;
export const MAX_TOPUP = 500;
/** How long a QR code stays valid. */
export const TOPUP_EXPIRES_MINUTES = 10;

export const isValidTopUpAmount = (amount: number) =>
  Number.isFinite(amount) && amount >= MIN_TOPUP && amount <= MAX_TOPUP && Math.round(amount * 100) === amount * 100;

// ---------- demo provider ----------

const demoStore = createLocalStore<{ topups: Record<string, TopUp> }>("grab-demo-topups-v1", { topups: {} });

function save(t: TopUp) {
  demoStore.update((s) => ({ topups: { ...s.topups, [t.id]: t } }));
  return t;
}

function find(id: string): TopUp {
  const t = demoStore.get().topups[id];
  if (!t) throw new Error("Top-up not found.");
  // A pending QR code that has run out of time becomes "expired".
  if (t.status === "pending" && Date.now() >= Date.parse(t.expiresAt)) return save({ ...t, status: "expired" });
  return t;
}

export const demoProvider: PaymentProvider = {
  kind: "demo",
  async create(amount, currency = "USD") {
    if (!isValidTopUpAmount(amount)) throw new Error(`Top-up must be between ${MIN_TOPUP} and ${MAX_TOPUP}.`);
    if (currency !== "USD" && currency !== "KHR") throw new Error("Choose USD or KHR.");
    const paidAmount = currency === "KHR" ? usdToKhr(amount) : amount;
    const now = Date.now();
    const id = `TU-${now.toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)}`;
    return save({
      id, amount, currency, paidAmount, method: "bakong_khqr",
      // Deliberately NOT a real KHQR payload, so a banking app can't try to pay it.
      qr: `DEMO-ONLY|grab-platform|topup:${id}|amount:${currency === "KHR" ? paidAmount : paidAmount.toFixed(2)}${currency}`,
      status: "pending",
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + TOPUP_EXPIRES_MINUTES * 60_000).toISOString(),
      paidAt: null,
    });
  },
  async status(id) {
    return find(id);
  },
  async cancel(id) {
    const t = find(id);
    return t.status === "pending" ? save({ ...t, status: "cancelled" }) : t;
  },
  async simulatePaid(id) {
    const t = find(id);
    return t.status === "pending" ? save({ ...t, status: "paid", paidAt: new Date().toISOString() }) : t;
  },
};

// ---------- real provider (backend + Bakong) ----------

interface TopUpApi {
  createTopUp(amount: number, currency?: Currency): Promise<TopUp>;
  topUpStatus(id: string, signal?: AbortSignal): Promise<TopUp>;
  cancelTopUp(id: string): Promise<TopUp>;
}

export function apiProvider(api: TopUpApi): PaymentProvider {
  return {
    kind: "api",
    create: (amount, currency) => api.createTopUp(amount, currency),
    status: (id, signal) => api.topUpStatus(id, signal),
    cancel: (id) => api.cancelTopUp(id),
  };
}

/** The provider chosen by NEXT_PUBLIC_PAYMENT_PROVIDER ("demo" unless set to "api"). */
export function getPaymentProvider(api: TopUpApi): PaymentProvider {
  return process.env.NEXT_PUBLIC_PAYMENT_PROVIDER === "api" ? apiProvider(api) : demoProvider;
}
