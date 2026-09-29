"use client";

import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

type AccountSession = {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  lastUsedAt: string;
  expiresAt: string;
  createdAt: string;
  current: boolean;
};

export default function AccountClient() {
  const { session, logout } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AccountSession[]>("/auth/sessions")
      .then(setSessions)
      .catch((error) => setSessionMessage(error instanceof Error ? error.message : "로그인 기기를 불러오지 못했습니다."))
      .finally(() => setSessionsLoading(false));
  }, []);

  async function revokeSession(id: string) {
    setSessionMessage(null);
    try {
      await apiFetch(`/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
      setSessions((current) => current.filter((item) => item.id !== id));
      setSessionMessage("선택한 기기에서 로그아웃했습니다.");
    } catch (error) { setSessionMessage(error instanceof Error ? error.message : "기기 로그아웃에 실패했습니다."); }
  }

  async function revokeOthers() {
    setSessionMessage(null);
    try {
      await apiFetch("/auth/sessions/revoke-others", { method: "POST" });
      setSessions((current) => current.filter((item) => item.current));
      setSessionMessage("현재 기기를 제외한 모든 기기에서 로그아웃했습니다.");
    } catch (error) { setSessionMessage(error instanceof Error ? error.message : "다른 기기 로그아웃에 실패했습니다."); }
  }

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
        <section className="mt-7 border-t border-slate-100 pt-5 dark:border-white/7">
          <div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="font-bold">로그인 기기</h2><p className="text-text-secondary mt-1 text-xs">사용 중인 세션을 확인하고 다른 기기의 로그인을 종료할 수 있습니다.</p></div>{sessions.filter((item) => !item.current).length > 0 && <button type="button" onClick={revokeOthers} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30">다른 기기 모두 로그아웃</button>}</div>
          {sessionsLoading ? <p className="text-text-secondary py-4 text-center text-sm">불러오는 중…</p> : <div className="space-y-2">{sessions.map((item) => <article key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-white/8 dark:bg-white/3"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold">{deviceLabel(item.deviceName)}</p>{item.current && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">현재 기기</span>}</div><p className="text-text-secondary mt-1 text-[11px]">{item.ipAddress ?? "IP 정보 없음"} · 최근 사용 {new Date(item.lastUsedAt).toLocaleString("ko-KR")}</p></div>{!item.current && <button type="button" onClick={() => revokeSession(item.id)} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30">로그아웃</button>}</article>)}{sessions.length === 0 && <p className="text-text-secondary py-4 text-center text-sm">활성 세션이 없습니다.</p>}</div>}
          {sessionMessage && <p className="text-text-secondary mt-2 text-xs">{sessionMessage}</p>}
        </section>
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

function deviceLabel(value: string | null) {
  if (!value) return "알 수 없는 기기";
  const os = value.includes("iPhone") ? "iPhone" : value.includes("Android") ? "Android" : value.includes("Macintosh") ? "Mac" : value.includes("Windows") ? "Windows" : "기기";
  const browser = value.includes("Edg/") ? "Edge" : value.includes("Chrome/") ? "Chrome" : value.includes("Safari/") ? "Safari" : "브라우저";
  return `${os} · ${browser}`;
}
