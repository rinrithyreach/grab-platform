"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { adminCan, adminCovers, adminInitials, filterAdminTeam, type AdminProfile, type AdminRole, type AdminTeamMember } from "@/lib/admin-settings";
import AdminIcon from "./AdminIcon";
import { useAdminDialog } from "./useAdminDialog";

const SUPER = "super";
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Phnom_Penh", dateStyle: "medium", timeStyle: "short" }) : "Never";
const errorText = (err: unknown) => err instanceof TypeError ? "Cannot reach the API. Please try again." : err instanceof Error ? err.message : "Something went wrong. Please try again.";

function Avatar({ member, size = "md" }: { member: Pick<AdminTeamMember, "fullName" | "avatarUrl">; size?: "md" | "lg" }) {
  return <span className={`admin-team-avatar ${size}`}>{member.avatarUrl ? <Image src={member.avatarUrl} alt="" width={size === "lg" ? 64 : 46} height={size === "lg" ? 64 : 46} unoptimized /> : adminInitials(member.fullName)}</span>;
}
function RoleChip({ member }: { member: Pick<AdminTeamMember, "roleId" | "roleName"> }) {
  return <span className={`admin-chip admin-role-chip ${member.roleId ? "" : "super"}`}><AdminIcon name={member.roleId ? "roles" : "shield"} size={13} />{member.roleName}</span>;
}

/** Generates a 16-character temporary password from an unambiguous alphabet using the browser's CSPRNG. */
function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const limit = 256 - (256 % alphabet.length); // reject bytes that would bias the modulo
  let result = "";
  while (result.length < 16) for (const b of crypto.getRandomValues(new Uint8Array(32))) if (b < limit && result.length < 16) result += alphabet[b % alphabet.length];
  return result;
}

/** Roles the signed-in administrator may grant: Super administrator only for super admins, otherwise roles within their own permissions. */
function grantableRoles(me: AdminProfile, roles: AdminRole[]) {
  return [...(me.isSuperAdmin ? [{ value: SUPER, label: "Super administrator (full access)" }] : []),
    ...roles.filter(r => adminCovers(me, r.permissions)).map(r => ({ value: r.id, label: `${r.name} (${r.permissions.length} permissions)` }))];
}
/** Whether the signed-in administrator's access covers a team member's role (so managing them is not an escalation). */
function coversMember(me: AdminProfile, member: AdminTeamMember, roles: AdminRole[]) {
  if (me.isSuperAdmin) return true;
  const role = roles.find(r => r.id === member.roleId);
  return !!role && adminCovers(me, role.permissions);
}

