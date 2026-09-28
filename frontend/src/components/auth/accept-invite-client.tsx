"use client";

import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

type InvitationInfo = { email: string; name: string; role: string; expiresAt: string };

export default function AcceptInviteClient() {
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get("token") ?? "";
  const invitation = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => apiFetch<InvitationInfo>(`/auth/invitations/${encodeURIComponent(token)}`),
    enabled: Boolean(token),
    retry: false,
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) return setError("비밀번호가 서로 다릅니다.");
    setSaving(true);
    try {
      await apiFetch(`/auth/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      router.replace(`/login?email=${encodeURIComponent(invitation.data?.email ?? "")}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "가입을 완료하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (!token || invitation.isError) return <Message title="사용할 수 없는 초대입니다." />;
  if (invitation.isLoading) return <Message title="초대를 확인하고 있습니다…" />;
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <form onSubmit={submit} className="rounded-xl border bg-white p-6 shadow-sm dark:border-background-dark-secondary dark:bg-background-dark-card">
        <h1 className="text-xl font-bold">MrEyes 가입 완료</h1>
        <p className="text-text-secondary mt-2 text-sm">{invitation.data?.name} · {invitation.data?.email}</p>
        <p className="text-text-secondary mt-1 text-xs">비밀번호는 12자 이상이며 영문, 숫자, 특수문자를 포함해야 합니다.</p>
        <input className="mt-5 w-full rounded-md border px-3 py-2.5 dark:border-background-dark-secondary dark:bg-background-dark-primary"
          type="password" autoComplete="new-password" minLength={12} required placeholder="새 비밀번호"
          value={password} onChange={(event) => setPassword(event.target.value)} />
        <input className="mt-3 w-full rounded-md border px-3 py-2.5 dark:border-background-dark-secondary dark:bg-background-dark-primary"
          type="password" autoComplete="new-password" minLength={12} required placeholder="비밀번호 확인"
          value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button disabled={saving} className="bg-button-primary mt-5 w-full rounded-md py-2.5 font-semibold text-white disabled:opacity-50">
          {saving ? "처리 중…" : "가입 완료"}
        </button>
      </form>
    </main>
  );
}

function Message({ title }: { title: string }) {
  return <main className="mx-auto max-w-md p-10 text-center"><p>{title}</p><Link href="/login" className="mt-4 inline-block underline">로그인으로 이동</Link></main>;
}
