"use client";

import { useQueryClient } from "@tanstack/react-query";
import { login as requestLogin } from "@/lib/api";
import {
  type Role,
  type Session,
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from "@/lib/auth";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface AuthContextType {
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  role: Role | null;
  login: (username: string, password: string) => Promise<Session | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  isLoading: true,
  isAdmin: false,
  role: null,
  login: async () => null,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = readStoredSession();
    setSession(
      stored ? { username: stored.username, role: stored.role } : null,
    );
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await requestLogin(username, password);
      queryClient.clear();
      writeStoredSession({ ...result.user, accessToken: result.accessToken });
      setSession(result.user);
      return result.user;
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    queryClient.clear();
    clearStoredSession();
    setSession(null);
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener("auth:expired", logout);
    return () => window.removeEventListener("auth:expired", logout);
  }, [logout]);

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      isLoading,
      isAdmin: session?.role === "admin",
      role: session?.role ?? null,
      login,
      logout,
    }),
    [session, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