export default function AdminTeamPanel({ me, revision, onSaved }: { me: AdminProfile; revision: number; onSaved: (message: string) => void }) {
  const { api } = useAuth();
  const [team, setTeam] = useState<AdminTeamMember[] | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | "Active" | "Suspended">("");
  const [roleFilter, setRoleFilter] = useState("");
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<AdminTeamMember | null>(null);
  const [adding, setAdding] = useState(false);
  const canManage = adminCan(me, "team", "manage");
  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([api.adminTeam(ctrl.signal), api.adminRoles(ctrl.signal)])
      .then(([members, roleData]) => { if (!ctrl.signal.aborted) { setTeam(members); setRoles(roleData.roles); setError(""); } })
      .catch(err => { if (!ctrl.signal.aborted) setError(errorText(err)); });
    return () => ctrl.abort();
  }, [api, revision, reload]);
  const saved = (message: string) => { setSelected(null); setAdding(false); setReload(v => v + 1); onSaved(message); };
  if (!team) return error ? <div className="admin-error" role="alert">{error}<button className="admin-button" onClick={() => setReload(v => v + 1)}>Retry</button></div> : <div className="admin-loading" role="status"><span className="admin-spinner" />Loading administrators…</div>;
  const active = team.filter(m => m.isActive).length;
  const activeSupers = team.filter(m => m.isActive && !m.roleId).length;
  const shown = filterAdminTeam(team, query, status).filter(m => !roleFilter || (roleFilter === SUPER ? !m.roleId : m.roleId === roleFilter));
  const stats = [
    { label: "Administrators", value: team.length, icon: "team" },
    { label: "Active", value: active, icon: "shield" },
    { label: "Custom roles", value: roles.length, icon: "roles" },
    { label: "Changes in 30 days", value: team.reduce((sum, m) => sum + m.changesLast30Days, 0), icon: "audit" },
  ];
  return <div className="admin-team">
    <div className="admin-team-stats">{stats.map(s => <div key={s.label} className="admin-panel admin-team-stat"><span className="admin-settings-card-icon"><AdminIcon name={s.icon} /></span><div><strong>{s.value}</strong><small>{s.label}</small></div></div>)}</div>
    <section className="admin-panel admin-resource">
      <div className="admin-resource-toolbar">
        <div className="admin-search"><AdminIcon name="search" size={18} /><input aria-label="Search administrators" placeholder="Search name, email, role or phone…" value={query} onChange={e => setQuery(e.target.value)} maxLength={120} /></div>
        <div className="admin-toolbar-actions">
          <select aria-label="Filter by role" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}><option value="">All roles</option><option value={SUPER}>Super administrator</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          <select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value as typeof status)}><option value="">Any status</option><option value="Active">Active</option><option value="Suspended">Suspended</option></select>
          {canManage && <button className="admin-button primary" onClick={() => setAdding(true)}><AdminIcon name="plus" size={17} />Add administrator</button>}
        </div>
      </div>
      {error && <div className="admin-error" role="alert">{error}</div>}
      {shown.length === 0 ? <div className="admin-empty"><span className="admin-empty-icon"><AdminIcon name="team" size={28} /></span><h3>No matching administrators</h3><p>Try a different search, role or status filter.</p></div>
        : <ul className="admin-team-grid">{shown.map(m => <li key={m.id} className={`admin-team-card ${m.isActive ? "" : "suspended"}`}>
          <div className="admin-team-card-head"><Avatar member={m} /><div><h3>{m.fullName}{m.isYou && <span className="admin-chip">You</span>}</h3><p>{m.jobTitle || "Administrator"}</p></div><span className={`admin-status ${m.isActive ? "success" : "danger"}`}>{m.isActive ? "Active" : "Suspended"}</span></div>
          <div><RoleChip member={m} /></div>
          <dl><div><dt>Email</dt><dd>{m.email || "—"}</dd></div><div><dt>Phone</dt><dd>{m.contactPhone || "—"}</dd></div><div><dt>Last sign-in</dt><dd>{formatDate(m.lastLoginAt)}</dd></div><div><dt>Last change</dt><dd>{formatDate(m.lastActivityAt)}</dd></div></dl>
          <div className="admin-team-card-foot"><span>{m.changesLast30Days} {m.changesLast30Days === 1 ? "change" : "changes"} in 30 days</span>{m.isYou ? <Link className="admin-button" href="/admin?section=profile">Edit my profile</Link> : <button className="admin-button" onClick={() => setSelected(m)}>{canManage && coversMember(me, m, roles) ? "Manage" : "View profile"}</button>}</div>
        </li>)}</ul>}
      <p className="admin-team-note"><AdminIcon name="shield" size={16} />An administrator’s role decides which sections they can see and change. Suspending an administrator or signing out their sessions takes effect on their next request, and each change is recorded in the activity log.</p>
    </section>
    {selected && <MemberDialog me={me} member={selected} roles={roles} canManage={canManage && coversMember(me, selected, roles)} lastSuper={!selected.roleId && selected.isActive && activeSupers <= 1} onClose={() => setSelected(null)} onSaved={saved} />}
    {adding && <AddAdminDialog me={me} roles={roles} onClose={() => setAdding(false)} onSaved={saved} />}
  </div>;
}

const useModal = useAdminDialog;

