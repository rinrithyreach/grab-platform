"use client";

/**
 * Demo wallet (like GrabPay). No real money: top-ups just add to the number.
 *
 * Only logged-in users have a wallet. While someone is logged in, "grab-wallet-v1" is
 * stored inside their account (see lib/local-store.ts) and synced through the
 * account-data API, so every account has its own balance. Guests have no wallet: they
 * can't see a balance, top up, or pay with it — every function below refuses without a user id.
 *
 * Wallets start at $0; money only comes from top-ups (see lib/payments.ts).
 */
import { useMemo, useSyncExternalStore } from "react";
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

/** New wallets start empty. */
export const STARTING_BALANCE = 0;

// The key name must stay "grab-wallet-v1": the backend's account-data API only accepts known keys.
const store = createLocalStore<WalletState>("grab-wallet-v1", { balance: STARTING_BALANCE, txns: [] }, (value): value is WalletState => {
  const wallet = value as WalletState;
  return !!wallet && Number.isFinite(wallet.balance) && wallet.balance >= 0 && Number.isSafeInteger(Math.round(wallet.balance * 100))
    && Array.isArray(wallet.txns) && wallet.txns.every((txn) => txn && typeof txn.id === "string"
      && ["topup", "payment", "refund"].includes(txn.kind) && Number.isFinite(txn.amount)
      && typeof txn.description === "string" && typeof txn.createdAt === "string" && Number.isFinite(Date.parse(txn.createdAt)));
});

const round = (n: number) => Math.round(n * 100) / 100;
const txnId = () => `TX-${crypto.randomUUID()}`;

/**
 * Older versions gave every wallet a $20 "welcome" bonus. Remove it (and its $20)
 * wherever it's still saved, keeping real top-ups and payments.
 */
function withoutWelcomeBonus(s: WalletState): WalletState {
  const bonus = s.txns.find((x) => x.id === "welcome");
  if (!bonus) return s;
  return { balance: Math.max(0, round(s.balance - bonus.amount)), txns: s.txns.filter((x) => x !== bonus) };
}
const current = () => withoutWelcomeBonus(store.get());

// What guests "see": no balance, no history.
const GUEST: WalletState = { balance: 0, txns: [] };
const noWallet = { subscribe: () => () => {}, get: () => GUEST, getInitial: () => GUEST };

/**
 * The wallet of the logged-in user: pass `user?.id` from useAuth().
 * For guests (no id) `hasWallet` is false, the balance is 0 and there's no history.
 */
export function useWallet(userId: string | null | undefined) {
  const s = userId ? store : noWallet;
  const raw = useSyncExternalStore(s.subscribe, s.get, s.getInitial);
  const state = useMemo(() => withoutWelcomeBonus(raw), [raw]);
  return { ...state, hasWallet: !!userId };
}

/** Current balance of the logged-in user (0 for guests). */
export const walletBalance = (userId: string | null | undefined) => (userId ? current().balance : 0);

function add(kind: WalletTxn["kind"], amount: number, description: string, extra: Pick<WalletTxn, "method" | "reference"> = {}) {
  const s = current();
  store.set({
    balance: round(s.balance + amount),
    txns: [{ id: txnId(), kind, amount: round(amount), description, createdAt: new Date().toISOString(), ...extra }, ...s.txns],
  });
}

/**
 * Adds money after a successful payment. Returns false (and adds nothing) for guests,
 * an invalid amount, or a `reference` that was already added (so a paid top-up that is
 * seen twice — e.g. two browser tabs polling — is only credited once).
 */
export function topUp(userId: string | null | undefined, amount: number, payment: { method?: string; reference?: string } = {}) {
  if (!userId || !Number.isFinite(amount) || round(amount) <= 0
    || !Number.isSafeInteger(Math.round((current().balance + amount) * 100))) return false;
  if (payment.reference && current().txns.some((x) => x.reference === payment.reference)) return false;
  add("topup", amount, "Top up", payment);
  return true;
}

/** Pays from the wallet. Returns false (and charges nothing) for guests or if the balance is too low. */
export function payFromWallet(userId: string | null | undefined, amount: number, description: string) {
  if (!userId || round(amount) <= 0 || !Number.isSafeInteger(Math.round(amount * 100)) || !canPayWithWallet(current().balance, amount)) return false;
  add("payment", -amount, description);
  return true;
}
