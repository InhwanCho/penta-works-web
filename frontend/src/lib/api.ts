import { readStoredSession, clearStoredSession } from "@/lib/auth";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1"
).replace(/\/$/, "");

export type Role = "admin" | "user";

export type Session = { username: string; role: Role };

export type PsiThreshold = {
  siteid: string;
  name: string | null;
  min: number | null;
  max: number | null;
  active: boolean;
};

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const token = readStoredSession()?.accessToken;
  if (token && path !== "/auth/login")
    headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  if (
    typeof window !== "undefined" &&
    Boolean(token) &&
    response.status === 401 &&
    path !== "/auth/login" &&
    token === readStoredSession()?.accessToken
  ) {
    clearStoredSession();
    window.dispatchEvent(new Event("auth:expired"));
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? `API request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function apiFetchBlob(path: string): Promise<Blob> {
  const token = readStoredSession()?.accessToken;
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (
    typeof window !== "undefined" &&
    Boolean(token) &&
    response.status === 401 &&
    token === readStoredSession()?.accessToken
  ) {
    clearStoredSession();
    window.dispatchEvent(new Event("auth:expired"));
  }
  if (!response.ok) throw new Error(`API request failed (${response.status})`);
  return response.blob();
}

export async function login(username: string, password: string) {
  return apiFetch<{ accessToken: string; user: Session }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}
