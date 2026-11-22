"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MerchantDashboard as Dashboard, MerchantListing, MerchantProfile, MerchantProfileRequest } from "@/lib/api";
import CategoryPicker from "./CategoryPicker";
import { errorMessage, useAuth } from "@/lib/auth";
import { money } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { validRideWorkSchedule } from "@/lib/ride-work-schedule";
import MerchantProfileFields from "./MerchantProfileFields";
import MerchantOfferCard from "./MerchantOfferCard";
import RideWorkSchedule from "./RideWorkSchedule";
import MerchantRideRequests from "./MerchantRideRequests";
import MerchantOrders from "./MerchantOrders";

function WorkScheduleEditor({ profile, onSaved }: { profile: MerchantProfile; onSaved: (value: MerchantProfile) => void }) {
  const { api } = useAuth();
  const { t } = useT();
  const [hours, setHours] = useState(profile.openingHours);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validRideWorkSchedule(hours)) { setError(t("merchant.workInvalid")); return; }
    setBusy(true); setError("");
    try {
      onSaved(await api.updateMerchantProfile({ ...profile, openingHours: hours }));
      toast(t("merchant.saved"));
    } catch (err) { setError(errorMessage(err, t)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="card mt-6 p-5 sm:p-7"><fieldset disabled={busy} className="space-y-5">
    <RideWorkSchedule value={hours} onChange={setHours} />
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    <button className="btn-primary">{t(busy ? "merchant.saving" : "merchant.saveWorkSchedule")}</button>
  </fieldset></form>;
}

function ProfileEditor({ initial, onSaved }: { initial: MerchantProfile; onSaved: (value: MerchantProfile) => void }) {
  const { api } = useAuth();
  const { t } = useT();
  const [profile, setProfile] = useState<MerchantProfileRequest>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile.address.trim()) { setError(t("merchant.location.required")); return; }
    if (profile.service !== "GrabRide" && profile.openingHours !== initial.openingHours && !validRideWorkSchedule(profile.openingHours)) { setError(t("merchant.workInvalid")); return; }
    setBusy(true); setError("");
    try {
      onSaved(await api.updateMerchantProfile({ ...profile, email: profile.email?.trim() || null,
        openingHours: profile.service === "GrabRide" && initial.service === "GrabRide" ? initial.openingHours : profile.openingHours }));
      toast(t("merchant.saved"));
    } catch (err) { setError(errorMessage(err, t)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="card mt-6 p-5 sm:p-7"><fieldset disabled={busy} className="space-y-5">
    <h2 className="text-xl font-bold">{t(profile.service === "GrabRide" ? "merchant.riderInformation" : "merchant.profile")}</h2>
    <MerchantProfileFields value={profile} onChange={setProfile} showRideSchedule={false} />
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    <button className="btn-primary">{t(busy ? "merchant.saving" : profile.service === "GrabRide" ? "merchant.saveRiderProfile" : "merchant.saveProfile")}</button>
  </fieldset></form>;
}

function ListingEditor({ profile, initial, onSaved, onCancel }: {
  profile: MerchantProfile; initial?: MerchantListing; onSaved: (value: MerchantListing) => void; onCancel: () => void;
}) {
  const { api } = useAuth();
  const { t } = useT();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial?.price.toString() ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? null);
  const [published, setPublished] = useState(initial?.isPublished ?? false);
  const [featured, setFeatured] = useState(initial?.showInSlideshow ?? false);
  const [image, setImage] = useState({ id: initial?.imageId ?? "", imageUrl: initial?.imageUrl ?? "" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0];
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type) || next.size > 2 * 1024 * 1024 || !next.size) {
      setError(t("merchant.imageError")); e.target.value = ""; return;
    }
    setFile(next); setPreview(URL.createObjectURL(next)); setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!image.id && !file) { setError(t("merchant.imageRequired")); return; }
    setBusy(true); setError("");
    try {
      let uploaded = image;
      if (file) {
        setUploading(true);
        uploaded = await api.uploadMerchantImage(file);
        setImage(uploaded); setFile(null); setUploading(false);
      }
      const saved = await api.saveMerchantListing({ title, description, price: Number(price), categoryId, imageId: uploaded.id, isPublished: published, showInSlideshow: featured }, initial?.id);
      onSaved(saved); toast(t("merchant.saved"));
    } catch (err) { setError(errorMessage(err, t)); }
    finally { setBusy(false); setUploading(false); }
  }

  return <section className="card mt-6 p-5 sm:p-7" aria-label={t(initial ? "merchant.editListing" : "merchant.newListing")}>
    <h2 className="text-xl font-bold">{t(initial ? "merchant.editListing" : "merchant.newListing")}</h2>
    <div className="mt-5 grid items-start gap-8 lg:grid-cols-[1.2fr_1fr]">
      <form onSubmit={submit}><fieldset disabled={busy} className="space-y-5">
        <div><label className="label" htmlFor="listing-title">{t("merchant.listingTitle")}</label><input id="listing-title" className="input" required minLength={2} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className="label" htmlFor="listing-description">{t("merchant.listingDescription")}</label><textarea id="listing-description" className="input h-auto min-h-28 py-3" required minLength={10} maxLength={1500} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div><label className="label" htmlFor="listing-price">{t("merchant.price")}</label><input id="listing-price" className="input" type="number" inputMode="decimal" required min="0.01" max="999999.99" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        {profile.service !== "GrabRide" && <CategoryPicker service={profile.service} value={categoryId} onChange={setCategoryId} />}
        <div><label className="label" htmlFor="listing-image">{t("merchant.image")}</label><input id="listing-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} aria-describedby="listing-image-hint" className="block w-full rounded-xl border border-border p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand" /><p id="listing-image-hint" className="mt-2 text-xs text-muted">{t("merchant.imageHint")}</p></div>
        <div className="space-y-3 rounded-xl bg-brand-soft p-4">
          <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-brand" checked={published} onChange={(e) => setPublished(e.target.checked)} />{t("merchant.publish")}</label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />{t("merchant.slideshow")}</label>
          <p className="text-xs leading-relaxed text-muted">{t("merchant.slideshowHint")}</p>
        </div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex flex-wrap gap-3"><button className="btn-primary">{t(uploading ? "merchant.uploading" : busy ? "merchant.saving" : "merchant.saveListing")}</button><button type="button" className="btn-outline" onClick={onCancel}>{t("merchant.cancel")}</button></div>
      </fieldset></form>
      <aside><h3 className="font-semibold">{t("merchant.preview")}</h3><p className="mb-4 mt-1 text-xs text-muted">{t("merchant.previewHint")}</p><MerchantOfferCard preview offer={{ id: "preview", title: title || t("merchant.listingTitle"), description: description || t("merchant.listingDescription"), price: Number(price), imageUrl: preview || image.imageUrl, merchant: profile }} /></aside>
    </div>
  </section>;
}

