"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import BackButton from "@/components/BackButton";
import { BRAND } from "@/lib/brand";
import { normalizePhoneNumber } from "@/lib/phone";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useT();
  const { login } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const phone = normalizePhoneNumber(phoneNumber);
    if (!phone) { setPhoneError(true); document.getElementById("phoneNumber")?.focus(); return; }
    setBusy(true); setError("");
    try {
      await login(phone, password);
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <BackButton href="/" />
      <form onSubmit={submit} className="card space-y-4 p-6 sm:p-8">
        <div>
          <h1 className="text-2xl font-bold">{t("login.title")}</h1>
          <p className="mt-1 text-muted">{t("login.subtitle", { brand: BRAND.name })}</p>
        </div>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
        <div>
          <label className="label" htmlFor="phoneNumber">{t("auth.phone")}</label>
          <input id="phoneNumber" name="phoneNumber" type="tel" inputMode="tel" required maxLength={30} autoComplete="username" className="input" placeholder="012345678" value={phoneNumber} onChange={(e) => { setPhoneNumber(e.target.value); setPhoneError(false); }} aria-invalid={phoneError} aria-describedby={phoneError ? "phone-error" : undefined} />
          {phoneError && <p id="phone-error" role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{t("auth.phoneInvalid")}</p>}
        </div>
        <div>
          <label className="label" htmlFor="password">{t("auth.password")}</label>
          <div className="relative">
            <input id="password" name="password" type={showPassword ? "text" : "password"} required maxLength={128} autoComplete="current-password" className="input pr-24" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-controls="password" aria-pressed={showPassword} aria-label={t(showPassword ? "auth.hidePassword" : "auth.showPassword")} className="absolute inset-y-0 right-2 px-2 text-sm font-semibold text-brand">{t(showPassword ? "auth.hide" : "auth.show")}</button>
          </div>
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? t("login.busy") : t("login.submit")}</button>
        <p className="text-center text-sm text-muted">
          {t("login.newHere")} <Link href="/register" className="font-semibold text-brand">{t("login.createAccount")}</Link>
        </p>
      </form>
    </div>
  );
}
