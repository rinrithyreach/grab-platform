"use client";

import Link from "next/link";
import { redirect } from "next/navigation";
import { useRef, useState } from "react";
import { errorMessage, useAuth } from "@/lib/auth";
import type { User } from "@/lib/api";
import { money } from "@/lib/brand";
import { isValidAddress } from "@/lib/cart";
import { useT } from "@/lib/i18n";
import { removeAddress, saveAddress, useProfile, type AddressLabel } from "@/lib/profile";
import { toast } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";
import BackButton from "@/components/BackButton";
import { LanguagePicker, ThemePicker } from "@/components/SettingsMenu";
import ProfilePhotoEditor from "@/components/ProfilePhotoEditor";
import Icon from "@/components/Icon";
import UseMyLocation from "@/components/UseMyLocation";

const LABELS: { value: AddressLabel; icon: string }[] = [
  { value: "other", icon: "📍" },
];

function AddressRow({ label, icon, saved }: { label: AddressLabel; icon: string; saved?: string }) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(saved ?? "");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = `addr-${label}`;

  function close() {
    setEditing(false); setText(saved ?? ""); setError(false);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidAddress(text)) { setError(true); return; }
    saveAddress(label, text.trim());
    setEditing(false);
    toast(t("profile.saved"));
  }

  return (
    <li className="py-4">
      {editing ? (
        <form onSubmit={save} className="space-y-3">
          <label htmlFor={id} className="text-sm font-semibold">{icon} {t(`profile.${label}`)}</label>
          {/* Two ways in: type it, or tap to fill it from the device location. */}
          <input
            ref={inputRef}
            id={id} className={`input ${error ? "border-red-500" : ""}`} value={text} autoFocus autoComplete="street-address" maxLength={300}
            placeholder={t("cart.addressPh")} aria-invalid={error} aria-describedby={error ? `${id}-err` : undefined}
            onChange={(e) => { setText(e.target.value); if (error && isValidAddress(e.target.value)) setError(false); }}
          />
          <UseMyLocation cancelOn={text} onDetected={(found) => { setText(found); setError(false); inputRef.current?.focus(); }} />
          {error && <p id={`${id}-err`} role="alert" className="text-sm text-red-600 dark:text-red-400">{t("cart.addressInvalid")}</p>}
          <div className="flex gap-2">
            <button className="btn-primary h-10 flex-1 text-sm sm:flex-none sm:px-6">{t("profile.save")}</button>
            <button type="button" className="btn-outline h-10 flex-1 text-sm sm:flex-none sm:px-6" onClick={close}>{t("common.cancel")}</button>
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

/** Same shape as the real profile, shown while the saved login is checked, so the page doesn't jump on refresh. */
function ProfileSkeleton() {
  const { t } = useT();
  const bar = "rounded bg-border";
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton href="/" />
      <h1 className="text-3xl font-bold">{t("profile.title")}</h1>
      <p role="status" className="sr-only">{t("merchant.loading")}</p>
      <div className="animate-pulse" aria-hidden>
        <section className="card mt-6 flex items-center gap-4 p-5">
          <span className="h-14 w-14 shrink-0 rounded-full bg-border" />
          <div className="flex-1 space-y-2"><div className={`h-5 w-40 ${bar}`} /><div className={`h-4 w-28 ${bar}`} /></div>
          <span className="h-10 w-20 rounded-full bg-border" />
        </section>
        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card space-y-2 p-4"><div className={`mx-auto h-7 w-12 ${bar}`} /><div className={`mx-auto h-4 w-20 ${bar}`} /></div>
          ))}
        </section>
        <section className="card mt-4 p-5">
          <div className={`h-6 w-36 ${bar}`} />
          {LABELS.map(({ value }) => (
            <div key={value} className="flex items-center gap-3 py-4">
              <span className="h-10 w-10 shrink-0 rounded-full bg-border" />
              <div className="flex-1 space-y-2"><div className={`h-4 w-24 ${bar}`} /><div className={`h-4 w-48 ${bar}`} /></div>
            </div>
          ))}
        </section>
        <section className="card mt-4 space-y-4 p-5">
          <div className={`h-6 w-28 ${bar}`} />
          {[0, 1, 2].map((i) => <div key={i} className="space-y-2"><div className={`h-4 w-24 ${bar}`} /><div className="h-10 rounded-xl bg-border" /></div>)}
        </section>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, ready } = useAuth();
  if (user?.role === "Merchant") redirect("/merchant");
  if (!ready) return <ProfileSkeleton />;
  return <CustomerProfilePage />;
}

function CustomerProfilePage() {
  const { t } = useT();
  const { user, ready, logout } = useAuth();
  const { addresses } = useProfile();
  const { balance, hasWallet } = useWallet(user?.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton href="/" />
      <h1 className="text-3xl font-bold">{t("profile.title")}</h1>

      <div className="content-fade-in">
      {/* Account */}
      <section className="card mt-6 flex flex-wrap items-start gap-4 p-5 sm:items-center">
        {user ? (
          // Tap the photo to change it; name and phone sit beside it.
          <ProfilePhotoEditor key={user.id} user={user}>
            <p className="truncate text-lg font-bold">{user.fullName}</p>
            <p className="truncate text-sm text-muted">{user.phoneNumber}</p>
          </ProfilePhotoEditor>
        ) : (
          <>
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-soft text-2xl" aria-hidden>👤</span>
            <p className="min-w-0 flex-1 text-lg font-bold">{t("profile.guest")}</p>
          </>
        )}
        {user
          ? <button onClick={logout} className="btn-outline h-10 text-sm">{t("nav.logout")}</button>
          : <Link href="/login" className="btn-primary h-10 text-sm">{t("nav.login")}</Link>}
      </section>

      {/* Show the account wallet only after sign-in. */}
      {user && hasWallet && <Link href="/wallet" className="card group mt-4 flex items-center gap-4 p-5 transition hover:border-brand hover:shadow-md">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon name="wallet" className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-muted">{t("wallet.name")}</span>
          <span className="block text-2xl font-bold tabular-nums">{money(balance)}</span>
        </span>
        <span className="btn-primary pointer-events-none h-10 shrink-0 px-4 text-sm">
          + {t("wallet.topUp")}
        </span>
      </Link>}

      {/* Saved addresses */}
      <section id="addresses" className="card mt-4 scroll-mt-24 p-5">
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
        <LanguagePicker />
        <ThemePicker />
      </section>
      </div>
    </div>
  );
}
