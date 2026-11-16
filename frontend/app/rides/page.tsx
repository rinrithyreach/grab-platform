"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RideStatus } from "@/lib/api";
import { errorMessage, useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { useT, type MessageKey } from "@/lib/i18n";
import { PLACES } from "@/lib/places";
import { useRideService, type RideView } from "@/lib/rides";
import { toast } from "@/lib/toast";
import LoginRequired from "@/components/LoginRequired";
import BackButton from "@/components/BackButton";
import DemoModeNotice from "@/components/DemoModeNotice";

const BADGE: Record<RideStatus, string> = {
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Accepted: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  InProgress: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  Completed: "bg-brand-soft text-brand",
  Cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};
const VEHICLE: Record<string, { emoji: string; name: MessageKey }> = {
  bike: { emoji: "🛵", name: "ride.moto" },
  tuk: { emoji: "🛺", name: "ride.tuktuk" },
  car: { emoji: "🚗", name: "ride.car" },
};
const ACTIVE: RideStatus[] = ["Pending", "Accepted", "InProgress"];

/** Skeleton cards shown while rides load. */
function RideSkeletons() {
  return (
    <div className="space-y-4" aria-busy>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card animate-pulse p-5">
          <div className="flex justify-between gap-4">
            <div className="flex-1 space-y-2"><div className="h-4 w-2/3 rounded bg-border" /><div className="h-3 w-1/3 rounded bg-border" /></div>
            <div className="h-6 w-20 rounded-full bg-border" />
          </div>
          <div className="mt-4 h-9 w-28 rounded-full bg-border" />
        </div>
      ))}
    </div>
  );
}

export default function MyRidesPage() {
  const { user } = useAuth();
  return <MyRidesContent key={user?.id ?? "guest"} />;
}

