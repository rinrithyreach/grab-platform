"use client";

import type { AccountData } from "./api";
import { activeLocalAccount, backUpPendingData, getAccountCache, hasCompetingCarts, replaceAccountCache, subscribeAccountChanges, type AccountValues } from "./local-store";

export type SyncPhase = "loading" | "saving" | "synced" | "offline" | "conflict";
export interface SyncState { phase: SyncPhase; detail?: string; syncedAt?: number }
interface Transport {
  accountData: (signal?: AbortSignal) => Promise<AccountData>;
  saveAccountData: (body: AccountData, signal?: AbortSignal) => Promise<AccountData>;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Rebase independent sections; never silently overwrite two edits to the same section. */
export function mergeAccountData(base: AccountValues, local: AccountValues, remote: AccountValues): AccountValues | null {
  const merged: AccountValues = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
    const localChanged = !same(base[key], local[key]), remoteChanged = !same(base[key], remote[key]);
    if (localChanged && remoteChanged && !same(local[key], remote[key])) return null;
    const value = localChanged ? local[key] : remote[key];
    if (value !== undefined) merged[key] = value;
  }
  return hasCompetingCarts(merged) ? null : merged;
}

export function startAccountSync(api: Transport, owner: string, onState: (state: SyncState) => void, intervalMs = 5000) {
  const ctrl = new AbortController();
  let busy = false, stopped = false, conflict = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const current = () => !stopped && activeLocalAccount() === owner;
  const status = (phase: SyncPhase, detail?: string) => { if (current()) onState({ phase, detail, ...(phase === "synced" ? { syncedAt: Date.now() } : {}) }); };

  async function sync() {
    if (!current() || busy || conflict) return;
    busy = true;
    try {
      const remote = await api.accountData(ctrl.signal);
      if (!current()) return;
      const cached = getAccountCache();
      const merged = cached.pending ? mergeAccountData(cached.base, cached.data, remote.data) : remote.data;
      if (!merged) { conflict = true; status("conflict"); return; }
      const pending = !same(merged, remote.data);
      replaceAccountCache({ version: remote.version, base: remote.data, data: merged, pending, revision: cached.revision });
      if (pending) {
        status("saving");
        const sent = getAccountCache();
        const saved = await api.saveAccountData({ version: remote.version, data: sent.data }, ctrl.signal);
        if (!current()) return;
        const latest = getAccountCache();
        replaceAccountCache({ version: saved.version, base: saved.data,
          data: latest.revision === sent.revision ? saved.data : latest.data,
          pending: latest.revision !== sent.revision, revision: latest.revision });
      }
      status(getAccountCache().pending ? "saving" : "synced");
    } catch (err) {
      if (!current()) return;
      if ((err as { status?: number })?.status === 409) { schedule(50); }
      else status("offline", err instanceof Error ? err.message : undefined);
    } finally {
      busy = false;
      if (current() && !conflict && getAccountCache().pending) schedule(1000);
    }
  }
  function schedule(delay = 100) {
    clearTimeout(timer);
    timer = setTimeout(() => { void sync(); }, delay);
  }
  const unsubscribe = subscribeAccountChanges(() => { if (current()) { if (!conflict) status("saving"); schedule(); } });
  const onFocus = () => { if (!conflict) void sync(); };
  window.addEventListener("focus", onFocus);
  window.addEventListener("online", onFocus);
  const interval = setInterval(() => { if (document.visibilityState !== "hidden") void sync(); }, intervalMs);
  void sync();
  return {
    retry: () => { conflict = false; return sync(); },
    loadServer: async () => {
      if (busy || !current()) return;
      try {
        const remote = await api.accountData(ctrl.signal);
        if (!current()) return;
        backUpPendingData();
        replaceAccountCache({ version: remote.version, base: remote.data, data: remote.data, pending: false, revision: getAccountCache().revision + 1 });
        conflict = false; status("synced");
      } catch (err) { status("offline", err instanceof Error ? err.message : undefined); }
    },
    stop: () => { stopped = true; ctrl.abort(); clearInterval(interval); clearTimeout(timer); unsubscribe(); window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus); },
  };
}
