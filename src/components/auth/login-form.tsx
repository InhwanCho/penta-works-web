"use client";

import ThreeDotLoader from "@/components/icons/three-dot-loader";
import { useAuth } from "@/components/provider/auth-provider";
import {
  MOCK_USERS,
  type MockUser,
  type Role,
  type Session,
  verifyCredentials,
} from "@/lib/auth";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useMemo, useState } from "react";

const CARD_CLASS =
  "dark:border-background-dark-secondary dark:bg-background-dark-card rounded-lg border bg-white shadow-[0_1px_2px_0_rgb(0_0_0_/_0.03)]";

const INPUT_CLASS = [
  "w-full rounded-md border bg-white px-3 py-2.5",
  "text-text-major placeholder:text-text-secondary/45",
  "dark:border-background-dark-secondary dark:bg-background-dark-primary/50",
  "dark:text-text-dark-primary dark:placeholder:text-text-dark-primary/30",
  "transition-colors",
].join(" ");

/**
 * 오픈 리다이렉트 방지 — 같은 출처의 절대 경로만 허용합니다.
 * ("//evil.com" 같은 프로토콜 상대 경로는 차단)
 */
function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

/** 권한별 기본 진입 경로 */
function homePathFor(role: Role | null | undefined): string {
  return role === "admin" ? "/admin" : "/";
}

function roleLabel(role: Role | null | undefined): string {
  return role === "admin" ? "관리자" : "일반 사용자";
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, isLoading, isAdmin, login, logout } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(
    () => safeNextPath(searchParams.get("next")),
    [searchParams],
  );

  const canSubmit = username.trim().length > 0 && password.length > 0;

  // 이동 버튼 문구는 실제 이동 경로와 어긋나지 않게 맞춥니다.
  const moveLabel = nextPath
    ? "요청한 페이지로 이동"
    : isAdmin
      ? "관리자 페이지로 이동"
      : "대시보드로 이동";

  const goAfterLogin = useCallback(
    (target: Session | null) => {
      router.replace(nextPath ?? homePathFor(target?.role));
    },
    [nextPath, router],
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSubmit) return;

      const message = login(username, password);
      if (message) {
        setError(message);
        return;
      }

      setError(null);
      // login() 은 성공 여부만 돌려주므로, 이동 경로 판정을 위해 권한을 다시 조회합니다.
      goAfterLogin(verifyCredentials(username, password));
    },
    [canSubmit, goAfterLogin, login, password, username],
  );

  const handleFill = useCallback((user: MockUser) => {
    setUsername(user.username);
    setPassword(user.password);
    setError(null);
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    setUsername("");
    setPassword("");
    setError(null);
  }, [logout]);

  return (
    <main className="mx-auto flex w-full max-w-6xl items-center justify-center px-4 py-10 lg:px-8 lg:py-16">
      <div className="w-full max-w-md">
        <div className={[CARD_CLASS, "p-6 lg:p-8"].join(" ")}>
          {/* 워드마크 */}
          <header className="flex flex-col items-center text-center">
            <Image
              src="/favicon/android-chrome-192x192.png"
              alt=""
              width={48}
              height={48}
              priority
              className="h-12 w-12 rounded-lg"
            />
            <h1 className="text-text-major dark:text-text-dark-primary mt-3 text-xl font-semibold tracking-tight lg:text-2xl">
              PENTA WORKS
            </h1>
            <p className="text-text-secondary dark:text-text-dark-primary/60 mt-1 text-sm">
              계속하려면 로그인하세요.
            </p>
          </header>

          <div className="mt-6">
            {isLoading ? (
              <div className="flex min-h-[220px] items-center justify-center">
                <ThreeDotLoader size="xl" />
              </div>
            ) : session ? (
              <SignedInPanel
                session={session}
                moveLabel={moveLabel}
                onMove={() => goAfterLogin(session)}
                onLogout={handleLogout}
              />
            ) : (
              <form
                onSubmit={handleSubmit}
                noValidate
              >
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="login-username"
                      className="text-text-secondary dark:text-text-dark-primary/70 mb-1.5 block text-xs font-medium"
                    >
                      아이디
                    </label>
                    <input
                      id="login-username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="아이디를 입력하세요"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (error) setError(null);
                      }}
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="text-text-secondary dark:text-text-dark-primary/70 mb-1.5 block text-xs font-medium"
                    >
                      비밀번호
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="비밀번호를 입력하세요"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError(null);
                        }}
                        className={[INPUT_CLASS, "pr-16"].join(" ")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-pressed={showPassword}
                        aria-controls="login-password"
                        aria-label={
                          showPassword ? "비밀번호 숨김" : "비밀번호 표시"
                        }
                        className="text-text-secondary hover:text-text-major dark:text-text-dark-primary/60 dark:hover:text-text-dark-primary absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-md px-2 py-1 text-xs font-medium transition-colors"
                      >
                        {showPassword ? "숨김" : "표시"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 에러 영역 */}
                <div
                  role="alert"
                  aria-live="assertive"
                >
                  {error ? (
                    <p className="mt-4 rounded-md border border-red-200 bg-red-50/60 px-3 py-2.5 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                      {error}
                    </p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="bg-button-primary hover:bg-button-primary-hover disabled:hover:bg-button-primary mt-6 inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-md text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                >
                  로그인
                </button>
              </form>
            )}
          </div>

          {/* 임시 계정 안내 */}
          <div className="dark:border-background-dark-secondary mt-6 border-t pt-5">
            <MockAccountsNotice onFill={session ? undefined : handleFill} />
          </div>
        </div>
      </div>
    </main>
  );
}

