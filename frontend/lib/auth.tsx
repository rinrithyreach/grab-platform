"use client";

/**
 * Shares ONE api client (from lib/api.ts) across the app so the login token
 * is reused by every page.
 *
 * The login is saved in sessionStorage, so refreshing the page keeps you logged in,
 * and closing the tab logs you out. (A demo trade-off: any script on the page could
 * read sessionStorage, so a real app would use secure cookies instead.)
 *
 * It also checks once whether the backend is reachable; the ride pages use
 * `online === false` to switch to demo mode.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, createApiClient, type AuthResponse, type RegisterRequest, type User } from "./api";

type Api = ReturnType<typeof createApiClient>;
interface AuthValue {
  api: Api;
  user: User | null;
  /** false until a saved login (if any) has been restored; avoids flashing "please log in" */
  ready: boolean;
  /** null while checking, then whether the backend answered */
  online: boolean | null;
  login: (email: string, password: string) => Promise<User>;
  register: (body: RegisterRequest) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);
const SESSION_KEY = "grab-session";

function saveSession(session: AuthResponse | null) {
  try {
    if (session) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.sessionStorage.removeItem(SESSION_KEY);
  } catch { /* storage blocked: login just won't survive a refresh */ }
}

function readSession(): AuthResponse | null {
  try { return JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? "null"); } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [api] = useState(() => createApiClient());
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);

  // On first load: restore a saved login and check whether the backend is up.
  useEffect(() => {
    let cancelled = false;
    const saved = readSession();
    const restored = saved ? api.restoreSession(saved) : false;
    if (saved && !restored) saveSession(null); // expired

    api.isOnline().then(async (isUp) => {
      if (cancelled) return;
      setOnline(isUp);
      if (restored && saved) {
        if (!isUp) setUser(saved.user); // can't verify offline; trust the saved login for display
        else {
          try { setUser(await api.me()); }
          catch (err) {
            if (err instanceof ApiError && err.status === 401) { api.logout(); saveSession(null); }
            else setUser(saved.user);
          }
        }
      }
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, [api]);

  const value = useMemo<AuthValue>(() => ({
    api,
    user,
    ready,
    online,
    login: async (email, password) => {
      const u = await api.login(email, password);
      saveSession(api.getSession());
      setUser(u);
      return u;
    },
    register: async (body) => {
      const u = await api.register(body);
      saveSession(api.getSession());
      setUser(u);
      return u;
    },
    logout: () => { api.logout(); saveSession(null); setUser(null); },
  }), [api, user, ready, online]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Turns an API/network error into text. Server messages come from the backend (English). */
export function errorMessage(err: unknown, t: (key: "error.network" | "error.generic") => string) {
  if (err instanceof TypeError) return t("error.network");
  return err instanceof Error && err.message ? err.message : t("error.generic");
}
