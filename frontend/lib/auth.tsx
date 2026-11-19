"use client";

/**
 * Shares ONE api client (from lib/api.ts) across the app so the login token
 * is reused by every page.
 *
 * The login is saved in sessionStorage, so refreshing the page keeps you logged in,
 * and closing the tab logs you out. (A demo trade-off: any script on the page could
 * read sessionStorage, so a real app would use secure cookies instead.)
 *
 * Private account data is scoped immediately when the session changes and is
 * synchronized by AccountSync. Public views poll the API independently.
 * Offline ride simulation requires explicit configuration.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ApiError, createApiClient, type AuthResponse, type RegisterRequest, type User } from "./api";
import { selectLocalAccount } from "./local-store";

type Api = ReturnType<typeof createApiClient>;
interface AuthValue {
  api: Api;
  user: User | null;
  /** false until a saved login (if any) has been restored; avoids flashing "please log in" */
  ready: boolean;
  /** null until checked, then whether the backend answered */
  online: boolean | null;
  /** Ask whether the backend is up (only checks once per page load). */
  checkOnline: () => void;
  login: (phoneNumber: string, password: string) => Promise<User>;
  register: (body: RegisterRequest) => Promise<User>;
  updateProfile: (fullName: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);
const SESSION_KEY = "grab-session";
const subscribeHydration = () => () => {};
const getHydrated = () => true;
const getServerHydrated = () => false;

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
  const owner = user?.id;

  useEffect(() => {
    if (!owner) return;
    const ctrl = new AbortController();
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try { await api.refreshMe(ctrl.signal); } catch { /* account sync displays connectivity state */ }
      finally { busy = false; }
    };
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, 15000);
    window.addEventListener("focus", refresh);
    return () => { ctrl.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [api, owner]);

  // A 401 or token expiry must also update the navbar and saved browser session.
  useEffect(() => api.subscribeSession((session) => {
    selectLocalAccount(session?.user.id ?? null);
    saveSession(session);
    setUser(session?.user ?? null);
  }), [api]);

  useEffect(() => {
    const session = api.getSession();
    if (!session) return;
    const timer = setTimeout(() => api.logout(), Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [api, user]);

  // On first load: restore a saved login. The backend is only contacted if there is one.
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const saved = readSession();
    const restored = saved ? api.restoreSession(saved) : false;
    if (saved && !restored) saveSession(null); // expired

    const restore = restored && saved
      ? api.refreshMe(ctrl.signal).then(
          () => { if (!cancelled && api.getSession()?.accessToken === saved.accessToken) setOnline(true); },
          (err) => {
            if (cancelled) return;
            if (err instanceof ApiError && err.status === 401) { if (!api.getSession()) saveSession(null); setOnline(true); }
            else if (api.getSession()?.accessToken === saved.accessToken) { setUser(saved.user); if (err instanceof TypeError || (err instanceof DOMException && err.name === "TimeoutError")) setOnline(false); } // offline: trust the saved login for display
          })
      : Promise.resolve();
    restore.then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; ctrl.abort(); };
  }, [api]);

  // Checked at most once, and only when a page asks (see useRideService).
  const checking = useRef(false);
  const checkOnline = useCallback(() => {
    if (checking.current) return;
    checking.current = true;
    api.isOnline().then(setOnline);
  }, [api]);

  const value = useMemo<AuthValue>(() => ({
    api,
    user,
    ready,
    online,
    checkOnline,
    login: async (phoneNumber, password) => {
      const u = await api.login(phoneNumber, password);
      // subscribeSession owns persistence and UI state, including logout races.
      setOnline(true);
      return u;
    },
    register: async (body) => {
      const u = await api.register(body);
      setOnline(true);
      return u;
    },
    updateProfile: (fullName) => api.updateProfile({ fullName }),
    logout: () => { api.logout(); saveSession(null); setUser(null); },
  }), [api, user, ready, online, checkOnline]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  const hydrated = useSyncExternalStore(subscribeHydration, getHydrated, getServerHydrated);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  // A Suspense child can hydrate after the provider restores a saved session.
  // Its first render must still match the guest state used to generate its HTML.
  return hydrated ? ctx : { ...ctx, user: null, ready: false, online: null };
}

/** Keep server errors in the selected UI language; API details are authored in English. */
export function errorMessage(err: unknown, t: (key: "error.network" | "error.generic" | "error.validation" | "error.unauthorized" | "error.forbidden" | "error.notFound" | "error.conflict" | "error.rateLimit" | "error.server") => string) {
  if (err instanceof TypeError || (err instanceof DOMException && err.name === "TimeoutError")) return t("error.network");
  if (typeof document !== "undefined" && document.documentElement.lang === "km") {
    if (err instanceof ApiError) {
      if (err.status === 400 || err.status === 422) return t("error.validation");
      if (err.status === 401) return t("error.unauthorized");
      if (err.status === 403) return t("error.forbidden");
      if (err.status === 404) return t("error.notFound");
      if (err.status === 409) return t("error.conflict");
      if (err.status === 429) return t("error.rateLimit");
      if (err.status >= 500) return t("error.server");
    }
    return t("error.generic");
  }
  return err instanceof Error && err.message ? err.message : t("error.generic");
}
