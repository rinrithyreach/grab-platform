"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import type { AdminActivity, AdminProfile } from "@/lib/admin-settings";
import { useAdminT } from "@/lib/admin-i18n";
import AdminIcon from "./AdminIcon";

const formatDate = (value: string | null) => value ? new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Phnom_Penh", dateStyle: "medium", timeStyle: "short" }) : "Not recorded yet";
const sectionNames: Record<string, string> = { users: "Users & access", merchants: "Merchants", listings: "Listings", rides: "Rides", orders: "Orders", deliveries: "Deliveries", drivers: "Drivers", reviews: "Reviews", settings: "Settings", team: "Administrators", profile: "My profile" };

function ProfileActivity({ revision }: { revision: string }) {
  const { api } = useAuth();
  const [items, setItems] = useState<AdminActivity[] | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    api.adminActivity(ctrl.signal).then(data => { if (!ctrl.signal.aborted) { setItems(data); setError(""); } })
      .catch(err => { if (!ctrl.signal.aborted) setError(err instanceof TypeError ? "Cannot reach the API. Please try again." : err instanceof Error ? err.message : "Unable to load your activity."); });
    return () => ctrl.abort();
  }, [api, revision, reload]);
  return <section className="admin-panel admin-settings-card"><header><span className="admin-settings-card-icon"><AdminIcon name="activity" /></span><div><h2>My recent activity</h2><p>Your 25 most recent changes made through the admin console, newest first.</p></div></header>
    <div className="admin-form">{error ? <div className="admin-error" role="alert">{error}<button className="admin-button" type="button" onClick={() => setReload(v => v + 1)}>Retry</button></div>
      : !items ? <div className="admin-loading" role="status"><span className="admin-spinner" />Loading activity…</div>
      : items.length === 0 ? <p className="admin-field-help">You have not made any console changes yet.</p>
      : <ol className="admin-activity-list">{items.map(item => <li key={item.id}><span className="admin-chip">{sectionNames[item.resource] ?? item.resource}</span><div><strong>{item.action}</strong><p>{item.reason}</p></div><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></li>)}</ol>}
      <p className="admin-field-help">The complete history for every administrator is available in the Activity log.</p></div>
  </section>;
}
export default function AdminProfilePanel({ profile, onChanged }: { profile: AdminProfile; onChanged: (profile: AdminProfile, message: string) => void }) {
  const { api } = useAuth();
  const { a } = useAdminT();
  const [tab, setTab] = useState<"profile" | "security" | "preferences" | "activity">("profile");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState(profile.email ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const passwordForm = useRef<HTMLFormElement>(null);
  const profileForm = useRef<HTMLFormElement>(null);
  const [revoke, setRevoke] = useState(false);
  async function change(operation: () => Promise<AdminProfile>, success: string) {
    setBusy(true); setError("");
    try { const result = await operation(); setEmail(result.email ?? ""); onChanged(result, success); setRevoke(false); passwordForm.current?.reset(); return true; }
    catch (err) { setError(err instanceof TypeError ? "Cannot reach the API. Please try again." : err instanceof Error ? err.message : "Unable to save your changes."); return false; }
    finally { setBusy(false); }
  }
  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    if (busy || (tab === "profile" && !editing)) return;
    const saved = await change(() => api.saveAdminProfile({ fullName: tab === "profile" ? value("fullName") : profile.fullName, email: tab === "profile" ? value("email") || null : profile.email,
      contactPhone: tab === "profile" ? value("contactPhone") : profile.contactPhone, jobTitle: tab === "profile" ? value("jobTitle") : profile.jobTitle,
      bio: tab === "profile" ? value("bio") : profile.bio, version: profile.version,
      refreshSeconds: tab === "preferences" ? Number(value("refreshSeconds")) : profile.refreshSeconds,
      compactTables: tab === "preferences" ? form.has("compactTables") : profile.compactTables,
      currentPassword: String(form.get("currentPassword") ?? "") || undefined }), tab === "preferences" ? "Dashboard preferences saved." : "Your admin profile has been updated.");
    if (saved) setEditing(false);
  }
  function cancelEdit() {
    profileForm.current?.reset(); setEmail(profile.email ?? ""); setEditing(false); setError("");
  }
  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword")); const newPassword = String(form.get("newPassword")); const confirmPassword = String(form.get("confirmPassword"));
    if (newPassword !== confirmPassword) { setError("The new password and confirmation do not match."); return; }
    await change(() => api.changeAdminPassword({ currentPassword, newPassword, confirmPassword }), "Password updated. Other sessions have been signed out.");
  }
  return <div className="admin-profile-layout">
    <aside className="admin-panel admin-profile-summary">
      <div className="admin-profile-cover" />
      <div className="admin-profile-avatar"><span>{profile.fullName.trim().slice(0, 1).toUpperCase()}</span></div>
      <h2>{profile.fullName}</h2><p>{profile.jobTitle || "Platform administrator"}</p><span className="admin-status success">{profile.roleName}</span>
      <dl><div><dt>Email</dt><dd>{profile.email || "Add a sign-in email"}</dd></div><div><dt>Joined</dt><dd>{formatDate(profile.createdAt)}</dd></div><div><dt>Last email sign-in</dt><dd>{formatDate(profile.lastLoginAt)}</dd></div></dl>
      <div className="admin-profile-secure"><AdminIcon name="shield" size={18} /><span>Your profile is visible only in the admin workspace.</span></div>
    </aside>
    <div className="admin-profile-main"><nav className="admin-profile-tabs" aria-label="Profile sections">{([{ id: "profile", label: "Personal details", icon: "profile" }, { id: "security", label: "Password & security", icon: "shield" }, { id: "preferences", label: "Preferences", icon: "settings" }, { id: "activity", label: "Activity", icon: "activity" }] as const).map(item => <button key={item.id} type="button" disabled={busy} className={tab === item.id ? "active" : ""} aria-current={tab === item.id ? "page" : undefined} onClick={() => { setTab(item.id); setEditing(false); setError(""); setEmail(profile.email ?? ""); }}><AdminIcon name={item.icon} size={18} />{item.label}</button>)}</nav>
      {error && <div className="admin-error" role="alert">{error}</div>}
      {tab === "profile" && <form ref={profileForm} key={profile.version + "details"} className="admin-panel admin-settings-card" onSubmit={saveProfile}>
        <header className="admin-profile-details-heading"><div><h2>{a("Personal details")}</h2><p>{a("Manage your administrator identity and contact information.")}</p></div>
          {!editing && <button type="button" className="admin-button primary" disabled={busy} onClick={() => { setEmail(profile.email ?? ""); setError(""); setEditing(true); }}><AdminIcon name="edit" size={16} />{a("Edit profile")}</button>}
        </header>
        {editing ? <fieldset disabled={busy} className="admin-form">
          <div className="admin-form-columns"><label>{a("Full name")}<input name="fullName" defaultValue={profile.fullName} required minLength={2} maxLength={120} autoComplete="name" autoFocus /></label><label>{a("Job title")}<input name="jobTitle" defaultValue={profile.jobTitle} maxLength={100} placeholder={a("For example: Operations manager")} /></label></div>
          <div className="admin-form-columns"><label>{a("Sign-in email")}<input name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required={!!profile.email} maxLength={254} autoComplete="email" placeholder={profile.email ? undefined : a("Optional")} /></label><label>{a("Contact phone")}<input name="contactPhone" type="tel" defaultValue={profile.contactPhone} maxLength={30} autoComplete="tel" placeholder={a("Optional")} /></label></div>
          {email.trim().toLowerCase() !== (profile.email ?? "").toLowerCase() && <label>{a("Current password")}<input type="password" name="currentPassword" autoComplete="current-password" required maxLength={128} /><span className="admin-field-help">{a("Required to change your sign-in email. Other sessions will be signed out.")}</span></label>}
          <label>{a("About you")}<textarea name="bio" rows={4} defaultValue={profile.bio} maxLength={500} placeholder={a("A short introduction for your admin profile.")} /></label>
          <div className="admin-form-footer"><span>{a("Role")}: {a(profile.roleName)}</span><div className="admin-profile-edit-actions"><button type="button" className="admin-button" disabled={busy} onClick={cancelEdit}>{a("Cancel")}</button><button type="submit" className="admin-button primary" disabled={busy}>{a(busy ? "Saving…" : "Save profile")}</button></div></div>
        </fieldset> : <dl className="admin-profile-details">
          {([["Full name", profile.fullName], ["Job title", profile.jobTitle], ["Sign-in email", profile.email], ["Contact phone", profile.contactPhone], ["About you", profile.bio]] as const).map(([label, value]) => <div key={label} className={label === "About you" ? "admin-profile-bio" : undefined}><dt>{a(label)}</dt><dd>{value || a("Not added")}</dd></div>)}
        </dl>}
      </form>}
      {tab === "security" && <><form ref={passwordForm} onSubmit={savePassword} className="admin-panel admin-settings-card"><header><div><h2>Change password</h2><p>Choose a new password with 12–128 characters. Your current session stays signed in.</p></div></header><fieldset disabled={busy} className="admin-form"><label>Current password<input type={showPassword ? "text" : "password"} name="currentPassword" autoComplete="current-password" required maxLength={128} /></label><div className="admin-form-columns"><label>New password<input type={showPassword ? "text" : "password"} name="newPassword" autoComplete="new-password" required minLength={12} maxLength={128} /></label><label>Confirm new password<input type={showPassword ? "text" : "password"} name="confirmPassword" autoComplete="new-password" required minLength={12} maxLength={128} /></label></div><label className="admin-checkbox"><input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />Show passwords</label><div className="admin-form-footer"><span>Last changed: {formatDate(profile.passwordChangedAt)}</span><button className="admin-button primary" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></div></fieldset></form><section className="admin-panel admin-settings-card"><header><span className="admin-settings-card-icon"><AdminIcon name="shield" /></span><div><h2>Account sessions</h2><p>End access on other browsers or devices while staying signed in here.</p></div></header><div className="admin-form">{revoke ? <div className="admin-session-confirm"><p>All existing sessions for your admin account will be invalidated. This browser receives a replacement session.</p><div><button className="admin-button" disabled={busy} onClick={() => setRevoke(false)}>Cancel</button><button className="admin-button danger" disabled={busy} onClick={() => void change(() => api.revokeAdminSessions(), "Other sessions have been signed out.")}>{busy ? "Signing out…" : "Confirm sign out"}</button></div></div> : <button type="button" className="admin-button" disabled={busy} onClick={() => setRevoke(true)}>Sign out other sessions</button>}<p className="admin-field-help">Password and sign-in email changes also invalidate other sessions. Your account and booking data stay intact.</p></div></section></>}
      {tab === "preferences" && <form key={profile.version + "preferences"} onSubmit={saveProfile} className="admin-panel admin-settings-card"><header><div><h2>Dashboard preferences</h2><p>These settings are saved to your account and follow you across browsers.</p></div></header><fieldset className="admin-form" disabled={busy}><label>Overview auto-refresh<select name="refreshSeconds" defaultValue={profile.refreshSeconds}><option value={0}>Off — refresh manually</option><option value={15}>Every 15 seconds</option><option value={30}>Every 30 seconds</option><option value={60}>Every minute</option></select><span className="admin-field-help">Automatic refresh pauses when this tab is in the background.</span></label><label className="admin-checkbox"><input type="checkbox" name="compactTables" defaultChecked={profile.compactTables} />Use compact table rows</label><p className="admin-field-help">Fit more records on screen while keeping the same search and pagination controls.</p><div className="admin-form-footer"><span>Currency: USD · Cambodia time (UTC+7)</span><button className="admin-button primary" disabled={busy}>{busy ? "Saving…" : "Save preferences"}</button></div></fieldset></form>}
      {tab === "activity" && <ProfileActivity revision={profile.version} />}
    </div>
  </div>;
}
