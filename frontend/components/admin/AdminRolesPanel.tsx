"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { adminCan, adminCovers, togglePermission, type AdminPermissionSection, type AdminProfile, type AdminRole, type AdminRoles } from "@/lib/admin-settings";
import AdminIcon from "./AdminIcon";

const formatDate = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Phnom_Penh", dateStyle: "medium", timeStyle: "short" });
const errorText = (err: unknown) => err instanceof TypeError ? "Cannot reach the API. Please try again." : err instanceof Error ? err.message : "Something went wrong. Please try again.";

/** One-line summary of a role's access, e.g. "Orders: manage · Rides: view". */
function summary(permissions: string[], catalog: AdminPermissionSection[]) {
  return catalog.filter(s => permissions.includes(`${s.key}.view`))
    .map(s => ({ key: s.key, label: s.label, manage: permissions.includes(`${s.key}.manage`) }));
}

export default function AdminRolesPanel({ me, revision, onSaved }: { me: AdminProfile; revision: number; onSaved: (message: string) => void }) {
  const { api } = useAuth();
  const [data, setData] = useState<AdminRoles | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<AdminRole | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminRole | null>(null);
  const canManage = adminCan(me, "roles", "manage");
  useEffect(() => {
    const ctrl = new AbortController();
    api.adminRoles(ctrl.signal).then(result => { if (!ctrl.signal.aborted) { setData(result); setError(""); } })
      .catch(err => { if (!ctrl.signal.aborted) setError(errorText(err)); });
    return () => ctrl.abort();
  }, [api, revision, reload]);
  const saved = (message: string) => { setEditing(null); setDeleting(null); setReload(v => v + 1); onSaved(message); };
  if (!data) return error ? <div className="admin-error" role="alert">{error}<button className="admin-button" onClick={() => setReload(v => v + 1)}>Retry</button></div> : <div className="admin-loading" role="status"><span className="admin-spinner" />Loading roles…</div>;
  const total = data.catalog.reduce((n, s) => n + (s.manageDescription ? 2 : 1), 0);
  return <div className="admin-team">
    <section className="admin-panel admin-resource">
      <div className="admin-resource-toolbar">
        <div><h2 className="admin-roles-title">Roles</h2><p className="admin-field-help">A role is a set of permissions. Assign roles to administrators on the Administrators page.</p></div>
        {canManage && <div className="admin-toolbar-actions"><button className="admin-button primary" onClick={() => setEditing("new")}><AdminIcon name="plus" size={17} />Create role</button></div>}
      </div>
      <ul className="admin-team-grid">
        <li className="admin-team-card admin-role-card builtin">
          <div className="admin-team-card-head"><span className="admin-settings-card-icon"><AdminIcon name="shield" /></span><div><h3>Super administrator<span className="admin-chip">Built-in</span></h3><p>Full access to every section, including roles and administrators. Cannot be edited or deleted.</p></div></div>
          <div className="admin-role-perms"><span className="admin-chip">All {total} permissions</span></div>
          <div className="admin-team-card-foot"><span>{data.superAdministrators} active {data.superAdministrators === 1 ? "administrator" : "administrators"}</span></div>
        </li>
        {data.roles.map(role => {
          const parts = summary(role.permissions, data.catalog);
          const editable = canManage && adminCovers(me, role.permissions);
          return <li key={role.id} className="admin-team-card admin-role-card">
            <div className="admin-team-card-head"><span className="admin-settings-card-icon"><AdminIcon name="roles" /></span><div><h3>{role.name}</h3><p>{role.description || "No description"}</p></div></div>
            <div className="admin-role-perms">{parts.map(p => <span key={p.key} className={`admin-chip ${p.manage ? "manage" : ""}`}>{p.label}: {p.manage ? "manage" : "view"}</span>)}</div>
            <div className="admin-team-card-foot"><span>{role.administrators} {role.administrators === 1 ? "administrator" : "administrators"} · {role.permissions.length}/{total} permissions · updated {formatDate(role.updatedAt)}</span>
              {canManage && <div className="admin-role-actions">{editable ? <><button className="admin-button" onClick={() => setEditing(role)}>Edit</button><button className="admin-button danger" onClick={() => setDeleting(role)}>Delete</button></> : <span className="admin-field-help">Includes permissions you don’t hold</span>}</div>}
            </div>
          </li>;
        })}
      </ul>
      {data.roles.length === 0 && <div className="admin-empty"><span className="admin-empty-icon"><AdminIcon name="roles" size={28} /></span><h3>No custom roles yet</h3><p>{canManage ? "Create a role such as “Support agent” or “Finance viewer” to give administrators only the access they need." : "Every administrator currently has full access."}</p></div>}
      <p className="admin-team-note"><AdminIcon name="shield" size={16} />Permissions are checked by the API on every request. Changes to a role apply immediately to every administrator who has it. You can only grant permissions your own role includes.</p>
    </section>
    {editing && <RoleDialog me={me} role={editing === "new" ? null : editing} catalog={data.catalog} onClose={() => setEditing(null)} onSaved={saved} />}
    {deleting && <DeleteRoleDialog role={deleting} onClose={() => setDeleting(null)} onSaved={saved} />}
  </div>;
}

function useModal(onClose: () => void, busy: boolean) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close(); }, []);
  const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  return { dialog, close };
}

