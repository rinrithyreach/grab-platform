"use client";

import Link from "next/link";
import { redirect } from "next/navigation";
import { useState } from "react";
import { errorMessage, useAuth } from "@/lib/auth";
import type { User } from "@/lib/api";
import { money } from "@/lib/brand";
import { isValidAddress, useShop } from "@/lib/cart";
import { useT, type MessageKey } from "@/lib/i18n";
import { removeAddress, saveAddress, useProfile, type AddressLabel } from "@/lib/profile";
import { updateSettings, useSettings } from "@/lib/settings";
import { toast } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";
import BackButton from "@/components/BackButton";
import { LANGS, Segmented, THEMES } from "@/components/SettingsMenu";

const LABELS: { value: AddressLabel; icon: string }[] = [
  { value: "home", icon: "🏠" },
  { value: "work", icon: "💼" },
  { value: "other", icon: "📍" },
];

function AddressRow({ label, icon, saved }: { label: AddressLabel; icon: string; saved?: string }) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(saved ?? "");
  const [error, setError] = useState(false);
  const id = `addr-${label}`;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidAddress(text)) { setError(true); return; }
    saveAddress(label, text);
    setEditing(false);
    toast(t("profile.saved"));
  }

  return (
    <li className="py-4">
      {editing ? (
        <form onSubmit={save} className="space-y-2">
          <label htmlFor={id} className="text-sm font-semibold">{icon} {t(`profile.${label}`)}</label>
          <input
            id={id} className={`input ${error ? "border-red-500" : ""}`} value={text} autoFocus
            placeholder={t("cart.addressPh")} aria-invalid={error} aria-describedby={error ? `${id}-err` : undefined}
            onChange={(e) => { setText(e.target.value); if (error && isValidAddress(e.target.value)) setError(false); }}
          />
          {error && <p id={`${id}-err`} role="alert" className="text-sm text-red-600 dark:text-red-400">{t("cart.addressInvalid")}</p>}
          <div className="flex gap-2">
            <button className="btn-primary h-9 text-sm">{t("profile.save")}</button>
            <button type="button" className="btn-outline h-9 text-sm" onClick={() => { setEditing(false); setText(saved ?? ""); setError(false); }}>{t("common.cancel")}</button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-lg" aria-hidden>{icon}</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t(`profile.${label}`)}</p>
            <p className="truncate text-sm text-muted">{saved ?? t("profile.notSet")}</p>
          </div>
          <button onClick={() => setEditing(true)} className="-m-2 rounded-lg p-2 text-sm font-semibold text-brand hover:bg-brand-soft">{t(saved ? "profile.edit" : "profile.add")}</button>
          {saved && <button onClick={() => { removeAddress(label); toast(t("profile.removed"), "info"); }} className="text-sm text-muted hover:text-red-600">{t("profile.remove")}</button>}
        </div>
      )}
    </li>
  );
}

