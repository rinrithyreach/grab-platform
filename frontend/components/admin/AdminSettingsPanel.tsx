"use client";

import { useEffect, useId, useState } from "react";
import { useAuth } from "@/lib/auth";
import type { AdminSettings, PlatformSettings } from "@/lib/admin-settings";
import { useAdminT } from "@/lib/admin-i18n";
import { confirmDialog } from "@/lib/dialog";
import { setPlatformSettings } from "@/lib/platform";
import { useSettings } from "@/lib/settings";
import { LanguageSwitch, ThemeSwitch } from "./AdminPreferenceSwitches";
import AdminIcon from "./AdminIcon";

const tabs = [{ id: "general", label: "Support details", icon: "support" }, { id: "services", label: "Services & registrations", icon: "overview" }, { id: "announcements", label: "Announcements", icon: "announcement" }, { id: "maintenance", label: "Maintenance", icon: "settings" }, { id: "display", label: "Language & theme", icon: "globe" }] as const;
type Tab = typeof tabs[number]["id"];

/** Personal display preferences. They apply at once, need no save and are shared with the customer app. */
function DisplayPreferences() {
  const { a } = useAdminT();
  const { theme } = useSettings();
  const id = useId();
  return <section className="admin-panel admin-settings-card" aria-labelledby={id}>
    <header><span className="admin-settings-card-icon"><AdminIcon name="globe" /></span><div><h2 id={id}>{a("Language & theme")}</h2><p>{a("Language and theme for this admin console. They apply right away and only to you.")}</p></div></header>
    <div className="admin-pref-row"><span className="admin-setting-icon"><AdminIcon name="globe" /></span><span><strong>{a("Language")}</strong><small>{a("Choose the language for menus, labels and messages.")}</small></span><LanguageSwitch /></div>
    <div className="admin-pref-row"><span className="admin-setting-icon"><AdminIcon name={theme === "dark" ? "moon" : "sun"} /></span><span><strong>{a("Theme")}</strong><small>{a("Use a light or dark look for the console.")}</small></span><ThemeSwitch /></div>
  </section>;
}

