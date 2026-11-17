"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, type MerchantRideInbox, type MerchantRideRequest, type RideStatus } from "@/lib/api";
import { errorMessage, useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import MerchantRideNavigation from "./MerchantRideNavigation";

export default function MerchantRideRequests() {
  const { api } = useAuth();
  const { t } = useT();
  const [inbox, setInbox] = useState<MerchantRideInbox | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const dismissed = useRef(new Set<string>());
  const acting = useRef(false);
  const generation = useRef(0);
  const alive = useRef(false);
  const viewing = inbox?.requests.find((request) => request.ride.id === viewingId);

  const receive = useCallback((next: MerchantRideInbox) => {
    setInbox(next);
    setViewingId((current) => next.requests.some((request) => request.ride.id === current) ? current
      : next.requests.find((request) => !dismissed.current.has(request.ride.id))?.ride.id ?? null);
  }, []);

  useEffect(() => {
    alive.current = true;
    const ctrl = new AbortController();
    let loading = false;
    const refresh = async () => {
      if (loading || acting.current) return;
      loading = true;
      const version = generation.current;
      try {
        const next = await api.merchantRideInbox(ctrl.signal);
        if (!ctrl.signal.aborted && !acting.current && version === generation.current) { receive(next); setError(""); }
      } catch (err) { if (!ctrl.signal.aborted && !acting.current && version === generation.current) setError(errorMessage(err, t)); }
      finally { loading = false; }
    };
    const focus = () => { void refresh(); };
    void refresh();
    const timer = setInterval(focus, 2000);
    window.addEventListener("focus", focus);
    return () => { alive.current = false; generation.current += 1; ctrl.abort(); clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [api, receive, t]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (viewingId && viewing && !element.open) element.showModal();
    else if ((!viewingId || !viewing) && element.open) element.close();
  }, [viewingId, viewing]);

  async function action(work: () => Promise<MerchantRideInbox>, done: string) {
    if (acting.current) return;
    acting.current = true; generation.current += 1;
    setBusy(true); setError("");
    try {
      const next = await work();
      if (alive.current) { receive(next); toast(done); }
    } catch (err) {
      if (!alive.current) return;
      if (err instanceof ApiError && err.status === 409) {
        toast(t("merchant.rides.requestChanged"), "info");
        try { const next = await api.merchantRideInbox(); if (alive.current) receive(next); }
        catch (refreshError) { if (alive.current) setError(errorMessage(refreshError, t)); }
      } else setError(errorMessage(err, t));
    } finally { acting.current = false; if (alive.current) setBusy(false); }
  }

  async function transition(request: MerchantRideRequest, status: RideStatus) {
    await action(async () => {
      await api.updateRideStatus(request.ride.id, status);
      return api.merchantRideInbox();
    }, t("merchant.rides.updated"));
  }

  const route = (request: MerchantRideRequest) => <div className="space-y-3">
    <p className="font-semibold">{request.customerName}</p>
    <div><p className="text-xs text-muted">{t("ride.pickup")}</p><p className="break-words font-medium">🟢 {request.ride.pickupLocation}</p></div>
    <div><p className="text-xs text-muted">{t("ride.destination")}</p><p className="break-words font-medium">📍 {request.ride.destination}</p></div>
    <p className="text-2xl font-bold text-brand">{money(request.ride.fare)}</p>
  </div>;

  return <section className="card mt-6 space-y-5 p-5 sm:p-7" aria-label={t("merchant.rides.title")}>
    <div>
      <h2 className="text-xl font-bold">{t("merchant.rides.title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("merchant.rides.listening")}</p>
    </div>
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    {!inbox && !error && <p role="status" className="text-sm text-muted">{t("merchant.loading")}</p>}
    {inbox?.activeRide ? <div className="rounded-xl bg-brand-soft p-4">
      <div className="mb-4 flex flex-wrap justify-between gap-2"><h3 className="font-bold">{t("merchant.rides.active")}</h3><span className="text-sm font-semibold text-brand">{t(`rides.${inbox.activeRide.ride.status}`)}</span></div>
      {route(inbox.activeRide)}
      <MerchantRideNavigation key={inbox.activeRide.ride.id} ride={inbox.activeRide.ride} />
      <div className="mt-5 flex flex-wrap gap-3">
        {inbox.activeRide.ride.status === "Accepted" && <><button className="btn-primary h-auto min-h-11 py-2" disabled={busy} onClick={() => transition(inbox.activeRide!, "InProgress")}>{t("merchant.rides.start")}</button><button className="btn-outline" disabled={busy} onClick={() => transition(inbox.activeRide!, "Cancelled")}>{t("rides.cancel")}</button></>}
        {inbox.activeRide.ride.status === "InProgress" && <button className="btn-primary" disabled={busy} onClick={() => transition(inbox.activeRide!, "Completed")}>{t("merchant.rides.complete")}</button>}
      </div>
    </div> : inbox && (inbox.requests.length ? <ul className="space-y-2">{inbox.requests.map((request) => <li key={request.ride.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
      <p className="min-w-0 flex-1 truncate text-sm">{request.ride.pickupLocation} → {request.ride.destination}</p>
      <button className="btn-primary h-9 text-sm" disabled={busy} onClick={() => { dismissed.current.delete(request.ride.id); setViewingId(request.ride.id); }}>{t("merchant.rides.viewRequest")}</button>
    </li>)}</ul> : <p role="status" className="rounded-xl bg-brand-soft p-4 text-sm text-muted">{t("merchant.rides.waiting")}</p>)}
    <dialog ref={dialog} aria-labelledby="merchant-ride-request-title" onCancel={() => { if (viewingId) dismissed.current.add(viewingId); setViewingId(null); }} className="card m-auto w-[calc(100%_-_2rem)] max-w-md p-6 text-foreground shadow-2xl backdrop:bg-black/60">
      {viewing && <><h2 id="merchant-ride-request-title" className="mb-5 text-2xl font-bold">{t("merchant.rides.newRequest")}</h2>{route(viewing)}
        {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="mt-6 grid grid-cols-2 gap-3"><button className="btn-outline" disabled={busy} onClick={() => action(() => api.respondMerchantRide(viewing.ride.id, false), t("merchant.rides.declined"))}>{t("merchant.rides.decline")}</button><button className="btn-primary" disabled={busy} onClick={() => action(() => api.respondMerchantRide(viewing.ride.id, true), t("merchant.rides.accepted"))}>{t(busy ? "merchant.saving" : "merchant.rides.accept")}</button></div>
      </>}
    </dialog>
  </section>;
}
