"use client";

/**
 * Shares ONE api client (from lib/api.ts) across the app so the login token
 * is reused by every page. Tokens live in memory only, so a page reload logs out.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createApiClient, type RegisterRequest, type User } from "./api";

type Api = ReturnType<typeof createApiClient>;
interface AuthValue {
  api: Api;
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  register: (body: RegisterRequest) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [api] = useState(() => createApiClient());
  const [user, setUser] = useState<User | null>(null);

  const value = useMemo<AuthValue>(() => ({
    api,
    user,
    login: async (email, password) => { const u = await api.login(email, password); setUser(u); return u; },
    register: async (body) => { const u = await api.register(body); setUser(u); return u; },
    logout: () => { api.logout(); setUser(null); },
  }), [api, user]);

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
