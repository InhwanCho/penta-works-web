import {
  clearStoredSession,
  accessTokenExpiresSoon,
  readStoredSession,
  writeStoredSession,
  type StoredSession,
} from "@/lib/auth";
import type { MetricKey } from "@/lib/metrics";
import { mutationSuccessMessage } from "@/lib/mutation-feedback";
import { showToast } from "@/lib/toast";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1"
).replace(/\/$/, "");

export type Role = "PLATFORM_ADMIN" | "SUPER_ADMIN" | "ADMIN" | "USER";

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
  effectiveMin: number;
  effectiveMax: number;
  useAverage: boolean;
  tolerancePercent: number;
  averageValue: number | null;
  averageSampleCount: number;
  excludedZeroCount: number;
  averageCapturedAt: string | null;
  averageApplied: boolean;
  averageUnavailableReason?: string | null;
  historicalAverage?: boolean;
};

export type SiteAlertSettings = {
  siteid: string;
  name: string | null;
  configured: boolean;
  thresholds: AlertThreshold[];
  noDataMinutes: number;
  noDataActive: boolean;
  collectionIntervalMinutes: number;
  missingCollectionThreshold: number;
  coldChillerActive: boolean;
  alertsEnabled: boolean;
  triggerAfterMinutes: number;
  repeatMinutes: number;
  quietStart: string | null;
  quietEnd: string | null;
  suppressWeekends: boolean;
  holidayDates: string[];
  dashboardVisible: boolean;
};

export type AlertEventSummary = {
  id: number;
  siteId: string;
  siteName: string | null;
  metricKey: MetricKey | "__data__" | "__cold_chiller__";
  eventType: "LOW" | "HIGH" | "NO_DATA" | "RECOVERY";
  severity: string;
  measuredValue: number | null;
  min: number | null;
  max: number | null;
  message: string;
  deliveryStatus: "PENDING" | "SENDING" | "SENT" | "PARTIAL" | "FAILED" | "SKIPPED" | "UNKNOWN";
  deliveryError: string | null;
  lastNotifiedAt: string | null;
  notificationCount: number;
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
  channel: "KAKAO_ALIMTALK";
  destinationMasked: string;
  destination: string;
  quietStart: string | null;
  quietEnd: string | null;
  enabled: boolean;
};

let refreshPromise: Promise<StoredSession> | null = null;

function isPublicAuthPath(path: string) {
  return path === "/auth/login" || path === "/auth/refresh" || path === "/auth/logout" ||
    path.startsWith("/auth/invitations/") || path.startsWith("/auth/password-resets/");
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function errorFrom(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  return new ApiError(body?.message ?? `API request failed (${response.status})`, response.status);
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
  const previousToken = readStoredSession()?.accessToken;
  refreshPromise = (async () => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) {
      const error = await errorFrom(response);
      if ((error.status === 401 || error.status === 403) &&
          readStoredSession()?.accessToken === previousToken) {
        clearStoredSession();
        window.dispatchEvent(new Event("auth:expired"));
      }
      throw error;
    }
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
  const feedback = mutationSuccessMessage(path, options, undefined);
  try {
    const result = await requestApi<T>(path, options);
    const message = mutationSuccessMessage(path, options, result);
    if (message) showToast(message);
    return result;
  } catch (error) {
    if (feedback && !(error instanceof Error && error.name === "AbortError")) {
      showToast(error instanceof Error ? error.message : "변경하지 못했습니다. 다시 시도해주세요.", "error");
    }
    throw error;
  }
}

async function requestApi<T>(path: string, options: RequestInit): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  let stored = readStoredSession();
  if (stored && !isPublicAuthPath(path) && accessTokenExpiresSoon(stored)) {
    stored = await refreshAccessToken();
  }
  const token = stored?.accessToken;
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
    } catch { /* The refresh request handles invalid sessions. */ }
  }

  if (!response.ok) throw await errorFrom(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiFetchBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  let stored = readStoredSession();
  if (stored && accessTokenExpiresSoon(stored)) stored = await refreshAccessToken();
  const token = stored?.accessToken;
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
    } catch { /* The refresh request handles invalid sessions. */ }
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
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("모든 기기에서 로그아웃하지 못했습니다. 다시 시도해주세요.");
}
