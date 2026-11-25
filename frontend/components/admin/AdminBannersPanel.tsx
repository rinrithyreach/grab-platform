"use client";

import { refreshWhileVisible } from "@/lib/visible-refresh";
import { useEffect, useState } from "react";
import type { AdminBanner } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import AdminIcon from "./AdminIcon";
import { useAdminDialog } from "./useAdminDialog";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const message = (err: unknown) => err instanceof TypeError ? "Cannot connect to the API. Check the backend and try again." : err instanceof Error ? err.message : "Something went wrong. Please try again.";

/**
 * Homepage hero banners, shown first on the customer homepage
 * (before merchant-featured listings). Viewing needs listings.view; changes need listings.manage.
 */
export default function AdminBannersPanel({ canManage, revision, onSaved }: { canManage: boolean; revision: number; onSaved: (message: string) => void }) {
  const { api } = useAuth();
  const [banners, setBanners] = useState<AdminBanner[] | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<AdminBanner | "create" | null>(null);
  const [deleting, setDeleting] = useState<AdminBanner | null>(null);

  useEffect(() => refreshWhileVisible(signal =>
    api.adminBanners(signal)
      .then(rows => { if (!signal.aborted) { setBanners(rows); setError(""); } })
      .catch(err => { if (!signal.aborted) setError(message(err)); })
  ), [api, revision, reload]);

  const done = (text: string) => { setEditing(null); setDeleting(null); setReload(v => v + 1); onSaved(text); };
  const nextPosition = banners?.length ? Math.min(999, Math.max(...banners.map(b => b.sortOrder)) + 1) : 0;

  return <section className="admin-panel admin-banners" aria-labelledby="admin-banners-title">
    <div className="admin-panel-heading">
      <div><h2 id="admin-banners-title">Homepage banners</h2><p>Your uploads appear first in the homepage slideshow, lowest position first. Use wide images, about 1600 × 480 px, and keep important content in the centre for phones.</p></div>
      {canManage && <button className="admin-button primary" onClick={() => setEditing("create")} disabled={!banners}><AdminIcon name="plus" size={17} />Upload banner</button>}
    </div>
    {error ? <div className="admin-banners-body"><div className="admin-error" role="alert">{error} <button className="admin-text-link" onClick={() => setReload(v => v + 1)}>Retry</button></div></div>
      : !banners ? <div className="admin-loading" role="status"><span className="admin-spinner" />Loading banners…</div>
      : !banners.length ? <div className="admin-banners-body"><p className="admin-notice">Upload your first banner to replace the built-in homepage promotions. Choose an image, optionally add text and a link, then leave “Show on the homepage” checked to publish it.</p></div>
      : <ul className="admin-banner-grid">{banners.map(b => <li key={b.id} className="admin-banner-card">
          {/* Banner images are served by the API, not the Next image host. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.imageUrl} alt="" className="admin-banner-thumb" />
          <div className="admin-banner-info">
            <div className="admin-banner-meta"><span className={`admin-status ${b.isActive ? "success" : "warning"}`}>{b.isActive ? "Live" : "Hidden"}</span><span className="admin-chip">Position {b.sortOrder}</span></div>
            <strong>{b.title || "Untitled banner"}</strong>
            {b.subtitle && <p>{b.subtitle}</p>}
            <p className="admin-banner-link">{b.linkUrl ? `Opens ${b.linkUrl}` : "Not clickable"}</p>
          </div>
          <div className="admin-banner-actions">
            <button className="admin-row-button" onClick={() => setEditing(b)}>{canManage ? "Edit" : "View"}</button>
            {canManage && <button className="admin-row-button danger" onClick={() => setDeleting(b)}>Delete</button>}
          </div>
        </li>)}</ul>}
    {editing && <BannerDialog banner={editing === "create" ? null : editing} position={nextPosition} canManage={canManage} onClose={() => setEditing(null)} onSaved={done} />}
    {deleting && <DeleteDialog banner={deleting} onClose={() => setDeleting(null)} onDeleted={done} />}
  </section>;
}

const useModal = useAdminDialog;

function BannerDialog({ banner, position, canManage, onClose, onSaved }: { banner: AdminBanner | null; position: number; canManage: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(banner?.imageUrl ?? "");
  const { ref, close } = useModal(onClose, busy);
  const create = !banner;

  // Revoke the local preview URL when it is replaced or the dialog closes.
  useEffect(() => () => { if (preview.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    if (!picked) return;
    if (!TYPES.includes(picked.type)) { setError("Choose a JPG, PNG or WebP image."); event.target.value = ""; return; }
    if (picked.size > MAX_BYTES) { setError("Choose an image up to 2 MB."); event.target.value = ""; return; }
    setError(""); setFile(picked); setPreview(URL.createObjectURL(picked));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? "").trim();
    if (create && !file) { setError("Choose an image for the banner."); return; }
    if (get("reason").length < 3) { setError("Enter a reason of at least 3 characters."); return; }
    setBusy(true); setError("");
    try {
      await api.adminSaveBanner({ title: get("title"), subtitle: get("subtitle"), linkUrl: get("linkUrl"), sortOrder: Number(get("sortOrder")) || 0, isActive: form.has("isActive"), reason: get("reason") }, file, banner?.id);
      onSaved(form.has("isActive")
        ? create ? "Banner uploaded. The homepage slideshow updates within a few seconds." : "Banner saved. The homepage shows the change within a few seconds."
        : "Banner saved as hidden. Enable “Show on the homepage” when you are ready to publish it.");
    } catch (err) { setError(message(err)); setBusy(false); }
  }

  return <dialog ref={ref} className="admin-record-dialog" aria-labelledby="banner-dialog-title" onCancel={e => { e.preventDefault(); close(); }}>
    <form onSubmit={save} className="admin-dialog-form" noValidate>
      <header><div><span className="admin-eyebrow">Homepage banners</span><h2 id="banner-dialog-title">{create ? "Upload a banner" : canManage ? "Edit banner" : "Banner details"}</h2></div>
        <button type="button" className="admin-icon-button" onClick={close} disabled={busy} aria-label="Close"><AdminIcon name="close" /></button></header>
      <div className="admin-dialog-body">{error && <div className="admin-error" role="alert">{error}</div>}
        <fieldset disabled={busy || !canManage} className="admin-form">
          <div className="admin-banner-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview ? <img src={preview} alt="Banner preview" /> : <span>No image chosen</span>}
          </div>
          {canManage && <label>{create ? "Banner image" : "Replace image (optional)"}<input type="file" accept={TYPES.join(",")} onChange={choose} /><span className="admin-field-help">JPG, PNG or WebP, up to 2 MB. About 1600 × 480 px works best; phones crop the sides.</span></label>}
          <label>Title (optional)<input name="title" maxLength={80} defaultValue={banner?.title ?? ""} placeholder="e.g. 20% off this weekend" /></label>
          <label>Subtitle (optional)<input name="subtitle" maxLength={160} defaultValue={banner?.subtitle ?? ""} /></label>
          <div className="admin-form-columns">
            <label>Link (optional)<input name="linkUrl" maxLength={300} defaultValue={banner?.linkUrl ?? ""} placeholder="/food or https://…" /></label>
            <label>Position<input name="sortOrder" type="number" min={0} max={999} step={1} defaultValue={banner?.sortOrder ?? position} /></label>
          </div>
          <p className="admin-field-help">Leave the link empty for a banner that isn’t clickable. Site paths such as /express open in the same tab; full addresses open in a new tab.</p>
          <label className="admin-checkbox"><input name="isActive" type="checkbox" defaultChecked={banner?.isActive ?? true} />Show on the homepage</label>
          {canManage && <label>Reason for change<textarea name="reason" placeholder="Explain why this change is needed…" required minLength={3} maxLength={300} rows={2} /><span className="admin-field-help">Saved with your name in the activity log.</span></label>}
        </fieldset>
      </div>
      <footer><button className="admin-button" type="button" disabled={busy} onClick={close}>{canManage ? "Cancel" : "Close"}</button>
        {canManage && <button className="admin-button primary" disabled={busy}>{busy ? "Saving…" : create ? "Upload banner" : "Save changes"}</button>}</footer>
    </form>
  </dialog>;
}

function DeleteDialog({ banner, onClose, onDeleted }: { banner: AdminBanner; onClose: () => void; onDeleted: (message: string) => void }) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { ref, close } = useModal(onClose, busy);

  async function remove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (reason.length < 3) { setError("Enter a reason of at least 3 characters."); return; }
    setBusy(true); setError("");
    try { await api.adminDeleteBanner(banner.id, reason); onDeleted("Banner deleted. It no longer appears on the homepage."); }
    catch (err) { setError(message(err)); setBusy(false); }
  }

  return <dialog ref={ref} className="admin-record-dialog" aria-labelledby="banner-delete-title" onCancel={e => { e.preventDefault(); close(); }}>
    <form onSubmit={remove} className="admin-dialog-form" noValidate>
      <header><div><span className="admin-eyebrow">Homepage banners</span><h2 id="banner-delete-title">Delete this banner?</h2></div>
        <button type="button" className="admin-icon-button" onClick={close} disabled={busy} aria-label="Close"><AdminIcon name="close" /></button></header>
      <div className="admin-dialog-body">{error && <div className="admin-error" role="alert">{error}</div>}
        <fieldset disabled={busy} className="admin-form">
          <div className="admin-banner-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner.imageUrl} alt="" />
          </div>
          <p className="admin-notice">“{banner.title || "Untitled banner"}” and its image are removed permanently. To take it off the homepage for now, edit it and untick “Show on the homepage” instead.</p>
          <label>Reason for change<textarea name="reason" required minLength={3} maxLength={300} rows={2} /><span className="admin-field-help">Saved with your name in the activity log.</span></label>
        </fieldset>
      </div>
      <footer><button className="admin-button" type="button" disabled={busy} onClick={close}>Cancel</button><button className="admin-button danger" disabled={busy}>{busy ? "Deleting…" : "Delete banner"}</button></footer>
    </form>
  </dialog>;
}
