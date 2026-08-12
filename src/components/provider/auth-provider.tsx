"use client";

import {
  type Role,
  type Session,
  clearSessionCookie,
  readSessionCookie,
  verifyCredentials,
  writeSessionCookie,
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
  /** 쿠키 확인 전에는 true — 이 동안 권한 판정을 미룹니다. */
  isLoading: boolean;
  isAdmin: boolean;
  role: Role | null;
  /** 성공 시 null, 실패 시 사용자에게 보여줄 메시지 */
  login: (username: string, password: string) => string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  isLoading: true,
  isAdmin: false,
  role: null,
  login: () => "인증 provider가 초기화되지 않았습니다.",
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 쿠키는 클라이언트에서만 읽을 수 있으므로 마운트 후 1회 복원합니다.
  useEffect(() => {
    setSession(readSessionCookie());
    setIsLoading(false);
  }, []);

  const login = useCallback((username: string, password: string) => {
    const next = verifyCredentials(username, password);
    if (!next) return "아이디 또는 비밀번호가 올바르지 않습니다.";

    writeSessionCookie(next);
    setSession(next);
    return null;
  }, []);

  const logout = useCallback(() => {
    clearSessionCookie();
    setSession(null);
  }, []);

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
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
