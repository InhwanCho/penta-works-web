// 로그인/권한 UI 스캐폴드.
//
// 주의: 실제 users 테이블은 아직 연결하지 않았습니다. 자격 증명 검증이 전부
// 클라이언트에서 일어나므로 보안 경계로 사용하면 안 됩니다.
// 실제 인증으로 교체할 때는 verifyCredentials 를 서버 API 호출로 바꾸고
// 세션 쿠키를 httpOnly 로 발급하면 나머지 UI는 그대로 동작합니다.

export type Role = "admin" | "user";

export type Session = {
  username: string;
  role: Role;
};

export const SESSION_COOKIE = "pw_session";

/** 쿠키 유지 기간 (초) — 12시간 */
const SESSION_MAX_AGE = 12 * 60 * 60;

export type MockUser = {
  username: string;
  password: string;
  role: Role;
  /** 로그인 화면 안내에 노출할 이름 */
  label: string;
};

/** 껍데기 단계에서 사용하는 임시 계정 목록 */
export const MOCK_USERS: readonly MockUser[] = [
  { username: "admin", password: "admin", role: "admin", label: "관리자" },
  { username: "user", password: "user", role: "user", label: "일반 사용자" },
] as const;

export function verifyCredentials(
  username: string,
  password: string,
): Session | null {
  const hit = MOCK_USERS.find(
    (u) => u.username === username.trim() && u.password === password,
  );
  return hit ? { username: hit.username, role: hit.role } : null;
}

export function isAdmin(session: Session | null): boolean {
  return session?.role === "admin";
}

function encodeSession(session: Session): string {
  return encodeURIComponent(JSON.stringify(session));
}

function decodeSession(raw: string | undefined): Session | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Session).username === "string" &&
      ((parsed as Session).role === "admin" ||
        (parsed as Session).role === "user")
    ) {
      return parsed as Session;
    }
    return null;
  } catch {
    return null;
  }
}

/** 클라이언트 전용 — document.cookie 에서 세션을 읽습니다. */
export function readSessionCookie(): Session | null {
  if (typeof document === "undefined") return null;

  const hit = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));

  return decodeSession(hit?.slice(SESSION_COOKIE.length + 1));
}

export function writeSessionCookie(session: Session): void {
  if (typeof document === "undefined") return;
  document.cookie = [
    `${SESSION_COOKIE}=${encodeSession(session)}`,
    "path=/",
    `max-age=${SESSION_MAX_AGE}`,
    "samesite=lax",
  ].join("; ");
}

export function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
