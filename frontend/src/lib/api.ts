import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
  type StoredSession,
} from "@/lib/auth";
import type { MetricKey } from "@/lib/metrics";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1"
).replace(/\/$/, "");

export type Role = "SUPER_ADMIN" | "ADMIN" | "USER";

export type Session = {
  id: number;
  email: string;
  name: string;
  role: Role;
};

type AuthResponse = {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: Session;
};

export type PsiThreshold = {
  siteid: string;
  name: string | null;
  min: number | null;
  max: number | null;
  active: boolean;
};

export type AlertThreshold = {
  key: MetricKey;
  label: string;
  unit: string | null;
  min: number;
  max: number;
  active: boolean;
};

export type SiteAlertSettings = {
  siteid: string;
  name: string | null;
  configured: boolean;
  thresholds: AlertThreshold[];
};

let refreshPromise: Promise<StoredSession> | null = null;

async function errorFrom(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  return new Error(body?.message ?? `API request failed (${response.status})`);
}

function storeAuthResponse(result: AuthResponse): StoredSession {
  const stored = {
    ...result.user,
    accessToken: result.accessToken,
    accessTokenExpiresAt: result.accessTokenExpiresAt,
  };
  writeStoredSession(stored);
  window.dispatchEvent(new Event("auth:refreshed"));
  return stored;
}

export async function refreshAccessToken(): Promise<StoredSession> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) throw await errorFrom(response);
    return storeAuthResponse((await response.json()) as AuthResponse);
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const token = readStoredSession()?.accessToken;
  if (token && !path.startsWith("/auth/"))
    headers.set("Authorization", `Bearer ${token}`);

  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (response.status === 401 && !path.startsWith("/auth/")) {
    try {
      const refreshed = await refreshAccessToken();
      headers.set("Authorization", `Bearer ${refreshed.accessToken}`);
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        credentials: "include",
        headers,
      });
    } catch {
      clearStoredSession();
      window.dispatchEvent(new Event("auth:expired"));
    }
  }

  if (!response.ok) throw await errorFrom(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiFetchBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  const token = readStoredSession()?.accessToken;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers,
  });
  if (response.status === 401) {
    try {
      const refreshed = await refreshAccessToken();
      headers.set("Authorization", `Bearer ${refreshed.accessToken}`);
      response = await fetch(`${API_BASE_URL}${path}`, {
        credentials: "include",
        headers,
      });
    } catch {
      clearStoredSession();
      window.dispatchEvent(new Event("auth:expired"));
    }
  }
  if (!response.ok) throw await errorFrom(response);
  return response.blob();
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw await errorFrom(response);
  return storeAuthResponse((await response.json()) as AuthResponse);
}

export async function logout() {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  }).catch(() => undefined);
}