function RoleDialog({ me, role, catalog, onClose, onSaved }: { me: AdminProfile; role: AdminRole | null; catalog: AdminPermissionSection[]; onClose: () => void; onSaved: (message: string) => void }) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? []);
  const { dialog, close } = useModal(onClose, busy);
  const allowed = (code: string) => me.isSuperAdmin || me.permissions.includes(code);
  const set = (key: string, level: "view" | "manage", on: boolean) => setPermissions(p => togglePermission(p, key, level, on).filter(allowed));
  const allView = () => setPermissions(p => [...new Set([...p, ...catalog.map(s => `${s.key}.view`)])].filter(allowed));
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? "").trim();
    if (permissions.length === 0) { setError("Choose at least one permission."); return; }
    setBusy(true); setError("");
    try {
      const body = { name: get("name"), description: get("description"), permissions, reason: get("reason"), version: role?.version };
      if (role) { await api.updateAdminRole(role.id, body); onSaved(`Role “${body.name}” updated. Administrators with this role have the new permissions now.`); }
      else { await api.createAdminRole(body); onSaved(`Role “${body.name}” created. Assign it from the Administrators page.`); }
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="admin-record-dialog admin-role-dialog" aria-labelledby="role-title" onCancel={e => { e.preventDefault(); close(); }}>
    <form onSubmit={submit} className="admin-dialog-form">
      <header><div><span className="admin-eyebrow">Roles & permissions</span><h2 id="role-title">{role ? `Edit ${role.name}` : "Create a role"}</h2></div><button type="button" className="admin-icon-button" onClick={close} disabled={busy} aria-label="Close"><AdminIcon name="close" /></button></header>
      <div className="admin-dialog-body">{error && <div className="admin-error" role="alert">{error}</div>}
        <fieldset disabled={busy} className="admin-form">
          <div className="admin-form-columns"><label>Role name<input name="name" defaultValue={role?.name} required minLength={2} maxLength={60} placeholder="For example: Support agent" /></label><label>Description<input name="description" defaultValue={role?.description} maxLength={300} placeholder="What this role is for" /></label></div>
          <div className="admin-perm-head"><strong>Permissions <span className="admin-muted">({permissions.length} selected)</span></strong><div><button type="button" className="admin-text-link" onClick={allView}>Grant all view</button><button type="button" className="admin-text-link" onClick={() => setPermissions([])}>Clear</button></div></div>
          <div className="admin-table-scroll"><table className="admin-table admin-perm-table"><thead><tr><th scope="col">Section</th><th scope="col">View</th><th scope="col">Manage</th></tr></thead><tbody>
            {catalog.map(s => {
              const view = `${s.key}.view`, manage = `${s.key}.manage`;
              return <tr key={s.key}><th scope="row"><strong>{s.label}</strong><small>{permissions.includes(manage) && s.manageDescription ? s.manageDescription : s.viewDescription}</small></th>
                <td><input type="checkbox" aria-label={`${s.label}: view`} checked={permissions.includes(view)} disabled={!allowed(view)} onChange={e => set(s.key, "view", e.target.checked)} /></td>
                <td>{s.manageDescription ? <input type="checkbox" aria-label={`${s.label}: manage`} checked={permissions.includes(manage)} disabled={!allowed(manage)} onChange={e => set(s.key, "manage", e.target.checked)} /> : <span className="admin-muted">—</span>}</td></tr>;
            })}
          </tbody></table></div>
          <p className="admin-field-help">Manage includes view. My profile is always available to every administrator.{me.isSuperAdmin ? "" : " Greyed-out permissions are not part of your own role, so you cannot grant them."}</p>
          <label>Reason for change<textarea name="reason" placeholder="Explain why this role is needed…" required minLength={3} maxLength={300} rows={2} /><span className="admin-field-help">Saved with your name in the activity log.</span></label>
        </fieldset>
      </div>
      <footer><button className="admin-button" type="button" disabled={busy} onClick={close}>Cancel</button><button className="admin-button primary" disabled={busy}>{busy ? "Saving…" : role ? "Save role" : "Create role"}</button></footer>
    </form>
  </dialog>;
}

function DeleteRoleDialog({ role, onClose, onSaved }: { role: AdminRole; onClose: () => void; onSaved: (message: string) => void }) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { dialog, close } = useModal(onClose, busy);
  const blocked = role.administrators > 0;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try { await api.deleteAdminRole(role.id, String(new FormData(event.currentTarget).get("reason") ?? "").trim()); onSaved(`Role “${role.name}” deleted.`); }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="admin-record-dialog" aria-labelledby="delete-role-title" onCancel={e => { e.preventDefault(); close(); }}>
    <form onSubmit={submit} className="admin-dialog-form">
      <header><div><span className="admin-eyebrow">Roles & permissions</span><h2 id="delete-role-title">Delete {role.name}?</h2></div><button type="button" className="admin-icon-button" onClick={close} disabled={busy} aria-label="Close"><AdminIcon name="close" /></button></header>
      <div className="admin-dialog-body">{error && <div className="admin-error" role="alert">{error}</div>}
        <fieldset disabled={busy || blocked} className="admin-form">
          {blocked ? <p className="admin-maintenance-warning">{role.administrators} {role.administrators === 1 ? "administrator has" : "administrators have"} this role. Move them to another role on the Administrators page before deleting it.</p>
            : <p className="admin-notice">The role is removed permanently. No administrators are assigned to it.</p>}
          <label>Reason for change<textarea name="reason" required minLength={3} maxLength={300} rows={2} /></label>
        </fieldset>
      </div>
      <footer><button className="admin-button" type="button" disabled={busy} onClick={close}>Cancel</button><button className="admin-button danger" disabled={busy || blocked}>{busy ? "Deleting…" : "Delete role"}</button></footer>
    </form>
  </dialog>;
}
