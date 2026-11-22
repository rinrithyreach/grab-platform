"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Ride } from "@/lib/api";
import { errorMessage, useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import CustomerRideTracking from "./CustomerRideTracking";

/**
 * After booking: live status, tracking map and next steps.
 * `guestToken` is set for a ride booked without an account; it is the only way to read or cancel that ride.
 */
export default function RideBookingConfirmation({ initial, from, to, demo, guestToken = null, onAnother }: {
  initial: Ride; from: string; to: string; demo: boolean; guestToken?: string | null; onAnother: () => void;
}) {
  const { api } = useAuth();
  const { t, pick } = useT();
  const [ride, setRide] = useState(initial);
  const [error, setError] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const finished = ride.status === "Completed" || ride.status === "Cancelled";
  useEffect(() => {
    if (demo || finished) return;
    const ctrl = new AbortController();
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const next = guestToken ? await api.guestRide(initial.id, guestToken, ctrl.signal) : await api.ride(initial.id, ctrl.signal);
        if (!ctrl.signal.aborted) { setRide(next); setError(false); }
      } catch { if (!ctrl.signal.aborted) setError(true); }
      finally { busy = false; }
    };
    const focus = () => { void refresh(); };
    void refresh();
    const timer = setInterval(focus, 2000);
    window.addEventListener("focus", focus);
    return () => { ctrl.abort(); clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [api, initial.id, demo, finished, guestToken]);

  async function cancelGuestRide() {
    if (!guestToken || cancelling) return;
    setCancelling(true);
    try { setRide(await api.cancelGuestRide(ride.id, guestToken)); toast(t("rides.cancelled")); }
    catch (err) { toast(errorMessage(err, t), "error"); }
    finally { setCancelling(false); }
  }

  const canCancel = !!guestToken && (ride.status === "Pending" || ride.status === "Accepted");

  return <div className="card mx-auto mt-6 max-w-2xl p-5 text-center sm:p-8">
    <p className="text-sm font-semibold text-brand">{t("ride.vehicle")}: {t(ride.vehicleType === "Motorcycle" ? "ride.moto" : ride.vehicleType === "Rickshaw" ? "ride.tuktuk" : "ride.car")}</p>
    <p className="text-5xl" aria-hidden>{ride.status === "Pending" ? "🚕" : ride.status === "Cancelled" ? "✕" : "✓"}</p>
    <h2 className="mt-3 text-xl font-bold">{t("ride.requested")}</h2>
    <p className="mt-2 text-muted">{from} → {to}</p>
    <div role="status" aria-live="polite" className="mt-4 space-y-2 rounded-xl bg-brand-soft p-4">
      <p className="font-bold text-brand">{t(`rides.${ride.status}`)}</p>
      {ride.merchantName && <p className="text-sm">{t("ride.acceptedByMerchant", { name: ride.merchantName })}</p>}
      <p className="font-semibold">{money(ride.fare)}</p>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-muted">{t("ride.statusUnavailable")}</p>}
    <CustomerRideTracking ride={ride} demo={demo} />
    {guestToken && !finished && <p className="mt-4 text-sm text-muted">{pick("Keep this page open to follow your ride. The driver will call the phone number you gave.", "សូមបើកទំព័រនេះទុក ដើម្បីតាមដានការជិះ។ អ្នកបើកបរនឹងហៅទៅលេខទូរសព្ទដែលអ្នកបានផ្ដល់។")}</p>}
    <div className="mt-6 flex flex-wrap justify-center gap-3">
      {guestToken
        ? canCancel && <button className="btn-outline" disabled={cancelling} onClick={() => void cancelGuestRide()}>{t("rides.cancel")}</button>
        : <Link href="/rides" className="btn-primary">{t("ride.track")}</Link>}
      <button className={guestToken ? "btn-primary" : "btn-outline"} onClick={onAnother}>{t("ride.another")}</button>
    </div>
  </div>;
}
