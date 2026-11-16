"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import BackButton from "@/components/BackButton";
import { normalizePhoneNumber } from "@/lib/phone";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useT();
  const { register } = useAuth();
  const [form, setForm] = useState({ phoneNumber: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const field = (key: keyof typeof form) => ({
    id: key,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const phoneNumber = normalizePhoneNumber(form.phoneNumber);
    if (!phoneNumber) { setPhoneError(true); document.getElementById("phoneNumber")?.focus(); return; }
    setBusy(true); setError("");
    try {
      await register({ phoneNumber, password: form.password });
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <BackButton href="/login" />
      <form onSubmit={submit} className="card space-y-4 p-6 sm:p-8">
        <div>
          <h1 className="text-2xl font-bold">{t("register.title")}</h1>
          <p className="mt-1 text-muted">{t("register.subtitle")}</p>
        </div>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
        <div>
          <label className="label" htmlFor="phoneNumber">{t("auth.phone")}</label>
          <input id="phoneNumber" name="phoneNumber" type="tel" inputMode="tel" required maxLength={30} autoComplete="username" className="input" placeholder="012345678" value={form.phoneNumber} onChange={(e) => { setForm({ ...form, phoneNumber: e.target.value }); setPhoneError(false); }} aria-invalid={phoneError} aria-describedby={phoneError ? "phone-error" : undefined} />
          {phoneError && <p id="phone-error" role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{t("auth.phoneInvalid")}</p>}
        </div>
        <div>
          <label className="label" htmlFor="password">{t("auth.password")}</label>
          <div className="relative">
            <input name="password" type={showPassword ? "text" : "password"} required minLength={12} maxLength={128} autoComplete="new-password" className="input pr-24" {...field("password")} />
            <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-controls="password" aria-pressed={showPassword} aria-label={t(showPassword ? "auth.hidePassword" : "auth.showPassword")} className="absolute inset-y-0 right-2 px-2 text-sm font-semibold text-brand">{t(showPassword ? "auth.hide" : "auth.show")}</button>
          </div>
          <p className="mt-1 text-xs text-muted">{t("register.passwordHint")}</p>
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? t("register.busy") : t("register.submit")}</button>
        <p className="text-center text-sm text-muted">
          {t("register.haveAccount")} <Link href="/login" className="font-semibold text-brand">{t("nav.login")}</Link>
        </p>
      </form>
    </div>
  );
}
