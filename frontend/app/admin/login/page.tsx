"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export default function AdminLoginPage() {
  const { api, user, ready, logout } = useAuth();
  const router = useRouter();
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
    } catch (err) { setError(err instanceof TypeError ? "Cannot reach the server. Check that the API is running and try again." : err instanceof Error ? err.message : "Sign-in failed. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="admin-login">
    <div className="admin-login-brand"><span className="admin-logo">{BRAND.name[0]}</span><strong>{BRAND.name}</strong><span className="admin-badge">ADMIN CONSOLE</span></div>
    <div className="admin-login-card">
      <span className="admin-eyebrow">PLATFORM MANAGEMENT</span><h1>One place.<br />Every operation.</h1>
      <p className="admin-muted">Sign in to your super-admin workspace.</p>
      {!ready ? <p role="status">Checking your session…</p> : user && user.role !== "Admin" ? <div className="admin-notice">You are signed in as {user.fullName}. Sign out to use an administrator account.<button className="admin-button primary" onClick={logout}>Sign out</button></div> :
        <form onSubmit={submit} className="admin-form">
          {error && <div className="admin-error" role="alert">{error}</div>}
          <label>Email address<input name="email" type="email" autoComplete="username" placeholder="admin@example.com" required maxLength={254} autoFocus /></label>
          <label>Password<div className="admin-password"><input name="password" type={show ? "text" : "password"} autoComplete="current-password" required maxLength={128} /><button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>{show ? "Hide" : "Show"}</button></div></label>
          <button className="admin-button primary" disabled={busy}>{busy ? "Signing in…" : "Sign in to dashboard"}</button>
        </form>}
      <p className="admin-login-note">Administrator access only. Changes are recorded in the activity log.</p>
    </div>
    <Link href="/" className="admin-back-link">Back to {BRAND.name}</Link>
  </div>;
}