function MyRidesContent() {
  const { user, ready } = useAuth();
  const service = useRideService();
  const { t, pick, dateLocale } = useT();
  const [rides, setRides] = useState<RideView[] | null>(null);
  const [paid, setPaid] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "history">("active");
  const [busy, setBusy] = useState(false);
  const acting = useRef(false);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const canLoad = !!service && ready && (service.mode === "demo" || !!user);

  // Backend place names are English; show the Khmer name when we know the place.
  const placeName = (name: string) => { const p = PLACES.find((x) => x.name === name); return p ? pick(p.name, p.km) : name; };

  const load = useCallback((signal?: AbortSignal) => {
    if (!service) return Promise.resolve();
    return Promise.all([service.myRides(signal), service.mode === "live" && user?.role !== "Customer" ? Promise.resolve([]) : service.myPayments(signal)]).then(([r, p]) => {
      if (signal?.aborted) return;
      setRides(r);
      setPaid(new Set(p.map((x) => x.rideId)));
      setError("");
    }).catch((err) => {
      if (!signal?.aborted) setError(errorMessage(err, t));
    });
  }, [service, t, user?.role]);

  // Load now, then refresh every 5 seconds while a ride is still active (live tracking).
  const hasActive = !!rides?.some((r) => ACTIVE.includes(r.status));
  useEffect(() => {
    if (!canLoad) return;
    const ctrl = new AbortController();
    load(ctrl.signal);
    const id = hasActive ? setInterval(() => load(ctrl.signal), 5000) : undefined;
    return () => { ctrl.abort(); clearInterval(id); };
  }, [canLoad, load, hasActive]);

  async function act(fn: () => Promise<unknown>, done: string) {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    setError("");
    try { await fn(); toast(done); await load(); } catch (err) { setError(errorMessage(err, t)); }
    finally { acting.current = false; setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton href="/" />
      <div className="flex items-end justify-between">
        <h1 className="text-3xl font-bold">{t("rides.title")}</h1>
        {canLoad && <button onClick={() => load()} className="text-sm font-semibold text-brand">{t("rides.refresh")}</button>}
      </div>
      {service?.mode === "demo" && <DemoModeNotice />}

      {!service || !ready ? <div className="mt-6"><RideSkeletons /></div> : !canLoad ? <LoginRequired what="loginRequired.seeRides" /> : (
        <div className="mt-6 space-y-4">
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
          {rides === null && !error && <RideSkeletons />}
          {rides && rides.length > 0 && (
            <div role="tablist" aria-label={t("rides.title")} className="flex gap-1 rounded-xl bg-surface p-1 shadow-sm ring-1 ring-border">
              {(["active", "history"] as const).map((k) => {
                const n = rides.filter((r) => ACTIVE.includes(r.status) === (k === "active")).length;
                return (
                  <button
                    key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                    className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${tab === k ? "bg-brand text-white dark:text-background" : "text-muted hover:text-foreground"}`}
                  >
                    {t(k === "active" ? "rides.tabActive" : "rides.tabHistory")} ({n})
                  </button>
                );
              })}
            </div>
          )}
          {rides && rides.length > 0 && !rides.some((r) => ACTIVE.includes(r.status) === (tab === "active")) && (
            <div className="card p-8 text-center text-muted">
              <p>{t(tab === "active" ? "rides.noActive" : "rides.noHistory")}</p>
              {tab === "active" && <Link href="/ride" className="btn-primary mt-4">{t("ride.title")}</Link>}
            </div>
          )}
          {rides?.length === 0 && (
            <div className="card p-10 text-center">
              <p className="text-5xl" aria-hidden>🚗</p>
              <p className="mt-3 font-semibold">{t("rides.empty")}</p>
              <Link href="/ride" className="btn-primary mt-5">{t("rides.bookFirst")}</Link>
            </div>
          )}

          {rides?.filter((r) => ACTIVE.includes(r.status) === (tab === "active")).map((r) => (
            <article key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{placeName(r.pickupLocation)} → {placeName(r.destination)}</p>
                  <p className="text-sm text-muted">{new Date(r.createdAt).toLocaleString(dateLocale)}</p>
                  {(r.vehicle || (r.driverName && r.status !== "Pending")) && (
                    <p className="mt-1 text-sm text-muted">
                      {r.vehicle && <>{VEHICLE[r.vehicle].emoji} {t(VEHICLE[r.vehicle].name)}</>}
                      {r.driverName && r.status !== "Pending" && <> · {t("rides.driver", { name: r.driverName })}</>}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE[r.status]}`}>
                    {ACTIVE.includes(r.status) && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current align-middle" aria-hidden />}
                    {t(`rides.${r.status}`)}
                  </span>
                  <p className="mt-1 font-bold">{money(r.fare)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(r.status === "Pending" || r.status === "Accepted") && (
                  <button className="btn-outline h-9 text-sm" disabled={busy} onClick={() => act(() => service!.cancel(r.id), t("rides.cancelled"))}>
                    {t("rides.cancel")}
                  </button>
                )}
                {r.status === "Completed" && (service?.mode === "demo" || user?.role === "Customer") && (paid.has(r.id) ? (
                  <span className="rounded-full bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand">{t("rides.paid")}</span>
                ) : (
                  <button className="btn-primary h-9 text-sm" disabled={busy} onClick={() => act(() => service!.pay(r.id), t("rides.paySuccess"))}>
                    {t("rides.pay", { amount: money(r.fare) })}
                  </button>
                ))}
                {r.status === "Completed" && r.driverId && !r.reviewed && !reviewed.has(r.id) && reviewing !== r.id && (service?.mode === "demo" || user?.role === "Customer") && (
                  <button className="btn-outline h-9 text-sm" onClick={() => setReviewing(r.id)}>{t("rides.rate")}</button>
                )}
                {(r.reviewed || reviewed.has(r.id)) && <span className="rounded-full bg-background px-3 py-1.5 text-sm text-muted">{t("rides.reviewed")}</span>}
              </div>

              {reviewing === r.id && (
                <ReviewForm
                  busy={busy}
                  onCancel={() => setReviewing(null)}
                  onSubmit={(rating, comment) => act(async () => {
                    await service!.review(r.id, rating, comment || undefined);
                    setReviewed((ids) => new Set([...ids, r.id]));
                    setReviewing(null);
                  }, t("rides.thanks"))}
                />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewForm({ onSubmit, onCancel, busy }: { onSubmit: (rating: number, comment: string) => void; onCancel: () => void; busy: boolean }) {
  const { t } = useT();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  return (
    <form
      className="mt-4 space-y-3 border-t border-border pt-4"
      onSubmit={(e) => { e.preventDefault(); onSubmit(rating, comment.trim()); }}
    >
      <div className="flex gap-1" role="radiogroup" aria-label={t("rides.rating")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button" key={n} role="radio" aria-checked={rating === n} aria-label={t("rides.stars", { n })}
            onClick={() => setRating(n)}
            className={`text-2xl ${n <= rating ? "" : "opacity-30 grayscale"}`}
          >⭐</button>
        ))}
      </div>
      <input className="input" maxLength={1000} aria-label={t("rides.reviewPh")} placeholder={t("rides.reviewPh")} value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn-primary h-9 text-sm" disabled={busy}>{t("rides.submitReview")}</button>
        <button type="button" className="btn-outline h-9 text-sm" onClick={onCancel}>{t("common.cancel")}</button>
      </div>
    </form>
  );
}
