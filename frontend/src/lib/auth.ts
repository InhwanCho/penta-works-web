import type { Role, Session } from "@/lib/api";

export type { Role, Session };

const STORAGE_KEY = "pentaworks_session_v2";

export type StoredSession = Session & {
  accessToken: string;
  accessTokenExpiresAt: string;
};

export function accessTokenExpiresSoon(session: StoredSession, marginMs = 5 * 60 * 1000): boolean {
  const expiresAt = Date.parse(session.accessTokenExpiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now() + marginMs;
}

export function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "null",
    ) as StoredSession | null;
    return value?.email &&
      value?.role &&
      value?.accessToken &&
      value?.accessTokenExpiresAt
      ? value
      : null;
  } catch {
    return null;
  }
}

export function writeStoredSession(session: StoredSession): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem("pentaworks_session");
}
