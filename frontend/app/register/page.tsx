"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import BackButton from "@/components/BackButton";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useT();
  const { register } = useAuth();
  const [form, setForm] = useState({ fullName: "", email: "", phoneNumber: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const field = (key: keyof typeof form) => ({
    id: key,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await register({ ...form, fullName: form.fullName.trim(), email: form.email.trim() });
      router.push("/ride");
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
          <label className="label" htmlFor="fullName">{t("register.fullName")}</label>
          <input required autoComplete="name" className="input" {...field("fullName")} />
        </div>
        <div>
          <label className="label" htmlFor="email">{t("auth.email")}</label>
          <input type="email" required autoComplete="email" className="input" {...field("email")} />
        </div>
        <div>
          <label className="label" htmlFor="phoneNumber">{t("register.phone")}</label>
          <input type="tel" required autoComplete="tel" className="input" {...field("phoneNumber")} />
        </div>
        <div>
          <label className="label" htmlFor="password">{t("auth.password")}</label>
          <input type="password" required minLength={12} autoComplete="new-password" className="input" {...field("password")} />
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
