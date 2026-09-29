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
  noDataMinutes: number;
  noDataActive: boolean;
};

export type AlertEventSummary = {
  id: number;
  siteId: string;
  siteName: string | null;
  metricKey: MetricKey | "__data__";
  eventType: "LOW" | "HIGH" | "NO_DATA" | "RECOVERY";
  severity: string;
  measuredValue: number | null;
  min: number | null;
  max: number | null;
  message: string;
  deliveryStatus: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
  occurredAt: string;
  acknowledgedAt: string | null;
  recoveredAt: string | null;
};

export type AlertRecipient = {
  id: number;
  siteId: string;
  siteName: string | null;
  userId: number;
  userName: string;
  channel: "SLACK_WEBHOOK";
  destinationMasked: string;
  quietStart: string | null;
  quietEnd: string | null;
  enabled: boolean;
};

let refreshPromise: Promise<StoredSession> | null = null;

function isPublicAuthPath(path: string) {
  return path === "/auth/login" || path === "/auth/refresh" || path === "/auth/logout" ||
    path.startsWith("/auth/invitations/") || path.startsWith("/auth/password-resets/");
}

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
  if (token && !isPublicAuthPath(path))
    headers.set("Authorization", `Bearer ${token}`);

  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (response.status === 401 && !isPublicAuthPath(path)) {
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
