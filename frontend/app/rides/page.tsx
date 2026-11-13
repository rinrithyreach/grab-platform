"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Ride, RideStatus } from "@/lib/api";
import { errorMessage, useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import LoginRequired from "@/components/LoginRequired";

const BADGE: Record<RideStatus, string> = {
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Accepted: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  InProgress: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  Completed: "bg-brand-soft text-brand",
  Cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export default function MyRidesPage() {
  const { api, user } = useAuth();
  const { t, dateLocale } = useT();
  const [rides, setRides] = useState<Ride[] | null>(null);
  const [paid, setPaid] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewing, setReviewing] = useState<string | null>(null);

  const load = useCallback((signal?: AbortSignal) =>
    Promise.all([api.myRides(1, signal), api.myPayments()]).then(([r, p]) => {
      setRides(r);
      setPaid(new Set(p.map((x) => x.rideId)));
    }).catch((err) => {
      if (!signal?.aborted) setError(errorMessage(err, t));
    }), [api, t]);
  const refresh = () => { setError(""); return load(); };

  useEffect(() => {
    if (!user) return;
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [user, load]);

  async function act(fn: () => Promise<unknown>, done: string) {
    setNotice(""); setError("");
    try { await fn(); setNotice(done); await refresh(); } catch (err) { setError(errorMessage(err, t)); }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-end justify-between">
        <h1 className="text-3xl font-bold">{t("rides.title")}</h1>
        {user && <button onClick={() => refresh()} className="text-sm font-semibold text-brand">{t("rides.refresh")}</button>}
      </div>

      {!user ? <LoginRequired what="loginRequired.seeRides" /> : (
        <div className="mt-6 space-y-4">
          {notice && <p className="rounded-xl bg-brand-soft p-3 text-sm font-medium text-brand">{notice}</p>}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
          {rides === null && !error && <p className="text-muted">{t("common.loading")}</p>}
          {rides?.length === 0 && (
            <div className="card p-10 text-center">
              <p className="text-5xl">🚗</p>
              <p className="mt-3 font-semibold">{t("rides.empty")}</p>
              <Link href="/ride" className="btn-primary mt-5">{t("rides.bookFirst")}</Link>
            </div>
          )}

          {rides?.map((r) => (
            <article key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.pickupLocation} → {r.destination}</p>
                  <p className="text-sm text-muted">{new Date(r.createdAt).toLocaleString(dateLocale)}</p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE[r.status]}`}>{t(`rides.${r.status}`)}</span>
                  <p className="mt-1 font-bold">{money(r.fare)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(r.status === "Pending" || r.status === "Accepted") && (
                  <button className="btn-outline h-9 text-sm" onClick={() => act(() => api.updateRideStatus(r.id, "Cancelled"), t("rides.cancelled"))}>
                    {t("rides.cancel")}
                  </button>
                )}
                {r.status === "Completed" && (paid.has(r.id) ? (
                  <span className="rounded-full bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand">{t("rides.paid")}</span>
                ) : (
                  <button className="btn-primary h-9 text-sm" onClick={() => act(() => api.simulatePayment(r.id), t("rides.paySuccess"))}>
                    {t("rides.pay", { amount: money(r.fare) })}
                  </button>
                ))}
                {r.status === "Completed" && r.driverId && reviewing !== r.id && (
                  <button className="btn-outline h-9 text-sm" onClick={() => setReviewing(r.id)}>{t("rides.rate")}</button>
                )}
              </div>

              {reviewing === r.id && (
                <ReviewForm
                  onCancel={() => setReviewing(null)}
                  onSubmit={(rating, comment) => act(async () => {
                    await api.reviewRide(r.id, rating, comment || undefined);
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

function ReviewForm({ onSubmit, onCancel }: { onSubmit: (rating: number, comment: string) => void; onCancel: () => void }) {
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
      <input className="input" maxLength={1000} placeholder={t("rides.reviewPh")} value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn-primary h-9 text-sm">{t("rides.submitReview")}</button>
        <button type="button" className="btn-outline h-9 text-sm" onClick={onCancel}>{t("common.cancel")}</button>
      </div>
    </form>
  );
}
