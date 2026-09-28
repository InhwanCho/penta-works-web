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
    <main className="mx-auto max-w-lg px-4 py-8">
      <section className="rounded-xl border bg-white p-6 shadow-sm dark:border-background-dark-secondary dark:bg-background-dark-card">
        <h1 className="text-xl font-bold">내 계정</h1>
        <dl className="mt-4 space-y-2 text-sm"><div><dt className="text-text-secondary">이름</dt><dd className="font-semibold">{session?.name}</dd></div><div><dt className="text-text-secondary">이메일</dt><dd className="font-semibold">{session?.email}</dd></div></dl>
        <form onSubmit={submit} className="mt-7 space-y-3 border-t pt-5 dark:border-background-dark-secondary">
          <h2 className="font-semibold">비밀번호 변경</h2>
          <input className="w-full rounded-md border px-3 py-2.5 dark:border-background-dark-secondary dark:bg-background-dark-primary" type="password" required autoComplete="current-password" placeholder="현재 비밀번호" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          <input className="w-full rounded-md border px-3 py-2.5 dark:border-background-dark-secondary dark:bg-background-dark-primary" type="password" required minLength={12} autoComplete="new-password" placeholder="새 비밀번호" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          <input className="w-full rounded-md border px-3 py-2.5 dark:border-background-dark-secondary dark:bg-background-dark-primary" type="password" required minLength={12} autoComplete="new-password" placeholder="새 비밀번호 확인" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          {message && <p className="text-sm text-red-600">{message}</p>}
          <button disabled={saving} className="bg-button-primary w-full rounded-md py-2.5 font-semibold text-white disabled:opacity-50">{saving ? "변경 중…" : "비밀번호 변경"}</button>
        </form>
      </section>
    </main>
  );
}
