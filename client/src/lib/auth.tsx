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

// Token is held in module memory only (NOT localStorage — blocked in the iframe sandbox).
let memoryToken: string | null = null;

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
      setToken(t);
      setUser(u);
      qc.invalidateQueries();
      return u;
    } catch {
      memoryToken = null;
      setToken(null);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    memoryToken = null;
    setToken(null);
    setUser(null);
    qc.clear();
  }

  // Re-hydrate if a token survives client-side navigation within the session.
  useEffect(() => {
    if (memoryToken && !user) {
      loginWithToken(memoryToken);
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
