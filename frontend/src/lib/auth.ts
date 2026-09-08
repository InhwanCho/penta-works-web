import type { Role, Session } from "@/lib/api";

export type { Role, Session };

const STORAGE_KEY = "pentaworks_session";

export type StoredSession = Session & { accessToken: string };

export function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "null",
    ) as StoredSession | null;
    return value?.username && value?.role && value?.accessToken ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredSession(session: StoredSession): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
