"use client";

import ThreeDotLoader from "@/components/icons/three-dot-loader";
import { useAuth } from "@/components/provider/auth-provider";
import type { Role, Session } from "@/lib/auth";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const REMEMBERED_EMAIL_KEY = "mreyes_remembered_email";

const CARD_CLASS =
  "rounded-3xl border border-slate-200/70 bg-white shadow-[0_20px_60px_rgba(22,58,82,0.12)] dark:border-white/8 dark:bg-background-dark-card";

const INPUT_CLASS = [
  "w-full rounded-xl border bg-slate-50/60 px-3.5 py-3",
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

function roleLabel(role: Role | null | undefined): string {
  if (role === "SUPER_ADMIN") return "최고관리자";
  if (role === "ADMIN") return "관리자";
  return "일반 사용자";
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, isLoading, isAdmin, login, logout } = useAuth();

  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const remembered = window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "";
    setRememberEmail(Boolean(remembered));
    if (!searchParams.get("email") && remembered) setEmail(remembered);
  }, [searchParams]);

  const nextPath = useMemo(
    () => safeNextPath(searchParams.get("next")),
    [searchParams],
  );

  const canSubmit = email.trim().length > 0 && password.length > 0;

  // 이동 버튼 문구는 실제 이동 경로와 어긋나지 않게 맞춥니다.
  const moveLabel = nextPath
    ? "요청한 페이지로 이동"
    : isAdmin
      ? "관리자 페이지로 이동"
      : "대시보드로 이동";

  const goAfterLogin = useCallback(
    () => {
      router.replace(nextPath ?? "/");
    },
    [nextPath, router],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSubmit) return;

      try {
        await login(email, password);
        if (rememberEmail) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim().toLowerCase());
        else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        setError(null);
        goAfterLogin();
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "로그인에 실패했습니다.",
        );
      }
    },
    [canSubmit, email, goAfterLogin, login, password, rememberEmail],
  );

  const handleLogout = useCallback(async () => {
    await logout();
    setEmail(window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "");
    setPassword("");
    setError(null);
  }, [logout]);

  return (
    <main className="mx-auto flex w-full max-w-7xl items-center justify-center px-3 py-6 sm:px-4 sm:py-8 lg:px-6 lg:py-12">
      <div className="w-full max-w-md">
        <div className={[CARD_CLASS, "overflow-hidden p-5 sm:p-7 lg:p-8"].join(" ")}>
          {/* 워드마크 */}
          <header className="flex flex-col items-center text-center">
            <Image
              src="/favicon/android-chrome-192x192.png"
              alt=""
              width={48}
              height={48}
              priority
              className="h-14 w-14 rounded-2xl shadow-[0_8px_20px_rgba(22,58,82,0.16)]"
            />
            <h1 className="text-text-major dark:text-text-dark-primary mt-4 text-2xl font-extrabold tracking-tight">
              MrEyes
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
                onMove={goAfterLogin}
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
                      htmlFor="login-email"
                      className="text-text-secondary dark:text-text-dark-primary/70 mb-1.5 block text-xs font-medium"
                    >
                      이메일
                    </label>
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
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

                  <label className="text-text-secondary dark:text-text-dark-primary/70 flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={(event) => {
                        setRememberEmail(event.target.checked);
                        if (!event.target.checked) window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
                      }}
                      className="h-4 w-4 cursor-pointer accent-sky-700"
                    />
                    아이디 저장
                  </label>
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
                  className="bg-button-primary hover:bg-button-primary-hover disabled:hover:bg-button-primary mt-6 inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  로그인
                </button>
              </form>
            )}
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
              {session.email}
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
    role === "SUPER_ADMIN" || role === "ADMIN"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300";

  const dotCls =
    role === "SUPER_ADMIN" || role === "ADMIN"
      ? "bg-emerald-500"
      : "bg-slate-400";

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
