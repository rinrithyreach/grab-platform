"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import type { AdminSettings, PlatformSettings } from "@/lib/admin-settings";
import { setPlatformSettings } from "@/lib/platform";
import AdminIcon from "./AdminIcon";

const tabs = [{ id: "general", label: "Support details", icon: "support" }, { id: "services", label: "Services & registrations", icon: "overview" }, { id: "announcements", label: "Announcements", icon: "announcement" }, { id: "maintenance", label: "Maintenance", icon: "settings" }] as const;
type Tab = typeof tabs[number]["id"];
export default function AdminSettingsPanel({ revision, canManage, onSaved }: { revision: number; canManage: boolean; onSaved: (message: string) => void }) {
  const { api } = useAuth();
  const [saved, setSaved] = useState<AdminSettings | null>(null);
  const [draft, setDraft] = useState<AdminSettings | null>(null);
  const [tab, setTab] = useState<Tab>("general");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    api.adminSettings(ctrl.signal).then(data => { if (!ctrl.signal.aborted) { setSaved(data); setDraft(data); setReason(""); setError(""); } }).catch(err => { if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : "Cannot load settings."); });
    return () => ctrl.abort();
  }, [api, revision, reload]);
  if (!draft || !saved) return error ? <div className="admin-error" role="alert">{error}<button className="admin-button" onClick={() => setReload(v => v + 1)}>Retry</button></div> : <div className="admin-loading" role="status">Loading platform settings…</div>;
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  function update<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) { setDraft(d => d ? { ...d, [key]: value } : d); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!draft || !dirty) return;
    setBusy(true); setError("");
    try {
      const result = await api.saveAdminSettings({ ...draft, reason: reason.trim() });
      setSaved(result); setDraft(result); setReason(""); setPlatformSettings(result); onSaved("Platform settings saved and applied.");
    } catch (err) { setError(err instanceof TypeError ? "Cannot reach the API. Your changes are still here; try saving again." : err instanceof Error ? err.message : "Unable to save settings."); }
    finally { setBusy(false); }
  }
  const field = (key: "supportEmail" | "supportPhone" | "supportHours" | "officeAddress", label: string, placeholder: string, maxLength: number, type = "text") => <label>{label}<input type={type} value={String(draft[key])} onChange={e => update(key, e.target.value)} maxLength={maxLength} placeholder={placeholder} /></label>;
  const toggle = (key: "ridesEnabled" | "foodEnabled" | "expressEnabled" | "customerRegistrationEnabled" | "merchantRegistrationEnabled" | "announcementEnabled" | "maintenanceMode", title: string, detail: string, icon: string) => <label className="admin-setting-toggle"><span className="admin-setting-icon"><AdminIcon name={icon} /></span><span><strong>{title}</strong><small>{detail}</small></span><input type="checkbox" role="switch" checked={Boolean(draft[key])} onChange={e => update(key, e.target.checked)} aria-label={title} /></label>;
  return <div className="admin-settings-layout">
    <aside className="admin-settings-nav"><nav aria-label="Settings categories">{tabs.map(item => <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><AdminIcon name={item.icon} size={18} />{item.label}</button>)}</nav><div className="admin-settings-tip"><AdminIcon name="shield" size={22} /><strong>Shared platform settings</strong><p>Changes apply to every customer and merchant. Each save is recorded in the activity log.</p></div></aside>
    <form onSubmit={submit} className="admin-settings-main">
      {error && <div className="admin-error" role="alert">{error}<button className="admin-text-link" type="button" onClick={() => { if (!dirty || window.confirm("Discard your unsaved changes and reload the latest settings?")) setReload(v => v + 1); }}>Reload latest settings</button></div>}
      {!canManage && <div className="admin-notice" role="status">Your role can view platform settings but not change them.</div>}
      <fieldset disabled={busy || !canManage} className="admin-settings-fieldset">
        {tab === "general" && <section className="admin-panel admin-settings-card"><header><span className="admin-settings-card-icon"><AdminIcon name="support" /></span><div><h2>Support details</h2><p>Help customers reach your team. These details appear in the customer app’s footer.</p></div></header><div className="admin-form"><div className="admin-form-columns">{field("supportEmail", "Support email", "support@example.com", 254, "email")}{field("supportPhone", "Support phone", "+855 12 345 678", 30, "tel")}</div>{field("supportHours", "Support hours", "Monday–Friday, 08:00–18:00 (Cambodia time)", 120)}{field("officeAddress", "Office address", "Your customer support or business address", 300)}<p className="admin-field-help">Leave optional fields blank to hide them. Phone numbers are saved in international format.</p></div></section>}
        {tab === "services" && <><section className="admin-panel admin-settings-card"><header><span className="admin-settings-card-icon"><AdminIcon name="overview" /></span><div><h2>Service availability</h2><p>Choose which services accept new bookings. Existing bookings remain manageable.</p></div></header>{toggle("ridesEnabled", "GrabRide", "Accept new ride requests.", "rides")}{toggle("foodEnabled", "GrabFood", "Accept new orders from live food merchants.", "orders")}{toggle("expressEnabled", "GrabExpress", "Accept new parcel deliveries and Express store orders.", "deliveries")}</section><section className="admin-panel admin-settings-card"><header><span className="admin-settings-card-icon"><AdminIcon name="users" /></span><div><h2>New account registrations</h2><p>Existing accounts can still sign in when registrations are paused.</p></div></header>{toggle("customerRegistrationEnabled", "Customer registration", "Allow new customer accounts.", "users")}{toggle("merchantRegistrationEnabled", "Merchant registration", "Allow new merchant and ride-partner accounts.", "merchants")}</section></>}
        {tab === "announcements" && <section className="admin-panel admin-settings-card"><header><span className="admin-settings-card-icon"><AdminIcon name="announcement" /></span><div><h2>Customer announcement</h2><p>Publish a message at the top of the customer app.</p></div></header>{toggle("announcementEnabled", "Show announcement", "Visible across customer pages after saving.", "announcement")}<div className="admin-form"><label>Announcement<textarea value={draft.announcement} onChange={e => update("announcement", e.target.value)} maxLength={300} rows={4} placeholder="Let customers know about service updates or upcoming changes." /><span className="admin-field-help">{draft.announcement.length}/300 characters</span></label><div className="admin-announcement-preview"><span>MESSAGE PREVIEW</span><p>{draft.announcement || "Your announcement will appear here."}</p></div></div></section>}
        {tab === "maintenance" && <section className="admin-panel admin-settings-card"><header><span className="admin-settings-card-icon"><AdminIcon name="settings" /></span><div><h2>Maintenance mode</h2><p>Pause new bookings and registrations while your team works on the platform.</p></div></header>{toggle("maintenanceMode", "Enable maintenance mode", "Overrides service and registration switches until turned off.", "settings")}<div className="admin-form"><label>Message for customers<textarea value={draft.maintenanceMessage} onChange={e => update("maintenanceMessage", e.target.value)} maxLength={300} rows={3} /></label><div className="admin-notice">Customers can browse and manage existing bookings. Merchants can complete ongoing work, and administrators retain access to this console.</div>{draft.maintenanceMode && <p className="admin-maintenance-warning">Saving will pause all new live bookings and registrations.</p>}</div></section>}
        {canManage && <section className="admin-panel admin-settings-card admin-settings-save"><div className="admin-form"><label>Reason for change<input value={reason} onChange={e => setReason(e.target.value)} required={dirty} minLength={3} maxLength={300} placeholder="For example: update support contact information" /></label></div><div className="admin-savebar"><div><strong>{dirty ? "You have unsaved changes" : "Settings are up to date"}</strong><span>{saved.updatedAt ? `Last saved ${new Date(saved.updatedAt).toLocaleString("en-GB", { timeZone: "Asia/Phnom_Penh" })}` : "Using the platform defaults"}</span></div><div><button type="button" className="admin-button" disabled={!dirty || busy} onClick={() => { setDraft(saved); setReason(""); setError(""); }}>Discard</button><button className="admin-button primary" disabled={!dirty || busy}>{busy ? "Saving…" : "Save settings"}</button></div></div></section>}
      </fieldset>
    </form>
  </div>;
}
