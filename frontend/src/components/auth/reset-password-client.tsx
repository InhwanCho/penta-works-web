"use client";

import { apiFetch } from "@/lib/api";
import CircleLoader from "@/components/icons/circle-loader";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

type ResetInfo = { email: string; name: string };

export default function ResetPasswordClient() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const info = useQuery({ queryKey: ["password-reset", token], queryFn: () => apiFetch<ResetInfo>(`/auth/password-resets/${encodeURIComponent(token)}`), enabled: Boolean(token), retry: false });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) return setError("비밀번호가 서로 다릅니다.");
    setSaving(true);
    try {
      await apiFetch(`/auth/password-resets/${encodeURIComponent(token)}`, { method: "POST", body: JSON.stringify({ password }) });
      router.replace(`/login?email=${encodeURIComponent(info.data?.email ?? "")}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "비밀번호를 재설정하지 못했습니다.");
    } finally { setSaving(false); }
  }

  if (!token || info.isError) return <Message text="사용할 수 없는 재설정 링크입니다." />;
  if (info.isLoading) return <main className="flex min-h-[60vh] items-center justify-center lg:min-h-[calc(100dvh-3.5rem)]"><CircleLoader size="xl" /></main>;
  return (
    <main className="mx-auto flex w-full items-center justify-center px-4 py-10 lg:min-h-[calc(100dvh-3.5rem)] lg:py-8"><form onSubmit={submit} className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm dark:border-background-dark-secondary dark:bg-background-dark-card">
      <h1 className="text-xl font-bold">비밀번호 재설정</h1><p className="text-text-secondary mt-2 text-sm">{info.data?.name} · {info.data?.email}</p>
      <p className="text-text-secondary mt-1 text-xs">12자 이상이며 영문, 숫자, 특수문자를 포함하세요.</p>
      <input className="mt-5 w-full rounded-md border px-3 py-2.5 dark:border-background-dark-secondary dark:bg-background-dark-primary" type="password" required minLength={12} autoComplete="new-password" placeholder="새 비밀번호" value={password} onChange={(event) => setPassword(event.target.value)} />
      <input className="mt-3 w-full rounded-md border px-3 py-2.5 dark:border-background-dark-secondary dark:bg-background-dark-primary" type="password" required minLength={12} autoComplete="new-password" placeholder="비밀번호 확인" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button disabled={saving} className="bg-button-primary mt-5 w-full rounded-md py-2.5 font-semibold text-white disabled:opacity-50">{saving ? "처리 중…" : "비밀번호 재설정"}</button>
    </form></main>
  );
}

function Message({ text }: { text: string }) { return <main className="mx-auto max-w-md p-10 text-center"><p>{text}</p><Link href="/login" className="mt-4 inline-block underline">로그인으로 이동</Link></main>; }
