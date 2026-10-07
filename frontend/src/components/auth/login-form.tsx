"use client";

import CircleLoader from "@/components/icons/circle-loader";
import { useAuth } from "@/components/provider/auth-provider";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const REMEMBERED_EMAIL_KEY = "mreyes_remembered_email";

const CARD_CLASS =
  "rounded-2xl border border-slate-200/70 bg-white shadow-[0_12px_36px_rgba(22,58,82,0.085)] dark:border-white/8 dark:bg-background-dark-card";

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
  if (raw === "/login" || raw.startsWith("/login?")) return null;
  return raw;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, isLoading, login } = useAuth();
  // Invitation signup must require credentials even when this browser has another session.
  const reauthenticate = searchParams.get("reauthenticate") === "1";

  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const remembered = window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "";
    setRememberEmail(Boolean(remembered));
    if (!searchParams.get("email") && remembered) setEmail(remembered);
  }, [searchParams]);

  const nextPath = useMemo(
    () => safeNextPath(searchParams.get("next")),
    [searchParams],
  );

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  const goAfterLogin = useCallback(
    () => {
      router.replace(nextPath ?? "/");
    },
    [nextPath, router],
  );

  useEffect(() => {
    if (!isLoading && session && !reauthenticate) goAfterLogin();
  }, [goAfterLogin, isLoading, session, reauthenticate]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
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
      } finally { setSubmitting(false); }
    },
    [canSubmit, email, login, password, rememberEmail, goAfterLogin],
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl items-center justify-center px-3 py-6 sm:px-4 sm:py-8 lg:min-h-[calc(100dvh-3.5rem)] lg:px-6 lg:py-8">
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
              className="h-14 w-14 rounded-xl shadow-[0_5px_14px_rgba(22,58,82,0.12)]"
            />
            <h1 className="text-text-major dark:text-text-dark-primary mt-4 text-2xl font-extrabold tracking-tight">
              MrEyes
            </h1>
            <p className="text-text-secondary dark:text-text-dark-primary/60 mt-1 text-sm">
              {reauthenticate ? "가입한 계정으로 로그인하세요." : "계속하려면 로그인하세요."}
            </p>
          </header>

          <div className="mt-6">
            {isLoading || (session && !reauthenticate) ? (
              <div className="flex min-h-[220px] items-center justify-center">
                <CircleLoader size="xl" />
              </div>
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
                  {submitting ? <><CircleLoader size="s" className="mr-2" />로그인 중…</> : "로그인"}
                </button>
                <Link href="/forgot-password" className="mt-4 block text-center text-sm font-semibold text-sky-700 dark:text-sky-300">비밀번호를 잊으셨나요?</Link>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
