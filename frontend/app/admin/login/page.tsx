"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import AdminIcon from "@/components/admin/AdminIcon";
import { useAdminT } from "@/lib/admin-i18n";

export default function AdminLoginPage() {
  const { api, user, ready, logout } = useAuth();
  const router = useRouter();
  const { a } = useAdminT();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  useEffect(() => { if (ready && user?.role === "Admin") router.replace("/admin"); }, [ready, user, router]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      await api.adminLogin(String(data.get("email")).trim(), String(data.get("password")));
      router.replace("/admin");
    } catch (err) { setError(err instanceof TypeError ? a("Cannot reach the server. Check that the API is running and try again.") : err instanceof Error ? err.message : a("Sign-in failed. Please try again.")); }
    finally { setBusy(false); }
  }
  return <div className="admin-login">
    <div className="admin-login-brand"><span className="admin-logo">{BRAND.name[0]}</span><strong>{BRAND.name}</strong><span className="admin-badge">{a("ADMIN CONSOLE")}</span></div>
    <div className="admin-login-card">
      <span className="admin-eyebrow">{a("PLATFORM MANAGEMENT")}</span><h1>{a("One place.")}<br />{a("Every operation.")}</h1>
      <p className="admin-muted">{a("Sign in to your super-admin workspace.")}</p>
      {!ready ? <p role="status">{a("Checking your session…")}</p> : user && user.role !== "Admin" ? <div className="admin-notice">{a("You are signed in as {name}. Sign out to use an administrator account.", { name: user.fullName })}<button className="admin-button primary" onClick={logout}>{a("Sign out")}</button></div> :
        <form onSubmit={submit} className="admin-form">
          {error && <div className="admin-error" role="alert">{error}</div>}
          <label>{a("Email address")}<input name="email" type="email" autoComplete="username" placeholder="admin@example.com" required maxLength={254} autoFocus /></label>
          <label>{a("Password")}<div className="admin-password"><input name="password" type={show ? "text" : "password"} autoComplete="current-password" required maxLength={128} /><button type="button" onClick={() => setShow(!show)} aria-label={a(show ? "Hide password" : "Show password")} title={a(show ? "Hide password" : "Show password")} aria-pressed={show}><AdminIcon name={show ? "eyeOff" : "eye"} size={19} /></button></div></label>
          <button className="admin-button primary" disabled={busy}>{busy ? a("Signing in…") : a("Sign in to dashboard")}</button>
        </form>}
    </div>
    <Link href="/" className="admin-back-link">{a("Back to {brand}", { brand: BRAND.name })}</Link>
  </div>;
}
