"use client";

import { useQueryClient } from "@tanstack/react-query";
import { clearPrivateQueries } from "@/lib/public-auth-query";
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
  accessTokenExpiresSoon,
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
  logout: (allDevices?: boolean) => Promise<void>;
  connectionError: string | null;
  retrySession: () => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  isLoading: true,
  isAdmin: false,
  role: null,
  connectionError: null,
  retrySession: () => {},
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
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const retrySession = useCallback(
    () => window.dispatchEvent(new Event("auth:retry")),
    [],
  );

  useEffect(() => {
    try {
      window.localStorage.removeItem("pentaworks_dashboard_snapshot_v1");
    } catch {
      /* Storage unavailable. */
    }
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const restore = async () => {
      const stored = readStoredSession();
      setConnectionError(null);
      if (stored && !accessTokenExpiresSoon(stored)) {
        setSession(sessionFromStorage());
        setIsLoading(false);
        return;
      }
      try {
        await refreshAccessToken();
        if (!disposed) {
          setSession(sessionFromStorage());
          setIsLoading(false);
        }
      } catch (error) {
        if (disposed) return;
        if (error instanceof ApiError && error.status === 401) {
          const current = readStoredSession();
          if (current && current.accessToken !== stored?.accessToken) {
            setSession(sessionFromStorage());
          } else {
            clearStoredSession();
            clearPrivateQueries(queryClient);
            setSession(null);
          }
          setIsLoading(false);
        } else {
          // Offline phones and restarting servers cannot prove a session expired.
          // Keep the account and retry; API authorization is still checked by the server.
          if (stored) {
            setSession(sessionFromStorage());
            setIsLoading(false);
          }
          setConnectionError(
            "서버에 연결하지 못했습니다. 로그인은 유지되며 자동으로 다시 연결합니다.",
          );
          setIsLoading(false);
          retryTimer = setTimeout(() => {
            void restore();
          }, 10_000);
        }
      }
    };
    const retry = () => {
      clearTimeout(retryTimer);
      void restore();
    };
    void restore();
    window.addEventListener("online", retry);
    window.addEventListener("auth:retry", retry);
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      window.removeEventListener("online", retry);
      window.removeEventListener("auth:retry", retry);
    };
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
      setConnectionError(null);
      setIsLoading(false);
      setSession(next);
      return next;
    },
    [queryClient],
  );

  const logout = useCallback(
    async (allDevices = false) => {
      await requestLogout(allDevices);
      queryClient.clear();
      clearStoredSession();
      setConnectionError(null);
      setIsLoading(false);
      setSession(null);
    },
    [queryClient],
  );

  useEffect(() => {
    const refreshed = () => {
      setSession(sessionFromStorage());
      setConnectionError(null);
      setIsLoading(false);
    };
    const expired = () => {
      clearPrivateQueries(queryClient);
      setSession(null);
      setConnectionError(null);
      setIsLoading(false);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "pentaworks_session_v2" || event.key === null) {
        clearPrivateQueries(queryClient);
        refreshed();
      }
    };
    window.addEventListener("auth:refreshed", refreshed);
    window.addEventListener("auth:expired", expired);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("auth:refreshed", refreshed);
      window.removeEventListener("auth:expired", expired);
      window.removeEventListener("storage", storage);
    };
  }, [queryClient]);

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      isLoading,
      connectionError,
      retrySession,
      isAdmin:
        session?.role === "PLATFORM_ADMIN" ||
        session?.role === "SUPER_ADMIN" ||
        session?.role === "ADMIN",
      role: session?.role ?? null,
      login,
      logout,
    }),
    [session, isLoading, connectionError, retrySession, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
