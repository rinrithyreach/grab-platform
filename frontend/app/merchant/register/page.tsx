"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import MerchantProfileFields from "@/components/MerchantProfileFields";
import { errorMessage, useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { EMPTY_MERCHANT_PROFILE, merchantRegistrationProfile } from "@/lib/merchant";
import { normalizePhoneNumber } from "@/lib/phone";
import { validRideWorkSchedule } from "@/lib/ride-work-schedule";

export default function MerchantRegisterPage() {
  const { api } = useAuth();
  const { t } = useT();
  const router = useRouter();
  const [profile, setProfile] = useState(EMPTY_MERCHANT_PROFILE);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ride = profile.service === "GrabRide";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const phoneNumber = normalizePhoneNumber(phone);
    if (!profile.address.trim()) { setError(t("merchant.location.required")); return; }
    if (!validRideWorkSchedule(profile.openingHours)) { setError(t("merchant.workInvalid")); return; }
    if (!phoneNumber || (!ride && !normalizePhoneNumber(profile.contactPhone))) { setError(t("auth.phoneInvalid")); return; }
    if (!ride && password !== confirm) { setError(t("merchant.passwordMismatch")); return; }
    setBusy(true); setError("");
    try {
      await api.merchantRegister({ phoneNumber, password, profile: merchantRegistrationProfile(profile) });
      router.replace("/merchant");
    } catch (err) { setError(errorMessage(err, t)); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-3xl px-4 py-8">
    <Link href="/merchant" className="text-sm font-semibold text-brand">← {t("merchant.signIn")}</Link>
    <h1 className="mt-5 text-3xl font-bold">{t("merchant.register")}</h1>
    <p className="mt-2 text-muted">{t("merchant.intro")}</p>
    <form onSubmit={submit} className="card mt-6 p-5 sm:p-8">
      <fieldset disabled={busy} className="space-y-8">
        <section><h2 className="mb-5 text-xl font-bold">{t(ride ? "merchant.riderInformation" : "merchant.business")}</h2><MerchantProfileFields value={profile} onChange={setProfile} hideRidePhone allowServiceSelection /></section>
        <section className="space-y-4 border-t border-border pt-6">
          <h2 className="text-xl font-bold">{t("merchant.account")}</h2>
          <div><label className="label" htmlFor="merchant-signup-phone">{t("auth.phone")}</label><input id="merchant-signup-phone" name="phoneNumber" className="input" type="tel" required maxLength={30} autoComplete="username" aria-describedby="merchant-phone-hint" value={phone} onChange={(e) => setPhone(e.target.value)} /><p id="merchant-phone-hint" className="mt-1 text-xs text-muted">{t("merchant.phoneHint")}</p></div>
          <div><label className="label" htmlFor="merchant-signup-password">{t("auth.password")}</label><div className="relative"><input id="merchant-signup-password" name="password" className="input pr-24" type={show ? "text" : "password"} required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" className="absolute inset-y-0 right-3 text-sm font-semibold text-brand" aria-controls="merchant-signup-password" aria-pressed={show} onClick={() => setShow(!show)}>{t(show ? "auth.hide" : "auth.show")}</button></div><p className="mt-1 text-xs text-muted">{t("register.passwordHint")}</p></div>
          {!ride && <div><label className="label" htmlFor="merchant-confirm-password">{t("merchant.confirmPassword")}</label><input id="merchant-confirm-password" className="input" type={show ? "text" : "password"} required minLength={12} maxLength={128} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>}
        </section>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
        <button className="btn-primary w-full">{t(busy ? "register.busy" : "merchant.register")}</button>
      </fieldset>
    </form>
    <p className="mt-5 text-center text-sm text-muted">{t("merchant.existing")} <Link href="/merchant" className="font-semibold text-brand">{t("merchant.signIn")}</Link></p>
  </div>;
}
