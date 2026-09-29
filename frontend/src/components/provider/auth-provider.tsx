"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  login as requestLogin,
  logout as requestLogout,
  refreshAccessToken,
} from "@/lib/api";
import {
  type Role,
  type Session,
  clearStoredSession,
  readStoredSession,
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
  login: (email: string, password: string) => Promise<Session>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  isLoading: true,
  isAdmin: false,
  role: null,
  login: async () => Promise.reject(new Error("AuthProvider is unavailable")),
  logout: async () => {},
});

function sessionFromStorage(): Session | null {
  const stored = readStoredSession();
  if (!stored) return null;
  return {
    id: stored.id,
    email: stored.email,
    name: stored.name,
    role: stored.role,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = sessionFromStorage();
    if (stored) {
      setSession(stored);
      setIsLoading(false);
    }

    refreshAccessToken()
      .then((refreshed) => {
        setSession({
          id: refreshed.id,
          email: refreshed.email,
          name: refreshed.name,
          role: refreshed.role,
        });
      })
      .catch((error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          clearStoredSession();
          queryClient.clear();
          setSession(null);
        } else if (!stored) setSession(null);
      })
      .finally(() => setIsLoading(false));
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await requestLogin(email, password);
      queryClient.clear();
      const next = {
        id: result.id,
        email: result.email,
        name: result.name,
        role: result.role,
      };
      setSession(next);
      return next;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    await requestLogout();
    queryClient.clear();
    clearStoredSession();
    setSession(null);
  }, [queryClient]);

  useEffect(() => {
    const refreshed = () => setSession(sessionFromStorage());
    const expired = () => {
      queryClient.clear();
      setSession(null);
    };
    window.addEventListener("auth:refreshed", refreshed);
    window.addEventListener("auth:expired", expired);
    return () => {
      window.removeEventListener("auth:refreshed", refreshed);
      window.removeEventListener("auth:expired", expired);
    };
  }, [queryClient]);

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      isLoading,
      isAdmin:
        session?.role === "PLATFORM_ADMIN" || session?.role === "SUPER_ADMIN" || session?.role === "ADMIN",
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
