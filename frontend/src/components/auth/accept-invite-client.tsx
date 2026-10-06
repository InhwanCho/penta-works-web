"use client";

import { apiFetch, ApiError } from "@/lib/api";
import { loadPublicAuth } from "@/lib/public-auth-query";
import AuthPageLoading from "@/components/auth/auth-page-loading";
import CircleLoader from "@/components/icons/circle-loader";
import PasswordFields, { type PasswordValues } from "@/components/auth/password-fields";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type InvitationInfo = { email: string; name: string; role: string; expiresAt: string; companyName: string };

export default function AcceptInviteClient() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const invitation = useQuery({
    queryKey: ["invitation", token],
    queryFn: ({ signal }) => loadPublicAuth<InvitationInfo>(`/auth/invitations/${encodeURIComponent(token)}`, signal),
    enabled: Boolean(token), retry: false,
  });
  const form = useForm<PasswordValues>({ mode: "onChange", defaultValues: { password: "", confirm: "" } });
  const [error, setError] = useState<string | null>(null);
  const saving = form.formState.isSubmitting;

  async function submit({ password }: PasswordValues) {
    setError(null);
    try {
      await apiFetch(`/auth/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST", body: JSON.stringify({ password }),
      });
      router.replace(`/login?email=${encodeURIComponent(invitation.data?.email ?? "")}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "가입하지 못했습니다. 다시 시도해주세요.");
    }
  }

  if (!token || (invitation.error instanceof ApiError && [400, 403, 404, 410].includes(invitation.error.status))) return <Message title="사용할 수 없는 초대입니다." />;
  if (invitation.isError) return <main className="mx-auto max-w-md px-4 py-10"><div role="alert" className="rounded-2xl border bg-white p-6 dark:border-white/10 dark:bg-background-dark-card"><h1 className="font-bold">초대 정보를 불러오지 못했습니다</h1><p className="text-text-secondary mt-2 text-sm">{invitation.error.message || "네트워크 연결을 확인해주세요."}</p><button type="button" onClick={() => invitation.refetch()} className="mt-4 min-h-12 w-full rounded-xl bg-button-primary font-bold text-white">다시 시도</button></div></main>;
  if (!invitation.data) return <AuthPageLoading />;
  return (
    <main className="mx-auto flex w-full items-center justify-center px-4 py-8 lg:min-h-[calc(100dvh-3.5rem)]">
      <form noValidate onSubmit={form.handleSubmit(submit)} aria-busy={saving} className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-background-dark-card">
        <header className="bg-sky-50 px-6 py-5 dark:bg-sky-950/30">
          <p className="text-xs font-bold text-sky-700 dark:text-sky-300">회사 초대</p>
          <h1 className="mt-1 text-xl font-extrabold">MrEyes 가입 신청</h1>
          <p className="mt-3 break-words text-sm"><strong>{invitation.data.companyName}</strong>에서 초대했습니다.</p>
          <p className="text-text-secondary mt-1 text-xs leading-5">비밀번호를 설정하면 이 회사의 워크스페이스를 사용할 수 있습니다.</p>
        </header>
        <div className="space-y-5 p-6">
          <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-white/5"><p className="font-bold">{invitation.data.name}</p><p className="text-text-secondary mt-1 break-all text-sm">{invitation.data.email}</p></div>
          <fieldset disabled={saving} className="space-y-4"><PasswordFields form={form} /></fieldset>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving} className="bg-button-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white disabled:opacity-50">
            {saving && <CircleLoader className="[&>span]:h-4 [&>span]:w-4 [&>span]:border-white/40 [&>span]:border-t-white" />}{saving ? "가입 처리 중" : "가입하기"}
          </button>
        </div>
      </form>
    </main>
  );
}

function Message({ title }: { title: string }) {
  return <main className="mx-auto max-w-md p-10 text-center"><p>{title}</p><p className="text-text-secondary mt-3 text-sm">초대한 관리자에게 새 초대 링크를 요청해주세요.</p><Link href="/login" className="mt-4 inline-block underline">로그인으로 이동</Link></main>;
}
