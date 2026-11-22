"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { adminCan, type AdminProfile, type AdminRole } from "@/lib/admin-settings";
import AdminIcon from "./AdminIcon";
import { useAdminDialog } from "./useAdminDialog";
import { AdminAccountFields, grantableRoles, SUPER_ROLE, temporaryPassword } from "./AdminTeamPanel";

const errorText = (err: unknown) => err instanceof TypeError ? "Cannot reach the API. Please try again." : err instanceof Error ? err.message : "Something went wrong. Please try again.";

/** Creates a customer account (phone sign-in) or, with team permission, an administrator account with a role. */
export default function AdminCreateUserDialog({ me, onClose, onSaved }: { me: AdminProfile; onClose: () => void; onSaved: (message: string) => void }) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canAddAdmin = adminCan(me, "team", "manage");
  const [type, setType] = useState<"customer" | "admin">("customer");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [roles, setRoles] = useState<AdminRole[] | null>(null);
  const [roleValue, setRoleValue] = useState("");
  useEffect(() => {
    if (type !== "admin" || roles) return;
    const ctrl = new AbortController();
    api.adminRoles(ctrl.signal).then(data => {
      if (ctrl.signal.aborted) return;
      setRoles(data.roles);
      const options = grantableRoles(me, data.roles);
      setRoleValue(options.find(o => o.value !== SUPER_ROLE)?.value ?? options[0]?.value ?? "");
    }).catch(err => { if (!ctrl.signal.aborted) setError(errorText(err)); });
    return () => ctrl.abort();
  }, [api, me, roles, type]);
  const { dialog, close } = useAdminDialog(onClose, busy);
  const options = roles ? grantableRoles(me, roles) : [];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? "").trim();
    if (password.length < 12) { setError("Use a password of at least 12 characters."); return; }
    setBusy(true); setError("");
    try {
      if (type === "admin") {
        if (!roleValue) throw new Error("Choose a role for the new administrator.");
        await api.createAdmin({ fullName: get("fullName"), email: get("email"), jobTitle: get("jobTitle"), temporaryPassword: password, reason: get("reason"), adminRoleId: roleValue === SUPER_ROLE ? null : roleValue });
        onSaved(`Administrator ${get("fullName")} created. They sign in at /admin/login with their email and the temporary password.`);
      } else {
        await api.adminCreateUser({ fullName: get("fullName"), phoneNumber: get("phoneNumber"), email: get("email"), password, reason: get("reason") });
        onSaved(`Customer account for ${get("fullName")} created. They sign in with their phone number and the password you set.`);
      }
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="admin-record-dialog" aria-labelledby="create-user-title" onCancel={e => { e.preventDefault(); close(); }}>
    <form onSubmit={submit} className="admin-dialog-form">
      <header><div><span className="admin-eyebrow">Users & access</span><h2 id="create-user-title">Create a user</h2></div><button type="button" className="admin-icon-button" onClick={close} disabled={busy} aria-label="Close"><AdminIcon name="close" /></button></header>
      <div className="admin-dialog-body">{error && <div className="admin-error" role="alert">{error}</div>}
        <fieldset disabled={busy} className="admin-form admin-account-type">
          <legend>Account type</legend>
          <div className="admin-choice-group">
            <label className="admin-choice"><input type="radio" name="type" checked={type === "customer"} onChange={() => { setType("customer"); setError(""); }} /><span className="admin-choice-icon"><AdminIcon name="users" size={18} /></span><span><strong>Customer</strong><small>Signs in to the app with a phone number</small></span></label>
            {canAddAdmin && <label className="admin-choice"><input type="radio" name="type" checked={type === "admin"} onChange={() => { setType("admin"); setError(""); }} /><span className="admin-choice-icon"><AdminIcon name="shield" size={18} /></span><span><strong>Administrator</strong><small>Signs in to this console with an email and a role</small></span></label>}
          </div>
          <p className="admin-field-help">Merchant and driver accounts are created through merchant registration and the Drivers section.</p>
        </fieldset>
        {type === "admin" ? <AdminAccountFields password={password} setPassword={setPassword} show={show} setShow={setShow} busy={busy}>
          <label>Role<select value={roleValue} onChange={e => setRoleValue(e.target.value)} required disabled={!roles}>{!roles && <option value="">Loading roles…</option>}{roles && options.length === 0 && <option value="">No role available</option>}{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
        </AdminAccountFields> : <fieldset disabled={busy} className="admin-form">
          <label>Full name<input name="fullName" required minLength={2} maxLength={120} autoComplete="off" /></label>
          <div className="admin-form-columns"><label>Phone number<input name="phoneNumber" type="tel" required maxLength={30} placeholder="012 345 678" autoComplete="off" /></label><label>Email (optional)<input name="email" type="email" maxLength={254} autoComplete="off" /></label></div>
          <label>Password<div className="admin-password-row"><input type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" /><button type="button" className="admin-button" onClick={() => { setPassword(temporaryPassword()); setShow(true); }}>Generate</button></div><span className="admin-field-help">12–128 characters. Share it with the customer privately.</span></label>
          <label className="admin-checkbox"><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />Show password</label>
          <label>Reason for change<textarea name="reason" placeholder="For example: account created for phone support customer" required minLength={3} maxLength={300} rows={3} /><span className="admin-field-help">Saved with your name in the activity log.</span></label>
        </fieldset>}
      </div>
      <footer><button className="admin-button" type="button" disabled={busy} onClick={close}>Cancel</button><button className="admin-button primary" disabled={busy || (type === "admin" && !roleValue)}>{busy ? "Creating…" : "Create user"}</button></footer>
    </form>
  </dialog>;
}
