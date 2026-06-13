import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { apiRequest } from "./queryClient";

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  loginWithToken: (token: string) => Promise<User | null>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

// Token persistence: prefer localStorage (so page refresh keeps you signed in),
// fall back to module memory when storage is unavailable (sandboxed iframes).
const STORAGE_KEY = "tunersamerica.token";
function readStoredToken(): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function writeStoredToken(t: string | null) {
  try {
    if (typeof window === "undefined") return;
    if (t) window.localStorage.setItem(STORAGE_KEY, t);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
let memoryToken: string | null = readStoredToken();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(memoryToken);
  const [loading, setLoading] = useState<boolean>(!!memoryToken);
  const qc = useQueryClient();

  async function loginWithToken(t: string): Promise<User | null> {
    setLoading(true);
    try {
      const res = await apiRequest("GET", `/api/me?token=${encodeURIComponent(t)}`);
      const u = (await res.json()) as User;
      memoryToken = t;
      writeStoredToken(t);
      setToken(t);
      setUser(u);
      qc.invalidateQueries();
      return u;
    } catch {
      memoryToken = null;
      writeStoredToken(null);
      setToken(null);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    memoryToken = null;
    writeStoredToken(null);
    setToken(null);
    setUser(null);
    qc.clear();
  }

  // Re-hydrate on mount (covers full page refresh as well as in-session nav).
  useEffect(() => {
    const stored = memoryToken || readStoredToken();
    if (stored && !user) {
      loginWithToken(stored);
    } else if (!stored) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