function NameEditor({ user }: { user: User }) {
  const { t } = useT();
  const { updateProfile } = useAuth();
  const [name, setName] = useState(user.fullName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const fullName = name.trim();
    if (fullName.length < 2 || fullName.length > 120 || /\p{Cc}/u.test(fullName)) { setError(t("profile.nameInvalid")); return; }
    setBusy(true); setError("");
    try {
      const updated = await updateProfile(fullName);
      setName(updated.fullName);
      toast(t("profile.nameSaved"));
    } catch (err) { setError(errorMessage(err, t)); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="border-b border-border pb-4">
      <label htmlFor="profile-full-name" className="label">{t("profile.name")}</label>
      <div className="flex gap-2">
        <input id="profile-full-name" name="fullName" className="input min-w-0 flex-1" autoComplete="name" required minLength={2} maxLength={120} value={name} disabled={busy} onChange={(e) => { setName(e.target.value); setError(""); }} aria-invalid={!!error} aria-describedby={error ? "profile-name-error" : undefined} />
        <button className="btn-primary shrink-0" disabled={busy || name.trim() === user.fullName}>{t(busy ? "profile.saving" : "profile.save")}</button>
      </div>
      {error && <p id="profile-name-error" role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}

export default function ProfilePage() {
  const { user, ready } = useAuth();
  const { t } = useT();
  if (user?.role === "Merchant") redirect("/merchant");
  if (!ready) return <p role="status" className="mx-auto max-w-3xl px-4 py-8 text-muted">{t("merchant.loading")}</p>;
  return <CustomerProfilePage />;
}

function CustomerProfilePage() {
  const { t } = useT();
  const { user, ready, logout } = useAuth();
  const { addresses } = useProfile();
  const { orders } = useShop();
  const { balance, hasWallet } = useWallet(user?.id);
  const settings = useSettings();

  const shortcuts: { href: string; label: MessageKey; value: string }[] = [
    { href: "/orders", label: "nav.myOrders", value: String(orders.length) },
    { href: "/rides", label: "nav.myRides", value: "→" },
    { href: "/deliveries", label: "nav.deliveries", value: "📦" },
<<<<<<< HEAD
    { href: "/wallet", label: "wallet.name", value: money(user ? balance : 0) },
=======
    // Guests have no wallet: the shortcut asks them to log in instead of showing a balance.
    hasWallet
      ? { href: "/wallet", label: "wallet.name", value: money(balance) }
      : { href: "/login", label: "wallet.name", value: `🔒 ${t("nav.login")}` },
>>>>>>> 1409ee1dff8bf62f005fe273c0860be84ef333ca
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton href="/" />
      <h1 className="text-3xl font-bold">{t("profile.title")}</h1>

      {/* Account */}
      <section className="card mt-6 flex flex-wrap items-center gap-4 p-5">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand text-2xl font-bold text-white dark:text-background" aria-hidden>
          {user ? user.fullName[0]?.toUpperCase() : "👤"}
        </span>
        <div className="min-w-0 flex-1">
          {user ? (
            <>
              <p className="text-lg font-bold">{user.fullName}</p>
              <p className="truncate text-sm text-muted">{user.phoneNumber}</p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold">{t("profile.guest")}</p>
            </>
          )}
        </div>
        {user
          ? <button onClick={logout} className="btn-outline h-10 text-sm">{t("nav.logout")}</button>
          : <Link href="/login" className="btn-primary h-10 text-sm">{t("nav.login")}</Link>}
      </section>

      {/* Shortcuts */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href} className="card p-4 text-center transition-shadow hover:shadow-md">
            <p className="text-lg font-bold text-brand">{s.value}</p>
            <p className="text-sm text-muted">{t(s.label)}</p>
          </Link>
        ))}
      </section>

      {/* Saved addresses */}
      <section className="card mt-4 p-5">
        <h2 className="text-lg font-bold">{t("profile.addresses")}</h2>
        <ul className="divide-y divide-border">
          {LABELS.map((l) => (
            <AddressRow
              key={`${l.value}-${addresses.find((a) => a.label === l.value)?.text ?? ""}`}
              label={l.value} icon={l.icon}
              saved={addresses.find((a) => a.label === l.value)?.text}
            />
          ))}
        </ul>
      </section>

      {/* Settings */}
      <section className="card mt-4 space-y-4 p-5">
        <h2 className="text-lg font-bold">{t("settings.title")}</h2>
        {ready && user && <NameEditor key={user.id} user={user} />}
        <Segmented label={t("settings.language")} value={settings.lang} options={LANGS} onChange={(lang) => updateSettings({ lang })} />
        <Segmented
          label={t("settings.theme")}
          value={settings.theme}
          options={THEMES.map((th) => ({ value: th.value, label: `${th.icon} ${t(`settings.${th.value}`)}` }))}
          onChange={(theme) => updateSettings({ theme })}
        />
      </section>
    </div>
  );
}
