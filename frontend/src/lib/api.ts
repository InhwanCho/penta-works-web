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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? `API request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function login(username: string, password: string) {
  return apiFetch<{ accessToken: string; user: Session }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}
