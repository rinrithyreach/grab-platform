"use client";

import Link from "next/link";
import { useState } from "react";
import { errorMessage, useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { MERCHANT_SERVICES } from "@/lib/merchant";
import { normalizePhoneNumber } from "@/lib/phone";
import MerchantDashboard from "@/components/MerchantDashboard";
import { DashboardSkeleton } from "@/components/Skeleton";

export default function MerchantPage() {
  const { api, user, ready } = useAuth();
  const { t } = useT();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizePhoneNumber(phone);
    if (!normalized) { setError(t("auth.phoneInvalid")); return; }
    setBusy(true); setError("");
    try {
      const user = await api.merchantLogin(normalized, password);
      const name = user.fullName.trim() && user.fullName.trim() !== "Customer" ? user.fullName.trim() : user.phoneNumber;
      toast(t("notify.welcomeBack", { name }));
    }
    catch (err) { setError(errorMessage(err, t)); }
    finally { setBusy(false); }
  }

  if (!ready) return <DashboardSkeleton />;
  if (user?.role === "Merchant") return <MerchantDashboard key={user.id} />;

  return <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
    <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16">
      <div>
        <p className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">{t("merchant.badge")}</p>
        <h1 className="mt-5 max-w-xl text-4xl font-extrabold leading-tight sm:text-5xl">{t("merchant.title")}</h1>
        <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">{t("merchant.intro")}</p>
        <div className="mt-8 grid grid-cols-3 gap-3">{MERCHANT_SERVICES.map((s) => <div key={s.id} className="card px-2 py-5 text-center"><span className="text-3xl" aria-hidden>{s.emoji}</span><p className="mt-2 text-sm font-bold">{s.id}</p></div>)}</div>
        <ol className="mt-8 space-y-3 text-sm font-medium">{(["merchant.step1", "merchant.step2", "merchant.step3"] as const).map((key, i) => <li key={key} className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft font-bold text-brand">{i + 1}</span>{t(key)}</li>)}</ol>
      </div>
      <form onSubmit={signIn} className="card space-y-5 p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold">{t("merchant.signIn")}</h2>
        {user && <p className="text-sm text-muted">{t("merchant.switch")}</p>}
        <fieldset disabled={busy} className="space-y-5">
          <div><label className="label" htmlFor="merchant-login-phone">{t("auth.phone")}</label><input id="merchant-login-phone" type="tel" className="input" required maxLength={30} autoComplete="username" placeholder="012345678" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><label className="label" htmlFor="merchant-login-password">{t("auth.password")}</label><div className="relative"><input id="merchant-login-password" className="input pr-24" type={show ? "text" : "password"} required maxLength={128} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" aria-controls="merchant-login-password" aria-pressed={show} className="absolute inset-y-0 right-3 text-sm font-semibold text-brand" onClick={() => setShow(!show)}>{t(show ? "auth.hide" : "auth.show")}</button></div></div>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
          <button className="btn-primary w-full">{t(busy ? "login.busy" : "merchant.signIn")}</button>
        </fieldset>
        <p className="border-t border-border pt-5 text-center text-sm text-muted">{t("merchant.new")} <Link href="/merchant/register" className="font-semibold text-brand">{t("merchant.register")}</Link></p>
      </form>
    </div>
  </div>;
}
