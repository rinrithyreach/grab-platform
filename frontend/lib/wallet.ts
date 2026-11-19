"use client";

/**
 * Demo wallet (like GrabPay). No real money: top-ups just add to the number.
 *
 * Only logged-in users have a wallet. Each account gets its own wallet, saved in the
 * browser under that account's id ("grab-wallet-v2:<userId>"), so two people using the
 * same computer never share a balance. Guests have no wallet: they can't see a balance,
 * top up, or pay with it — every function below refuses when there is no user id.
 */
import { useSyncExternalStore } from "react";
import { createLocalStore } from "./local-store";
import { canPayWithWallet } from "./pricing";

export interface WalletTxn {
  id: string;
  kind: "topup" | "payment" | "refund";
  amount: number;        // positive = money in, negative = money out
  description: string;   // e.g. store name or "Top up"
  createdAt: string;
  /** How it was paid, e.g. "Bakong KHQR" (top-ups only). */
  method?: string;
  /** The payment's id (e.g. the top-up id), so the same payment is never added twice. */
  reference?: string;
}
interface WalletState { balance: number; txns: WalletTxn[] }

/** New wallets start empty: money only comes from top-ups. */
export const STARTING_BALANCE = 0;
// v3: wallets used to start with a $20 welcome bonus; changing the key resets everyone to $0.
const KEY_PREFIX = "grab-wallet-v3:";

const initialWallet = (): WalletState => ({ balance: STARTING_BALANCE, txns: [] });

// One saved store per account, created the first time that account's wallet is used.
const stores = new Map<string, ReturnType<typeof createLocalStore<WalletState>>>();
function storeFor(userId: string) {
  let s = stores.get(userId);
  if (!s) { s = createLocalStore<WalletState>(KEY_PREFIX + userId, initialWallet()); stores.set(userId, s); }
  return s;
}

// What guests "see": no balance, no history, and nothing can change it.
const GUEST: WalletState = { balance: 0, txns: [] };
const noWallet = { subscribe: () => () => {}, get: () => GUEST, getInitial: () => GUEST };

// Remove wallets saved by older builds: v1 was one shared wallet (even for guests),
// v2 gave every account a $20 welcome bonus.
if (typeof window !== "undefined") {
  try {
    const old = Object.keys(window.localStorage).filter((k) => k === "grab-wallet-v1" || k.startsWith("grab-wallet-v2:"));
    old.forEach((k) => window.localStorage.removeItem(k));
  } catch { /* ignore */ }
}

/**
 * The wallet of the given account: pass `user?.id` from useAuth().
 * For guests (no id) `hasWallet` is false, the balance is 0 and there's no history.
 */
export function useWallet(userId: string | null | undefined) {
  const s = userId ? storeFor(userId) : noWallet;
  const state = useSyncExternalStore(s.subscribe, s.get, s.getInitial);
  return { ...state, hasWallet: !!userId };
}

/** Current balance of an account (0 for guests). */
export const walletBalance = (userId: string | null | undefined) => (userId ? storeFor(userId).get().balance : 0);

const round = (n: number) => Math.round(n * 100) / 100;
const txnId = () => `TX-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 100)}`;

function add(userId: string, kind: WalletTxn["kind"], amount: number, description: string, extra: Pick<WalletTxn, "method" | "reference"> = {}) {
  storeFor(userId).update((s) => ({
    balance: round(s.balance + amount),
    txns: [{ id: txnId(), kind, amount: round(amount), description, createdAt: new Date().toISOString(), ...extra }, ...s.txns],
  }));
}

/**
 * Adds money after a successful payment. Returns false (and adds nothing) for guests,
 * an invalid amount, or a `reference` that was already added (so a paid top-up that is
 * seen twice — e.g. two browser tabs polling — is only credited once).
 */
export function topUp(userId: string | null | undefined, amount: number, payment: { method?: string; reference?: string } = {}) {
  if (!userId || !Number.isFinite(amount) || amount <= 0) return false;
  if (payment.reference && storeFor(userId).get().txns.some((x) => x.reference === payment.reference)) return false;
  add(userId, "topup", amount, "Top up", payment);
  return true;
}

/** Pays from the wallet. Returns false (and charges nothing) for guests or if the balance is too low. */
export function payFromWallet(userId: string | null | undefined, amount: number, description: string) {
  if (!userId || amount <= 0 || !canPayWithWallet(storeFor(userId).get().balance, amount)) return false;
  add(userId, "payment", -amount, description);
  return true;
}
