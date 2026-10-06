"use client";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/provider/auth-provider";
import CircleLoader from "@/components/icons/circle-loader";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import PasswordFields, { type PasswordValues } from "@/components/auth/password-fields";

type ResetInfo = { email: string; name: string };

export default function ResetPasswordClient() {
  const { isLoading: authLoading } = useAuth();
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const info = useQuery({ queryKey: ["password-reset", token], queryFn: () => apiFetch<ResetInfo>(`/auth/password-resets/${encodeURIComponent(token)}`), enabled: Boolean(token) && !authLoading, retry: false });
  const form = useForm<PasswordValues>({ mode: "onChange", defaultValues: { password: "", confirm: "" } });
  const [error, setError] = useState<string | null>(null);
  const saving = form.formState.isSubmitting;

  async function submit({ password }: PasswordValues) {
    setError(null);
    try {
      await apiFetch(`/auth/password-resets/${encodeURIComponent(token)}`, { method: "POST", body: JSON.stringify({ password }) });
      router.replace(`/login?email=${encodeURIComponent(info.data?.email ?? "")}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "비밀번호를 재설정하지 못했습니다.");
    }
  }

  if (!token || info.isError) return <Message text="사용할 수 없는 재설정 링크입니다." />;
  if (!info.data) return <main className="flex min-h-[60vh] items-center justify-center lg:min-h-[calc(100dvh-3.5rem)]"><CircleLoader size="xl" /></main>;
  return (
    <main className="mx-auto flex w-full items-center justify-center px-4 py-10 lg:min-h-[calc(100dvh-3.5rem)] lg:py-8"><form noValidate onSubmit={form.handleSubmit(submit)} aria-busy={saving} className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm dark:border-background-dark-secondary dark:bg-background-dark-card">
      <h1 className="text-xl font-bold">비밀번호 재설정</h1><p className="text-text-secondary mt-2 text-sm">{info.data?.name} · {info.data?.email}</p>
      <fieldset disabled={saving} className="mt-5 space-y-4"><PasswordFields form={form} /></fieldset>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button disabled={saving} className="bg-button-primary mt-5 w-full rounded-md py-2.5 font-semibold text-white disabled:opacity-50">{saving && <CircleLoader className="mr-2 align-middle [&>span]:h-4 [&>span]:w-4 [&>span]:border-white/40 [&>span]:border-t-white" />}{saving ? "처리 중" : "비밀번호 재설정"}</button>
    </form></main>
  );
}

function Message({ text }: { text: string }) { return <main className="mx-auto max-w-md p-10 text-center"><p>{text}</p><Link href="/login" className="mt-4 inline-block underline">로그인으로 이동</Link></main>; }