function MemberDialog({ me, member, roles, canManage, lastSuper, onClose, onSaved }: { me: AdminProfile; member: AdminTeamMember; roles: AdminRole[]; canManage: boolean; lastSuper: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"role" | "status" | "sessions">("role");
  const options = grantableRoles(me, roles).filter(o => o.value !== (member.roleId ?? SUPER));
  const [roleValue, setRoleValue] = useState(options[0]?.value ?? "");
  const { dialog, close } = useModal(onClose, busy);
  const blocked = lastSuper && (action === "role" || (action === "status" && member.isActive));
  const role = roles.find(r => r.id === member.roleId);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (reason.length < 3) { setError("Enter a reason of at least 3 characters."); return; }
    setBusy(true); setError("");
    try {
      if (action === "role") { await api.setAdminRole(member.id, roleValue === SUPER ? null : roleValue, reason); onSaved(`${member.fullName}’s role has been changed.`); }
      else if (action === "sessions") { await api.revokeAdminMemberSessions(member.id, reason); onSaved(`${member.fullName} has been signed out of all sessions.`); }
      else { await api.setAdminStatus(member.id, !member.isActive, reason); onSaved(member.isActive ? `${member.fullName} has been suspended.` : `${member.fullName} has been reactivated.`); }
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }
  const submitLabel = action === "role" ? "Change role" : action === "sessions" ? "Sign out sessions" : member.isActive ? "Suspend administrator" : "Reactivate administrator";
  return <dialog ref={dialog} className="admin-record-dialog" aria-labelledby="member-title" onCancel={e => { e.preventDefault(); close(); }}>
    <form onSubmit={submit} className="admin-dialog-form">
      <header><div><span className="admin-eyebrow">Administrator profile</span><h2 id="member-title">{member.fullName}</h2><p className="admin-record-full-id">{member.id}</p></div><button type="button" className="admin-icon-button" onClick={close} disabled={busy} aria-label="Close profile"><AdminIcon name="close" /></button></header>
      <div className="admin-dialog-body">
        <div className="admin-team-profile"><Avatar member={member} size="lg" /><div><strong>{member.jobTitle || "Administrator"}</strong><RoleChip member={member} /><span className={`admin-status ${member.isActive ? "success" : "danger"}`}>{member.isActive ? "Active" : "Suspended"}</span></div></div>
        {member.bio && <p className="admin-team-bio">{member.bio}</p>}
        <dl className="admin-details">
          <div><dt>Sign-in email</dt><dd>{member.email || "—"}</dd></div><div><dt>Contact phone</dt><dd>{member.contactPhone || "—"}</dd></div>
          <div><dt>Role access</dt><dd>{member.roleId ? `${role?.permissions.length ?? 0} permissions: ${role?.description || role?.name || member.roleName}` : "Every permission"}</dd></div>
          <div><dt>Joined</dt><dd>{formatDate(member.createdAt)}</dd></div><div><dt>Last email sign-in</dt><dd>{formatDate(member.lastLoginAt)}</dd></div>
          <div><dt>Password changed</dt><dd>{member.passwordChangedAt ? formatDate(member.passwordChangedAt) : "Not since account creation"}</dd></div><div><dt>Last console change</dt><dd>{formatDate(member.lastActivityAt)}</dd></div>
        </dl>
        {error && <div className="admin-error" role="alert">{error}</div>}
        {canManage ? <fieldset disabled={busy} className="admin-form">
          <label>Action<select value={action} onChange={e => setAction(e.target.value as typeof action)}><option value="role">Change role</option>{member.isActive && <option value="sessions">Sign out all sessions</option>}<option value="status">{member.isActive ? "Suspend administrator" : "Reactivate administrator"}</option></select></label>
          {action === "role" && (options.length ? <label>New role<select value={roleValue} onChange={e => setRoleValue(e.target.value)}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select><span className="admin-field-help">The new permissions apply on their next request. Manage roles on the Roles & permissions page.</span></label>
            : <p className="admin-notice">There is no other role you can assign. Create one on the Roles & permissions page.</p>)}
          {action !== "role" && <p className="admin-field-help">{action === "sessions" ? "Ends every current session for this administrator. They can sign in again with their password." : member.isActive ? "Blocks sign-in and ends every current session until the account is reactivated. Their records and activity history are kept." : "Restores sign-in with their existing password."}</p>}
          {blocked && <p className="admin-maintenance-warning">This is the last active super administrator. Make another administrator a super administrator first.</p>}
          <label>Reason for change<textarea name="reason" placeholder="Explain why this change is needed…" required minLength={3} maxLength={300} rows={3} /><span className="admin-field-help">Saved with your name in the activity log.</span></label>
        </fieldset> : <p className="admin-notice">{adminCan(me, "team", "manage") ? "This administrator’s role includes permissions you don’t hold, so you can view but not change their access." : "Your role can view administrators but not change them."}</p>}
      </div>
      <footer><button className="admin-button" type="button" disabled={busy} onClick={close}>{canManage ? "Cancel" : "Close"}</button>{canManage && <button className={`admin-button ${action === "status" && member.isActive ? "danger" : "primary"}`} disabled={busy || blocked || (action === "role" && !options.length)}>{busy ? "Saving…" : submitLabel}</button>}</footer>
    </form>
  </dialog>;
}

function AddAdminDialog({ me, roles, onClose, onSaved }: { me: AdminProfile; roles: AdminRole[]; onClose: () => void; onSaved: (message: string) => void }) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const options = grantableRoles(me, roles);
  const [roleValue, setRoleValue] = useState(options.find(o => o.value !== SUPER)?.value ?? options[0]?.value ?? "");
  const { dialog, close } = useModal(onClose, busy);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? "").trim();
    if (password.length < 12) { setError("Use a temporary password of at least 12 characters."); return; }
    if (!roleValue) { setError("Create a role first on the Roles & permissions page."); return; }
    setBusy(true); setError("");
    try {
      await api.createAdmin({ fullName: get("fullName"), email: get("email"), jobTitle: get("jobTitle"), temporaryPassword: password, reason: get("reason"), adminRoleId: roleValue === SUPER ? null : roleValue });
      onSaved(`${get("fullName")} can now sign in at /admin/login. Share the temporary password privately and ask them to change it from My profile.`);
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="admin-record-dialog" aria-labelledby="add-admin-title" onCancel={e => { e.preventDefault(); close(); }}>
    <form onSubmit={submit} className="admin-dialog-form">
      <header><div><span className="admin-eyebrow">Administrators</span><h2 id="add-admin-title">Add an administrator</h2></div><button type="button" className="admin-icon-button" onClick={close} disabled={busy} aria-label="Close"><AdminIcon name="close" /></button></header>
      <div className="admin-dialog-body">{error && <div className="admin-error" role="alert">{error}</div>}
        <AdminAccountFields password={password} setPassword={setPassword} show={show} setShow={setShow} busy={busy}>
          <label>Role<select value={roleValue} onChange={e => setRoleValue(e.target.value)} required>{options.length === 0 && <option value="">No role available</option>}{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select><span className="admin-field-help">Decides which sections this administrator can see and change.</span></label>
        </AdminAccountFields>
      </div>
      <footer><button className="admin-button" type="button" disabled={busy} onClick={close}>Cancel</button><button className="admin-button primary" disabled={busy || !options.length}>{busy ? "Adding…" : "Add administrator"}</button></footer>
    </form>
  </dialog>;
}

/** Shared name/email/temporary-password/reason fields for creating an administrator account. */
export function AdminAccountFields({ password, setPassword, show, setShow, busy, children }: { password: string; setPassword: (v: string) => void; show: boolean; setShow: (v: boolean) => void; busy: boolean; children?: React.ReactNode }) {
  return <fieldset disabled={busy} className="admin-form">
    <div className="admin-form-columns"><label>Full name<input name="fullName" required minLength={2} maxLength={120} autoComplete="off" /></label><label>Job title<input name="jobTitle" maxLength={100} placeholder="For example: Support lead" /></label></div>
    <label>Sign-in email<input name="email" type="email" required maxLength={254} autoComplete="off" /></label>
    {children}
    <label>Temporary password<div className="admin-password-row"><input type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" /><button type="button" className="admin-button" onClick={() => { setPassword(temporaryPassword()); setShow(true); }}>Generate</button></div><span className="admin-field-help">12–128 characters. Share it privately; it is not shown again after saving.</span></label>
    <label className="admin-checkbox"><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />Show password</label>
    <label>Reason for change<textarea name="reason" placeholder="For example: new operations team member" required minLength={3} maxLength={300} rows={3} /><span className="admin-field-help">Saved with your name in the activity log.</span></label>
  </fieldset>;
}

export { grantableRoles, temporaryPassword, SUPER as SUPER_ROLE };
