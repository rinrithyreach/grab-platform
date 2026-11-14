"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import BackButton from "@/components/BackButton";
import { BRAND } from "@/lib/brand";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useT();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await login(email.trim(), password);
      router.push("/ride");
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
          <label className="label" htmlFor="email">{t("auth.email")}</label>
          <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">{t("auth.password")}</label>
          <input id="password" type="password" required autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? t("login.busy") : t("login.submit")}</button>
        <p className="text-center text-sm text-muted">
          {t("login.newHere")} <Link href="/register" className="font-semibold text-brand">{t("login.createAccount")}</Link>
        </p>
      </form>
    </div>
  );
}