export default function AdminSettingsPanel({ revision, canManage, onSaved }: { revision: number; canManage: boolean; onSaved: (message: string) => void }) {
  const { api } = useAuth();
  const { a } = useAdminT();
  const [saved, setSaved] = useState<AdminSettings | null>(null);
  const [draft, setDraft] = useState<AdminSettings | null>(null);
  const [tab, setTab] = useState<Tab>("general");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    api.adminSettings(ctrl.signal).then(data => { if (!ctrl.signal.aborted) { setSaved(data); setDraft(data); setReason(""); setError(""); } }).catch(err => { if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : a("Cannot load settings.")); });
    return () => ctrl.abort();
  }, [api, revision, reload, a]);
  const nav = <aside className="admin-settings-nav"><nav aria-label={a("Settings categories")}>{tabs.map(item => <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><AdminIcon name={item.icon} size={18} />{a(item.label)}</button>)}</nav><div className="admin-settings-tip"><AdminIcon name="shield" size={22} /><strong>{a("Shared platform settings")}</strong><p>{a("Changes apply to every customer and merchant. Each save is recorded in the activity log.")}</p></div></aside>;
  // Language & theme work even while platform settings are loading or cannot be changed.
  if (tab === "display") return <div className="admin-settings-layout">{nav}<div className="admin-settings-main"><DisplayPreferences /></div></div>;
  if (!draft || !saved) return <div className="admin-settings-layout">{nav}<div className="admin-settings-main">{error ? <div className="admin-error" role="alert">{error}<button className="admin-button" onClick={() => setReload(v => v + 1)}>{a("Retry")}</button></div> : <div className="admin-loading" role="status">{a("Loading platform settings…")}</div>}</div></div>;
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  function update<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) { setDraft(d => d ? { ...d, [key]: value } : d); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!draft || !dirty) return;
    setBusy(true); setError("");
    try {
      const result = await api.saveAdminSettings({ ...draft, reason: reason.trim() });
      setSaved(result); setDraft(result); setReason(""); setPlatformSettings(result); onSaved(a("Platform settings saved and applied."));
    } catch (err) { setError(err instanceof TypeError ? a("Cannot reach the API. Your changes are still here; try saving again.") : err instanceof Error ? err.message : a("Unable to save settings.")); }
    finally { setBusy(false); }
  }
  const field = (key: "supportEmail" | "supportPhone" | "supportHours" | "officeAddress", label: string, placeholder: string, maxLength: number, type = "text") => <label>{a(label)}<input type={type} value={String(draft[key])} onChange={e => update(key, e.target.value)} maxLength={maxLength} placeholder={a(placeholder)} /></label>;
  const toggle = (key: "ridesEnabled" | "foodEnabled" | "expressEnabled" | "customerRegistrationEnabled" | "merchantRegistrationEnabled" | "announcementEnabled" | "maintenanceMode", title: string, detail: string, icon: string) => <label className="admin-setting-toggle"><span className="admin-setting-icon"><AdminIcon name={icon} /></span><span><strong>{a(title)}</strong><small>{a(detail)}</small></span><input type="checkbox" role="switch" checked={Boolean(draft[key])} onChange={e => update(key, e.target.checked)} aria-label={a(title)} /></label>;
  return <div className="admin-settings-layout">
    {nav}
    <form onSubmit={submit} className="admin-settings-main">
      {error && <div className="admin-error" role="alert">{error}<button className="admin-text-link" type="button" onClick={async () => { if (!dirty || await confirmDialog({ title: a("Discard your unsaved changes and reload the latest settings?"), confirmLabel: a("Reload latest settings"), tone: "danger" })) setReload(v => v + 1); }}>{a("Reload latest settings")}</button></div>}
      {!canManage && <div className="admin-notice" role="status">{a("Your role can view platform settings but not change them.")}</div>}
      <fieldset disabled={busy || !canManage} className="admin-settings-fieldset">
        {tab === "general" && <section className="admin-panel admin-settings-card"><header><span className="admin-settings-card-icon"><AdminIcon name="support" /></span><div><h2>{a("Support details")}</h2><p>{a("Help customers reach your team. These details appear in the customer app’s footer.")}</p></div></header><div className="admin-form"><div className="admin-form-columns">{field("supportEmail", "Support email", "support@example.com", 254, "email")}{field("supportPhone", "Support phone", "+855 12 345 678", 30, "tel")}</div>{field("supportHours", "Support hours", "Monday–Friday, 08:00–18:00 (Cambodia time)", 120)}{field("officeAddress", "Office address", "Your customer support or business address", 300)}<p className="admin-field-help">{a("Leave optional fields blank to hide them. Phone numbers are saved in international format.")}</p></div></section>}
        {tab === "services" && <><section className="admin-panel admin-settings-card"><header><span className="admin-settings-card-icon"><AdminIcon name="overview" /></span><div><h2>{a("Service availability")}</h2><p>{a("Choose which services accept new bookings. Existing bookings remain manageable.")}</p></div></header>{toggle("ridesEnabled", "GrabRide", "Accept new ride requests.", "rides")}{toggle("foodEnabled", "GrabFood", "Accept new orders from live food merchants.", "orders")}{toggle("expressEnabled", "GrabExpress", "Accept new parcel deliveries and Express store orders.", "deliveries")}</section><section className="admin-panel admin-settings-card"><header><span className="admin-settings-card-icon"><AdminIcon name="users" /></span><div><h2>{a("New account registrations")}</h2><p>{a("Existing accounts can still sign in when registrations are paused.")}</p></div></header>{toggle("customerRegistrationEnabled", "Customer registration", "Allow new customer accounts.", "users")}{toggle("merchantRegistrationEnabled", "Merchant registration", "Allow new merchant and ride-partner accounts.", "merchants")}</section></>}
        {tab === "announcements" && <section className="admin-panel admin-settings-card"><header><span className="admin-settings-card-icon"><AdminIcon name="announcement" /></span><div><h2>{a("Customer announcement")}</h2><p>{a("Publish a message at the top of the customer app.")}</p></div></header>{toggle("announcementEnabled", "Show announcement", "Visible across customer pages after saving.", "announcement")}<div className="admin-form"><label>{a("Announcement")}<textarea value={draft.announcement} onChange={e => update("announcement", e.target.value)} maxLength={300} rows={4} placeholder={a("Let customers know about service updates or upcoming changes.")} /><span className="admin-field-help">{a("{n}/300 characters", { n: draft.announcement.length })}</span></label><div className="admin-announcement-preview"><span>{a("MESSAGE PREVIEW")}</span><p>{draft.announcement || a("Your announcement will appear here.")}</p></div></div></section>}
        {tab === "maintenance" && <section className="admin-panel admin-settings-card"><header><span className="admin-settings-card-icon"><AdminIcon name="settings" /></span><div><h2>{a("Maintenance mode")}</h2><p>{a("Pause new bookings and registrations while your team works on the platform.")}</p></div></header>{toggle("maintenanceMode", "Enable maintenance mode", "Overrides service and registration switches until turned off.", "settings")}<div className="admin-form"><label>{a("Message for customers")}<textarea value={draft.maintenanceMessage} onChange={e => update("maintenanceMessage", e.target.value)} maxLength={300} rows={3} /></label><div className="admin-notice">{a("Customers can browse and manage existing bookings. Merchants can complete ongoing work, and administrators retain access to this console.")}</div>{draft.maintenanceMode && <p className="admin-maintenance-warning">{a("Saving will pause all new live bookings and registrations.")}</p>}</div></section>}
        {canManage && <section className="admin-panel admin-settings-card admin-settings-save"><div className="admin-form"><label>{a("Reason for change")}<input value={reason} onChange={e => setReason(e.target.value)} required={dirty} minLength={3} maxLength={300} placeholder={a("For example: update support contact information")} /></label></div><div className="admin-savebar"><div><strong>{a(dirty ? "You have unsaved changes" : "Settings are up to date")}</strong><span>{saved.updatedAt ? a("Last saved {date}", { date: new Date(saved.updatedAt).toLocaleString("en-GB", { timeZone: "Asia/Phnom_Penh" }) }) : a("Using the platform defaults")}</span></div><div><button type="button" className="admin-button" disabled={!dirty || busy} onClick={() => { setDraft(saved); setReason(""); setError(""); }}>{a("Discard")}</button><button className="admin-button primary" disabled={!dirty || busy}>{busy ? a("Saving…") : a("Save settings")}</button></div></div></section>}
      </fieldset>
    </form>
  </div>;
}