export default function MerchantDashboard() {
  const { api } = useAuth();
  const { t } = useT();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  // Orders first: that is where new customer orders arrive.
  const [tab, setTab] = useState<"orders" | "listings" | "profile">("orders");
  const [pending, setPending] = useState(0);
  const [editor, setEditor] = useState<MerchantListing | "new" | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api.merchantDashboard(ctrl.signal).then((result) => { setData(result); setError(""); })
      .catch((err) => { if (!ctrl.signal.aborted) setError(errorMessage(err, t)); });
    return () => ctrl.abort();
  }, [api, t, retry]);

  useEffect(() => {
    if (tab !== "listings" || editor !== null || data?.profile.service === "GrabRide") return;
    const ctrl = new AbortController();
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try { setData(await api.merchantDashboard(ctrl.signal)); } catch { /* keep the last successful dashboard */ }
      finally { busy = false; }
    };
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, 5000);
    window.addEventListener("focus", refresh);
    return () => { ctrl.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [api, tab, editor, data?.profile.service]);

  if (!data) return <div className="mx-auto max-w-6xl px-4 py-10">{error ? <div className="card space-y-4 p-6"><p role="alert">{error}</p><button className="btn-outline" onClick={() => { setError(""); setRetry((n) => n + 1); }}>{t("merchant.retry")}</button></div> : <p role="status">{t("merchant.loading")}</p>}</div>;

  if (data.profile.service === "GrabRide") return <div className="mx-auto max-w-4xl px-4 py-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold text-brand">GrabRide · {data.profile.ownerName}</p><h1 className="mt-2 text-3xl font-bold">{t("merchant.rideDashboard")}</h1><p className="mt-2 text-muted">{t("merchant.rideDashboardIntro")}</p></div>
      <Link href="/" className="btn-outline text-sm">{t("merchant.viewHome")} ↗</Link>
    </div>
    <MerchantRideRequests key={`${data.profile.id}-requests`} />
    <WorkScheduleEditor key={data.profile.id} profile={data.profile} onSaved={(profile) => setData((previous) => previous ? { ...previous, profile } : previous)} />
    <ProfileEditor key={`${data.profile.id}-profile`} initial={data.profile} onSaved={(profile) => setData((previous) => previous ? { ...previous, profile } : previous)} />
  </div>;

  const publishedCount = data.listings.filter((l) => l.isPublished).length;
  return <div className="mx-auto max-w-6xl px-4 py-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold text-brand">{data.profile.service} · {data.profile.businessName}</p><h1 className="mt-2 text-3xl font-bold">{t("merchant.dashboard")}</h1><p className="mt-2 text-muted">{t("merchant.dashboardIntro")}</p></div>
      <div className="flex flex-wrap gap-2">{publishedCount > 0 && <Link href={`/partners/${data.profile.id}`} className="btn-outline text-sm">{t("merchant.viewStore")} ↗</Link>}<Link href="/" className="btn-outline text-sm">{t("merchant.viewHome")} ↗</Link></div>
    </div>
    <div className="mt-7 grid grid-cols-3 gap-3">{([
      ["merchant.total", data.listings.length], ["merchant.published", publishedCount], ["merchant.draft", data.listings.length - publishedCount],
    ] as const).map(([key, count]) => <div key={key} className="card p-4 sm:p-5"><p className="text-xs text-muted sm:text-sm">{t(key)}</p><p className="mt-1 text-3xl font-bold">{count}</p></div>)}</div>
    <div className="mt-7 flex flex-wrap gap-2 border-b border-border pb-3">{(["orders", "listings", "profile"] as const).map((item) => <button key={item} aria-pressed={tab === item} onClick={() => { setTab(item); setEditor(null); }} className={`${tab === item ? "btn-primary" : "btn-outline"} gap-2 text-sm`}>{t(item === "orders" ? "merchant.orders" : item === "listings" ? "merchant.listings" : "merchant.profile")}{item === "orders" && pending > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-black" aria-label={`${t("merchant.pendingOrders")}: ${pending}`}>{pending}</span>}</button>)}</div>
    {/* Kept mounted so the new-order count stays live on the other tabs. */}
    <div hidden={tab !== "orders"}><MerchantOrders key={data.profile.id} onPending={setPending} /></div>
    {tab === "orders" ? null : tab === "profile" ? <ProfileEditor initial={data.profile} onSaved={(profile) => setData({ ...data, profile })} /> : <>
      {editor !== null ? <ListingEditor key={editor === "new" ? "new" : editor.id} profile={data.profile} initial={editor === "new" ? undefined : editor} onCancel={() => setEditor(null)} onSaved={(listing) => {
        setData((previous) => previous ? { ...previous, listings: [listing, ...previous.listings.filter((l) => l.id !== listing.id)] } : previous); setEditor(null);
      }} /> : <>
        <div className="mt-6 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{t("merchant.listings")}</h2><button className="btn-primary text-sm" onClick={() => setEditor("new")}>+ {t("merchant.newListing")}</button></div>
        {data.listings.length === 0 ? <div className="card mt-5 p-8 text-center"><p className="text-4xl" aria-hidden>🏪</p><p className="mx-auto mt-4 max-w-lg text-muted">{t("merchant.noListings")}</p></div> : <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.listings.map((listing) => <article key={listing.id} className="card overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={listing.imageUrl} alt={listing.title} loading="lazy" className="aspect-[16/10] w-full object-cover" />
          <div className="space-y-3 p-5"><div className="flex flex-wrap gap-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${listing.isPublished ? "bg-brand-soft text-brand" : "bg-background text-muted"}`}>{t(listing.isPublished ? "merchant.published" : "merchant.draft")}</span>{listing.isPublished && listing.showInSlideshow && <span className="rounded-full bg-accent/15 px-2 py-1 text-xs">{t("merchant.featured")}</span>}</div><h3 className="break-words font-bold">{listing.title}</h3><p className="line-clamp-2 text-sm text-muted">{listing.description}</p><div className="flex items-center justify-between gap-3"><p className="font-bold">{money(listing.price)}</p><button className="btn-outline h-9 px-4 text-sm" aria-label={`${t("merchant.edit")}: ${listing.title}`} onClick={() => setEditor(listing)}>{t("merchant.edit")}</button></div></div>
        </article>)}</div>}
      </>}
    </>}
  </div>;
}
