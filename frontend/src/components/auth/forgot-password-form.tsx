"use client";

import CircleLoader from "@/components/icons/circle-loader";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(null);
    try {
      await apiFetch("/auth/password-resets/request", {
        method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.");
    } finally { setSaving(false); }
  }

  return <main className="flex w-full items-center justify-center px-4 py-10 lg:min-h-[calc(100dvh-3.5rem)] lg:py-8">
    <section className="w-full max-w-md rounded-xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8 dark:border-white/8 dark:bg-background-dark-card">
      <h1 className="text-xl font-bold">비밀번호 찾기</h1>
      {sent ? <div role="status" className="mt-4 space-y-3 text-sm leading-6">
        <p>가입된 이메일이고 재설정이 가능한 계정이면 안내 메일이 발송됩니다.</p>
        <p className="text-text-secondary">링크는 1시간 동안 유효합니다. 메일이 도착하지 않으면 스팸함을 확인하고, 잠시 후 다시 시도하거나 회사 관리자에게 문의해주세요.</p>
        <button type="button" onClick={() => setSent(false)} className="cursor-pointer font-semibold text-sky-700 dark:text-sky-300">다른 이메일로 요청</button>
      </div> : <form onSubmit={submit} className="mt-4 space-y-4">
        <p className="text-text-secondary text-sm leading-6">가입한 이메일로 비밀번호 재설정 링크를 보내드립니다.</p>
        <label className="block text-sm font-semibold" htmlFor="reset-email">이메일</label>
        <input id="reset-email" type="email" required maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false}
          value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 dark:border-white/10 dark:bg-white/5" />
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <button disabled={saving} className="bg-button-primary flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 font-bold text-white disabled:cursor-wait disabled:opacity-60">
          {saving && <CircleLoader size="s" />}{saving ? "요청 중…" : "재설정 링크 받기"}
        </button>
      </form>}
      <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-sky-700 dark:text-sky-300">로그인으로 돌아가기</Link>
    </section>
  </main>;
}
