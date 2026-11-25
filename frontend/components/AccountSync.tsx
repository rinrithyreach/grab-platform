"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { startAccountSync, type SyncState } from "@/lib/account-sync";
import { setPublicStoreReviews } from "@/lib/reviews";
import { availableDeviceData, importDeviceData } from "@/lib/local-store";

export default function AccountSync() {
  const { user } = useAuth();
  return <SyncSession key={user?.id ?? "guest"} />;
}

function SyncSession() {
  const { api, user, ready } = useAuth();
  const { t, lang } = useT();
  const [state, setState] = useState<SyncState>({ phase: "loading" });
  const controller = useRef<ReturnType<typeof startAccountSync> | null>(null);
  const owner = user?.id;
  useEffect(() => {
    if (!ready || !owner) return;
    const syncing = startAccountSync(api, owner, setState);
    controller.current = syncing;
    return () => { syncing.stop(); controller.current = null; };
  }, [api, ready, owner]);

  useEffect(() => {
    const ctrl = new AbortController();
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try { setPublicStoreReviews(await api.storeReviews(ctrl.signal)); } catch { /* cached public reviews stay visible */ }
      finally { busy = false; }
    };
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, 5000);
    window.addEventListener("focus", refresh);
    return () => { ctrl.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [api, user?.id]);

  if (!ready || !user) return null;
  if (state.phase === "synced") {
    if (!Object.keys(availableDeviceData()).length) return null;
    return <div className="border-b border-border bg-surface px-4 py-2 text-center text-xs">
      <button className="font-semibold text-brand" onClick={importDeviceData}>{t("sync.import")}</button>
    </div>;
  }
  // Routine loading/saving floats in a corner (only if it takes a moment) so the page never shifts;
  // problems that need the person (offline, conflict) stay as a bar above the page.
  if (state.phase === "loading" || state.phase === "saving") return <div className="sync-pill" role="status" aria-live="polite"><span aria-hidden className="sync-pill-icon">↻</span>{t(`sync.${state.phase}`)}</div>;
  return <div className="border-b border-border bg-surface text-xs" role="status" aria-live="polite">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
      <p className={state.phase === "offline" || state.phase === "conflict" ? "text-amber-700 dark:text-amber-300" : "text-muted"}>
        <span aria-hidden>↻ </span>{t(`sync.${state.phase}`)}
      </p>
      {state.phase === "offline" && <button className="font-semibold text-brand" onClick={() => controller.current?.retry()}>{t("merchant.retry")}</button>}
      {state.phase === "conflict" && <button className="font-semibold text-brand" onClick={() => controller.current?.loadServer()}>{t("sync.loadServer")}</button>}
      {state.phase === "offline" && state.detail && <p className="w-full break-words text-muted">{lang === "km" ? t("error.generic") : state.detail}</p>}
    </div>
  </div>;
}