/* ---- 이하 UI 컴포넌트 ---- */

function SignedInPanel({
  session,
  moveLabel,
  onMove,
  onLogout,
}: {
  session: Session;
  moveLabel: string;
  onMove: () => void;
  onLogout: () => void;
}) {
  return (
    <div>
      <div className="dark:border-background-dark-secondary dark:bg-background-dark-secondary/30 bg-background-primary/60 rounded-md border p-4">
        <p className="text-text-major dark:text-text-dark-primary text-sm font-semibold">
          이미 로그인되어 있습니다.
        </p>

        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-text-secondary dark:text-text-dark-primary/60 text-xs font-medium">
              계정
            </dt>
            <dd className="text-text-major dark:text-text-dark-primary truncate font-medium">
              {session.username}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-text-secondary dark:text-text-dark-primary/60 text-xs font-medium">
              권한
            </dt>
            <dd>
              <RoleBadge role={session.role} />
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={onMove}
          className="bg-button-primary hover:bg-button-primary-hover inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-md text-sm font-semibold text-white transition-colors"
        >
          {moveLabel}
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="text-text-secondary hover:bg-background-tertiary hover:text-text-major dark:border-background-dark-secondary dark:text-text-dark-primary/70 dark:hover:bg-background-dark-secondary dark:hover:text-text-dark-primary inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-md border bg-white text-sm font-medium transition-colors dark:bg-transparent"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const cls =
    role === "admin"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300";

  const dotCls = role === "admin" ? "bg-emerald-500" : "bg-slate-400";

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        cls,
      ].join(" ")}
    >
      <span className={["h-1.5 w-1.5 rounded-full", dotCls].join(" ")} />
      {roleLabel(role)}
    </span>
  );
}

function MockAccountsNotice({
  onFill,
}: {
  /** 없으면 채우기 버튼을 숨깁니다. */
  onFill?: (user: MockUser) => void;
}) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/40 dark:bg-amber-950/25">
      <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">
        임시 계정 안내
      </p>
      <p className="mt-1 text-xs leading-relaxed text-amber-700/90 dark:text-amber-300/70">
        실제 users 테이블 미연결 상태의 임시 계정입니다. 아래 계정으로만
        로그인할 수 있습니다.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="text-amber-700/70 dark:text-amber-300/60">
            <tr>
              <th
                scope="col"
                className="py-1.5 pr-3 font-semibold tracking-wide whitespace-nowrap uppercase"
              >
                아이디
              </th>
              <th
                scope="col"
                className="py-1.5 pr-3 font-semibold tracking-wide whitespace-nowrap uppercase"
              >
                비밀번호
              </th>
              <th
                scope="col"
                className="py-1.5 pr-3 font-semibold tracking-wide whitespace-nowrap uppercase"
              >
                구분
              </th>
              {onFill ? (
                <th
                  scope="col"
                  className="py-1.5"
                >
                  <span className="sr-only">입력란 채우기</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="text-amber-900 dark:text-amber-200">
            {MOCK_USERS.map((user) => (
              <tr
                key={user.username}
                className="border-t border-amber-200/70 dark:border-amber-900/30"
              >
                <td className="py-1.5 pr-3 font-medium whitespace-nowrap">
                  {user.username}
                </td>
                <td className="py-1.5 pr-3 font-medium whitespace-nowrap">
                  {user.password}
                </td>
                <td className="py-1.5 pr-3 whitespace-nowrap">{user.label}</td>
                {onFill ? (
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onFill(user)}
                      aria-label={`${user.username} 계정으로 입력란 채우기`}
                      className="cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30"
                    >
                      채우기
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
