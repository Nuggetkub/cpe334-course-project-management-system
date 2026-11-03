import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "../api";
import { clearToken, getToken, setToken } from "./token";

export type Role = "STUDENT" | "SUPERVISOR";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

type AuthState = { status: "loading" } | { status: "anonymous" } | { status: "authenticated"; user: User };

interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => (getToken() ? { status: "loading" } : { status: "anonymous" }));

  // A stored token is only a claim: the server decides (expired or logged-out
  // tokens get 401), so the UI never trusts a role it has not just been told.
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    apiFetch<{ user: User }>("/api/auth/me")
      .then(({ user }) => {
        if (!cancelled) setState({ status: "authenticated", user });
      })
      .catch(() => {
        clearToken();
        if (!cancelled) setState({ status: "anonymous" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await apiFetch<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(token);
    setState({ status: "authenticated", user });
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST", body: {} });
    } catch {
      // Sign out locally even if the server call fails; the token expires anyway.
    } finally {
      clearToken();
      setState({ status: "anonymous" });
    }
  }, []);

  const value = useMemo(() => ({ state, login, logout }), [state, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
