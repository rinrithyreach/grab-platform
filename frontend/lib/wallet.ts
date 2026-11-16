"use client";

/**
 * Demo wallet (like GrabPay). Balance and history are kept in the browser.
 * No real money: top-ups just add to the number.
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
}
interface WalletState { balance: number; txns: WalletTxn[] }

export const STARTING_BALANCE = 20;
const store = createLocalStore<WalletState>("grab-wallet-v1", {
  balance: STARTING_BALANCE,
  txns: [{ id: "welcome", kind: "topup", amount: STARTING_BALANCE, description: "Welcome bonus", createdAt: "2026-01-01T00:00:00.000Z" }],
});

export const useWallet = () => useSyncExternalStore(store.subscribe, store.get, store.getInitial);
export const walletBalance = () => store.get().balance;

const round = (n: number) => Math.round(n * 100) / 100;
const txnId = () => `TX-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 100)}`;

function add(kind: WalletTxn["kind"], amount: number, description: string) {
  store.update((s) => ({
    balance: round(s.balance + amount),
    txns: [{ id: txnId(), kind, amount: round(amount), description, createdAt: new Date().toISOString() }, ...s.txns],
  }));
}

export function topUp(amount: number) {
  add("topup", amount, "Top up");
}

/** Returns false (and charges nothing) if the balance is too low. */
export function payFromWallet(amount: number, description: string) {
  if (!canPayWithWallet(store.get().balance, amount)) return false;
  add("payment", -amount, description);
  return true;
}
