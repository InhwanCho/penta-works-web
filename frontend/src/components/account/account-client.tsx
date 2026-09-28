"use client";

import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export default function AccountClient() {
  const { session, logout } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirm) return setMessage("새 비밀번호가 서로 다릅니다.");
    setSaving(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      await logout();
      router.replace("/login");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "비밀번호를 변경하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-6 sm:py-10">
      <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_14px_45px_rgba(22,58,82,0.09)] dark:border-white/8 dark:bg-background-dark-card">
        <header className="bg-[linear-gradient(120deg,#123b5d,#176083)] px-6 py-6 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-lg font-extrabold">{session?.name?.trim().charAt(0) || "나"}</span>
            <div><h1 className="text-xl font-bold">내 계정</h1><p className="mt-0.5 text-sm text-white/65">계정 정보와 보안 설정</p></div>
          </div>
        </header>
        <div className="p-6">
        <dl className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/4"><dt className="text-text-secondary text-xs">이름</dt><dd className="mt-1 truncate font-bold">{session?.name}</dd></div><div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/4"><dt className="text-text-secondary text-xs">이메일</dt><dd className="mt-1 truncate font-bold">{session?.email}</dd></div></dl>
        <form onSubmit={submit} className="mt-7 space-y-3 border-t border-slate-100 pt-5 dark:border-white/7">
          <div className="mb-4"><h2 className="font-bold">비밀번호 변경</h2><p className="text-text-secondary mt-1 text-xs">안전을 위해 12자 이상으로 설정해 주세요.</p></div>
          <input className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 transition focus:border-sky-400 focus:bg-white dark:border-white/10 dark:bg-white/5" type="password" required autoComplete="current-password" placeholder="현재 비밀번호" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          <input className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 transition focus:border-sky-400 focus:bg-white dark:border-white/10 dark:bg-white/5" type="password" required minLength={12} autoComplete="new-password" placeholder="새 비밀번호" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          <input className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 transition focus:border-sky-400 focus:bg-white dark:border-white/10 dark:bg-white/5" type="password" required minLength={12} autoComplete="new-password" placeholder="새 비밀번호 확인" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          {message && <p className="text-sm text-red-600">{message}</p>}
          <button disabled={saving} className="bg-button-primary hover:bg-button-primary-hover w-full rounded-xl py-3 font-bold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50">{saving ? "변경 중…" : "비밀번호 변경"}</button>
        </form>
        </div>
      </section>
    </main>
  );
}
