"use client";

/**
 * Wallet top-up pop-up: choose payment → scan the KHQR code → paid.
 * Talks only to a PaymentProvider (lib/payments.ts), so swapping the demo for the real
 * Bakong integration needs no change here.
 */
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { getPaymentProvider, type TopUp } from "@/lib/payments";
import { toast } from "@/lib/toast";
import { topUp } from "@/lib/wallet";

type Step = "choose" | "starting" | "qr" | "paid" | "expired" | "error";
const POLL_MS = 2000;

export default function TopUpDialog({ amount, onClose }: { amount: number; onClose: () => void }) {
  const { t } = useT();
  const { api, user } = useAuth();
  const [provider] = useState(() => getPaymentProvider(api));
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>("choose");
  const [topup, setTopup] = useState<TopUp | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Open as a modal when mounted.
  useEffect(() => { ref.current?.showModal(); }, []);

  // Draw the QR code image from the KHQR text.
  useEffect(() => {
    if (!topup) return;
    QRCode.toDataURL(topup.qr, { margin: 1, width: 240, errorCorrectionLevel: "M" }).then(setQrImage, () => setQrImage(""));
  }, [topup]);

  // While waiting: check the payment every 2 seconds and count down to expiry.
  const pendingId = step === "qr" && topup ? topup.id : null;
  const expiresAt = topup?.expiresAt;
  useEffect(() => {
    if (!pendingId || !expiresAt) return;
    const ctrl = new AbortController();
    const tick = () => setSecondsLeft(Math.max(0, Math.round((Date.parse(expiresAt) - Date.now()) / 1000)));
    tick();
    const clock = setInterval(tick, 1000);
    const poll = setInterval(() => {
      provider.status(pendingId, ctrl.signal).then(handleUpdate, () => { /* try again next time */ });
    }, POLL_MS);
    return () => { ctrl.abort(); clearInterval(clock); clearInterval(poll); };
    // handleUpdate only uses stable values (user id, provider) — it doesn't need to restart polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingId, expiresAt, provider]);

  function handleUpdate(latest: TopUp) {
    setTopup(latest);
    if (latest.status === "paid") {
      // `reference` makes this safe to call more than once: the same top-up is credited only once.
      topUp(user?.id, latest.amount, { method: "Bakong KHQR", reference: latest.id });
      setStep("paid");
      toast(t("wallet.topUpDone", { amount: money(latest.amount) }));
    } else if (latest.status === "expired") setStep("expired");
    else if (latest.status === "failed") { setError(t("topup.failed")); setStep("error"); }
    else if (latest.status === "cancelled") onClose();
  }

  async function start() {
    setStep("starting"); setError("");
    try { setTopup(await provider.create(amount)); setStep("qr"); }
    catch (err) { setError(err instanceof Error ? err.message : t("error.generic")); setStep("error"); }
  }

  async function cancel() {
    if (topup && step === "qr") { try { await provider.cancel(topup.id); } catch { /* closing anyway */ } }
    onClose();
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => { if (step === "qr") { e.preventDefault(); void cancel(); } }}
      aria-labelledby="topup-title"
      className="item-dialog m-0 mt-auto w-full max-w-none rounded-t-3xl bg-surface p-0 text-foreground shadow-2xl sm:m-auto sm:max-w-sm sm:rounded-3xl"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 id="topup-title" className="text-lg font-bold">{t("topup.title", { amount: money(amount) })}</h2>
        <button type="button" onClick={cancel} aria-label={t("common.close")} className="grid h-9 w-9 place-items-center rounded-full text-lg hover:bg-brand-soft">✕</button>
      </div>

      <div className="max-h-[80dvh] overflow-y-auto p-5">
        {(step === "choose" || step === "starting") && (
          <div className="space-y-4">
            <p className="text-sm font-semibold">{t("topup.chooseMethod")}</p>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-brand bg-brand-soft p-3">
              <input type="radio" name="topup-method" defaultChecked className="h-4 w-4 accent-[var(--brand)]" />
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-red-600 text-xs font-extrabold text-white" aria-hidden>KHQR</span>
              <span className="flex-1">
                <span className="block font-semibold">Bakong KHQR</span>
                <span className="block text-xs text-muted">{t("topup.methodText")}</span>
              </span>
            </label>
            <button onClick={start} disabled={step === "starting"} className="btn-primary w-full">
              {step === "starting" ? t("common.loading") : t("topup.continue", { amount: money(amount) })}
            </button>
          </div>
        )}

        {step === "qr" && topup && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted">{t("topup.scan")}</p>
            <div className="mx-auto w-fit rounded-2xl border-4 border-red-600 bg-white p-3">
              <p className="mb-2 text-xs font-extrabold tracking-widest text-red-600">KHQR</p>
              {qrImage
                // eslint-disable-next-line @next/next/no-img-element -- a generated data: image, nothing to optimise
                ? <img src={qrImage} alt={t("topup.qrAlt", { amount: money(topup.amount) })} width={200} height={200} className="h-[200px] w-[200px]" />
                : <div className="h-[200px] w-[200px] animate-pulse rounded bg-zinc-200" aria-busy />}
              <p className="mt-2 text-lg font-bold text-black">{money(topup.amount)}</p>
            </div>
            <p className="flex items-center justify-center gap-2 text-sm font-medium" aria-live="polite">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand" aria-hidden />
              {t("topup.waiting")} · {mm}:{ss}
            </p>
            {provider.simulatePaid && (
              // Demo provider only: completes the top-up without a real bank payment.
              <button
                onClick={() => provider.simulatePaid!(topup.id).then(handleUpdate)}
                className="btn-outline h-10 w-full text-sm"
              >✅ {t("topup.simulate")}</button>
            )}
            <button onClick={cancel} className="text-sm text-muted underline hover:text-red-600">{t("topup.cancel")}</button>
          </div>
        )}

        {step === "paid" && topup && (
          <div className="space-y-3 py-4 text-center">
            <p className="text-5xl" aria-hidden>✅</p>
            <p className="text-lg font-bold">{t("topup.success", { amount: money(topup.amount) })}</p>
            <p className="text-xs text-muted">{t("topup.reference", { id: topup.id })}</p>
            <button onClick={onClose} className="btn-primary mt-2 w-full">{t("topup.done")}</button>
          </div>
        )}

        {(step === "expired" || step === "error") && (
          <div className="space-y-3 py-4 text-center">
            <p className="text-5xl" aria-hidden>{step === "expired" ? "⌛" : "⚠️"}</p>
            <p className="font-semibold">{step === "expired" ? t("topup.expired") : error}</p>
            <div className="flex gap-2">
              <button onClick={start} className="btn-primary flex-1">{t("errorPage.retry")}</button>
              <button onClick={onClose} className="btn-outline flex-1">{t("common.close")}</button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
