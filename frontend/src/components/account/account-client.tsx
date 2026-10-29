"use client";

import CircleLoader from "@/components/icons/circle-loader";


import Link from "@/components/common/app-link";
import LogoutControls from "./logout-controls";
import PhoneInput from "@/components/forms/phone-input";
import { formatPhone, phoneDigits } from "@/lib/phone";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Profile = { name: string; email: string; phone: string | null };
const INPUT =
  "mt-1 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base dark:border-white/10 dark:bg-white/5";

export default function AccountClient() {
  const { session, logout } = useAuth();
  const router = useRouter();
  const client = useQueryClient();
  const profile = useQuery({
    queryKey: ["my-profile", session?.id],
    queryFn: () => apiFetch<Profile>("/auth/profile"),
    enabled: Boolean(session),
  });
  const [mode, setMode] = useState<"profile" | "password" | null>(null);
  const [draft, setDraft] = useState<Profile>({
    name: "",
    email: "",
    phone: null,
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (mode === "password" && newPassword !== confirm)
      return setMessage("새 비밀번호가 서로 다릅니다.");
    setSaving(true);
    try {
      if (mode === "profile") {
        const saved = await apiFetch<Profile>("/auth/profile", {
          method: "PATCH",
          body: JSON.stringify({ phone: phoneDigits(draft.phone) || null }),
        });
        client.setQueryData(["my-profile", session?.id], saved);
        await client.invalidateQueries({ queryKey: ["admin-users"] });
        setMode(null);
        setMessage("내 정보를 저장했습니다.");
      } else {
        await apiFetch("/auth/change-password", {
          method: "POST",
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        await logout();
        router.replace("/login");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-6 sm:py-10">
      <Link
        href="/settings"
        className="work-back mb-4 inline-flex min-h-11 items-center font-semibold text-sky-700 dark:text-sky-300"
      >
        ← 설정
      </Link>
      <section className="dark:bg-background-dark-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10">
        <header className="bg-[linear-gradient(120deg,#123b5d,#176083)] px-5 py-6 text-white">
          <h1 className="text-xl font-bold">내 계정</h1>
          <p className="mt-1 text-sm text-white/70">계정 정보와 보안 설정</p>
        </header>
        <div className="p-5 sm:p-6">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-text-secondary text-xs">이름</dt>
              <dd className="mt-1 font-bold break-words">
                {profile.data?.name ?? session?.name}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary text-xs">이메일 (아이디)</dt>
              <dd className="mt-1 font-bold break-all">
                {profile.data?.email ?? session?.email}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary text-xs">휴대폰번호</dt>
              <dd className="mt-1 font-bold">
                {formatPhone(profile.data?.phone) || "미등록"}
              </dd>
            </div>
          </dl>
          {profile.isError && (
            <p
              role="alert"
              className="mt-3 text-sm text-rose-600"
            >
              내 정보를 불러오지 못했습니다.{" "}
              <button
                type="button"
                onClick={() => profile.refetch()}
                className="underline"
              >
                다시 시도
              </button>
            </p>
          )}
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={saving || !profile.data}
              onClick={() => {
                setDraft(profile.data!);
                setMode("profile");
                setMessage(null);
              }}
              className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm font-bold dark:border-white/10"
            >
              내 정보 변경
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setMode("password");
                setMessage(null);
                setCurrentPassword("");
                setNewPassword("");
                setConfirm("");
              }}
              className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm font-bold dark:border-white/10"
            >
              비밀번호 변경
            </button>
          </div>
          {mode && (
            <form
              onSubmit={submit}
              className="mt-5 space-y-4 border-t border-slate-100 pt-5 dark:border-white/10"
            >
              <h2 className="font-bold">
                {mode === "profile" ? "내 정보 변경" : "비밀번호 변경"}
              </h2>
              {mode === "profile" ? (
                <>
                  <label className="block text-sm font-bold">
                    휴대폰번호
                    <PhoneInput
                      className={INPUT}
                      value={draft.phone}
                      onValueChange={(phone) =>
                        setDraft({ ...draft, phone: phone || null })
                      }
                      placeholder="010-3333-3333"
                    />
                  </label>
                  <p className="text-text-secondary text-xs">
                    대시보드에 표시하는 병원의 알림을 이 번호로 받습니다. 번호
                    변경은 모든 병원에 적용되며, 번호를 삭제하면 카카오톡·문자
                    알림을 받을 수 없습니다.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-text-secondary text-xs">
                    8자 이상으로 설정해 주세요. 문자 조합 제한은 없습니다. 변경
                    후 모든 기기에서 로그아웃됩니다.
                  </p>
                  <label className="block text-sm font-bold">
                    현재 비밀번호
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      className={INPUT}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-bold">
                    새 비밀번호
                    <input
                      type="password"
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      className={INPUT}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-bold">
                    새 비밀번호 확인
                    <input
                      type="password"
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      className={INPUT}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </label>
                </>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setMode(null);
                    setMessage(null);
                  }}
                  className="action-cancel min-h-12 rounded-xl border border-slate-200 font-bold dark:border-white/10"
                >
                  취소
                </button>
                <button
                  disabled={saving}
                  className="action-save bg-button-primary min-h-12 rounded-xl font-bold text-white disabled:opacity-50"
                >
                  {saving ? <CircleLoader size="xs" inline /> : "변경 저장"}
                </button>
              </div>
            </form>
          )}
          {message && (
            <p
              role="status"
              className="mt-4 text-sm"
            >
              {message}
            </p>
          )}
          <LogoutControls />
        </div>
      </section>
    </main>
  );
}
