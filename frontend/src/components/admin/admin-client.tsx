"use client";

import ThreeDotLoader from "@/components/icons/three-dot-loader";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch, type Role } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";

type UserRow = {
  id: number;
  email: string;
  name: string;
  role: Role;
  status: "ACTIVE" | "SUSPENDED";
  lastLoginAt: string | null;
  createdAt: string;
  siteIds: string[];
};
type SiteOption = { id: string; name: string | null };
type Invitation = {
  id: string;
  email: string;
  name: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
  siteIds: string[];
};
type InvitationCreated = {
  id: string;
  token: string;
  email: string;
  expiresAt: string;
};
type AuditRow = {
  id: number;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
};
type PasswordResetCreated = { token: string; email: string; expiresAt: string };

const CARD =
  "rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(22,58,82,0.06)] dark:border-white/8 dark:bg-background-dark-card";
const INPUT =
  "w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm transition hover:border-slate-300 focus:border-sky-400 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20";

export default function AdminClient() {
  const { session, isLoading } = useAuth();
  const [tab, setTab] = useState<"users" | "invitations" | "audit">("users");
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch<UserRow[]>("/admin/accounts/users"),
    enabled: Boolean(session && session.role !== "USER"),
  });
  const sites = useQuery({
    queryKey: ["admin-sites"],
    queryFn: () => apiFetch<SiteOption[]>("/admin/accounts/sites"),
    enabled: Boolean(session && session.role !== "USER"),
    staleTime: 5 * 60_000,
  });
  const invitations = useQuery({
    queryKey: ["admin-invitations"],
    queryFn: () => apiFetch<Invitation[]>("/admin/accounts/invitations"),
    enabled: Boolean(session && session.role !== "USER"),
  });
  const audits = useQuery({
    queryKey: ["admin-audits"],
    queryFn: () => apiFetch<AuditRow[]>("/admin/accounts/audit-logs"),
    enabled: tab === "audit" && Boolean(session && session.role !== "USER"),
  });

  if (isLoading) return <Loading />;
  if (!session || session.role === "USER") return <AccessDenied />;

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-4 sm:py-7 lg:px-6">
      <header className="relative mb-6 overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#123b5d,#176083)] px-5 py-6 text-white shadow-[0_16px_45px_rgba(17,65,94,0.18)] sm:px-7 sm:py-7">
        <div className="absolute -top-16 -right-12 h-48 w-48 rounded-full bg-white/8 blur-sm" />
        <div className="absolute -right-4 -bottom-20 h-40 w-40 rounded-full bg-sky-300/10" />
        <div className="relative">
          <p className="mb-1 text-xs font-bold tracking-[0.16em] text-sky-200 uppercase">Workspace</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">사용자와 권한</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
            팀을 초대하고 각 사용자가 볼 수 있는 사업장을 간편하게 관리하세요.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <SummaryChip value={users.data?.length ?? 0} label="전체 사용자" />
            <SummaryChip value={(users.data ?? []).filter((user) => user.status === "ACTIVE").length} label="활성 계정" />
            <SummaryChip value={invitations.data?.length ?? 0} label="대기 중 초대" />
          </div>
        </div>
      </header>

      <div className="mb-5 inline-flex rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm dark:border-white/8 dark:bg-background-dark-card">
        <Tab active={tab === "users"} onClick={() => setTab("users")}>사용자</Tab>
        <Tab active={tab === "invitations"} onClick={() => setTab("invitations")}>초대</Tab>
        <Tab active={tab === "audit"} onClick={() => setTab("audit")}>감사 로그</Tab>
      </div>

      {tab === "users" && (
        <UserSection
          users={users.data ?? []}
          sites={sites.data ?? []}
          loading={users.isLoading || sites.isLoading}
          canManageAdmins={session.role === "SUPER_ADMIN"}
        />
      )}
      {tab === "invitations" && (
        <InvitationSection
          invitations={invitations.data ?? []}
          sites={sites.data ?? []}
          canInviteAdmins={session.role === "SUPER_ADMIN"}
        />
      )}
      {tab === "audit" && <AuditSection rows={audits.data ?? []} loading={audits.isLoading} />}
    </main>
  );
}

function UserSection({ users, sites, loading, canManageAdmins }: {
  users: UserRow[];
  sites: SiteOption[];
  loading: boolean;
  canManageAdmins: boolean;
}) {
  if (loading) return <Loading />;
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      {users.map((user) => (
        <UserEditor key={user.id} user={user} sites={sites} canManageAdmins={canManageAdmins} />
      ))}
      {users.length === 0 && <Empty>등록된 사용자가 없습니다.</Empty>}
    </section>
  );
}

function UserEditor({ user, sites, canManageAdmins }: {
  user: UserRow;
  sites: SiteOption[];
  canManageAdmins: boolean;
}) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<Role>(user.role);
  const [status, setStatus] = useState(user.status);
  const [siteIds, setSiteIds] = useState(user.siteIds);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const immutable = user.role === "SUPER_ADMIN" || (user.role === "ADMIN" && !canManageAdmins);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch(`/admin/accounts/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role, status, siteIds }),
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-audits"] });
      setMessage("저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function createPasswordReset() {
    setSaving(true);
    setMessage(null);
    try {
      const result = await apiFetch<PasswordResetCreated>(`/admin/accounts/users/${user.id}/password-reset`, { method: "POST" });
      setResetLink(`${window.location.origin}/reset-password?token=${encodeURIComponent(result.token)}`);
      await queryClient.invalidateQueries({ queryKey: ["admin-audits"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "재설정 링크를 만들지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`${CARD} group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(22,58,82,0.1)]`}>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 opacity-0 transition group-hover:opacity-100" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-50 text-base font-extrabold text-sky-700 dark:from-sky-950 dark:to-cyan-950 dark:text-sky-200">
            {user.name.trim().charAt(0) || user.email.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><p className="truncate font-bold">{user.name}</p><StatusPill status={user.status} /></div>
          <p className="text-text-secondary truncate text-sm">{user.email}</p>
          <p className="text-text-secondary mt-1 text-xs">
            최근 로그인 {formatDate(user.lastLoginAt)} · 가입 {formatDate(user.createdAt)}
          </p>
          </div>
        </div>
        <div className="flex min-w-[13rem] flex-1 gap-2 sm:max-w-sm">
          <select className={INPUT} value={role} disabled={immutable}
            onChange={(event) => setRole(event.target.value as Role)}>
            {user.role === "SUPER_ADMIN" && <option value="SUPER_ADMIN">최고관리자</option>}
            {(canManageAdmins || user.role === "ADMIN") && <option value="ADMIN">관리자</option>}
            <option value="USER">일반 사용자</option>
          </select>
          <select className={INPUT} value={status} disabled={immutable}
            onChange={(event) => setStatus(event.target.value as "ACTIVE" | "SUSPENDED")}>
            <option value="ACTIVE">활성</option>
            <option value="SUSPENDED">정지</option>
          </select>
        </div>
      </div>
      {role === "USER" && !immutable && (
        <SiteChecks sites={sites} selected={siteIds} onChange={setSiteIds} />
      )}
      {!immutable && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-white/7">
          {message && <span className="text-text-secondary text-xs">{message}</span>}
          <button type="button" disabled={saving} onClick={createPasswordReset}
            className="cursor-pointer rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-text-dark-primary/75 dark:hover:bg-white/5">
            비밀번호 초기화 링크
          </button>
          <button type="button" disabled={saving} onClick={save}
            className="bg-button-primary hover:bg-button-primary-hover cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50">
            {saving ? "저장 중…" : "변경 저장"}
          </button>
        </div>
      )}
      {resetLink && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="mb-2 text-xs font-semibold">1시간 동안 유효한 비밀번호 재설정 링크</p>
          <textarea className={`${INPUT} min-h-20`} readOnly value={resetLink} />
          <button type="button" className="mt-2 text-sm font-semibold underline" onClick={() => navigator.clipboard.writeText(resetLink)}>링크 복사</button>
        </div>
      )}
    </article>
  );
}

function InvitationSection({ invitations, sites, canInviteAdmins }: {
  invitations: Invitation[];
  sites: SiteOption[];
  canInviteAdmins: boolean;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER">("USER");
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const result = await apiFetch<InvitationCreated>("/admin/accounts/invitations", {
        method: "POST",
        body: JSON.stringify({ email, name, role, siteIds }),
      });
      setLink(`${window.location.origin}/accept-invite?token=${encodeURIComponent(result.token)}`);
      setEmail("");
      setName("");
      setSiteIds([]);
      await queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-audits"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "초대하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function revoke(id: string) {
    await apiFetch(`/admin/accounts/invitations/${id}`, { method: "DELETE" });
    await queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
      <form onSubmit={submit} className={`${CARD} space-y-4 p-5 sm:p-6`}>
        <div><h2 className="text-lg font-bold">새 사용자 초대</h2><p className="text-text-secondary mt-1 text-sm">초대받은 사용자가 직접 비밀번호를 설정합니다.</p></div>
        <input className={INPUT} type="email" required placeholder="이메일" value={email}
          onChange={(event) => setEmail(event.target.value)} />
        <input className={INPUT} required placeholder="이름" value={name}
          onChange={(event) => setName(event.target.value)} />
        <select className={INPUT} value={role}
          onChange={(event) => setRole(event.target.value as "ADMIN" | "USER")}>
          <option value="USER">일반 사용자</option>
          {canInviteAdmins && <option value="ADMIN">관리자</option>}
        </select>
        {role === "USER" && <SiteChecks sites={sites} selected={siteIds} onChange={setSiteIds} />}
        {message && <p className="text-sm text-red-600">{message}</p>}
        <button type="submit" disabled={saving}
          className="bg-button-primary hover:bg-button-primary-hover w-full cursor-pointer rounded-xl px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50">
          {saving ? "생성 중…" : "7일 초대 링크 생성"}
        </button>
        {link && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <p className="mb-2 font-semibold">초대 링크가 생성되었습니다.</p>
            <textarea className={`${INPUT} min-h-20`} readOnly value={link} />
            <button type="button" className="mt-2 text-sm font-semibold underline"
              onClick={() => navigator.clipboard.writeText(link)}>링크 복사</button>
          </div>
        )}
      </form>
      <section className={`${CARD} p-5 sm:p-6`}>
        <div className="mb-4"><h2 className="text-lg font-bold">대기 중인 초대</h2><p className="text-text-secondary mt-1 text-sm">아직 가입을 완료하지 않은 사용자입니다.</p></div>
        <div className="space-y-2">
          {invitations.map((invitation) => (
            <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/3 dark:hover:bg-white/5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{invitation.name} · {invitation.email}</p>
                <p className="text-text-secondary text-xs">{roleLabel(invitation.role)} · 만료 {formatDate(invitation.expiresAt)}</p>
              </div>
              <button type="button" onClick={() => revoke(invitation.id)} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30">취소</button>
            </div>
          ))}
          {invitations.length === 0 && <Empty>대기 중인 초대가 없습니다.</Empty>}
        </div>
      </section>
    </div>
  );
}

function AuditSection({ rows, loading }: { rows: AuditRow[]; loading: boolean }) {
  if (loading) return <Loading />;
  return (
    <section className={`${CARD} overflow-hidden`}>
      <div className="border-b border-slate-100 px-5 py-4 dark:border-white/7"><h2 className="font-bold">최근 변경 이력</h2><p className="text-text-secondary mt-1 text-sm">계정과 권한에 적용된 변경을 확인할 수 있습니다.</p></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-slate-50/80 dark:bg-white/4">
            <tr><th className="p-3 text-left">시각</th><th className="p-3 text-left">작업자</th><th className="p-3 text-left">작업</th><th className="p-3 text-left">대상</th></tr>
          </thead>
          <tbody>{rows.map((row) => (
            <tr key={row.id} className="border-t dark:border-background-dark-secondary">
              <td className="p-3">{formatDateTime(row.createdAt)}</td><td className="p-3">{row.actorName}</td>
              <td className="p-3 font-medium">{actionLabel(row.action)}</td><td className="p-3">{row.targetType} {row.targetId ?? ""}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {rows.length === 0 && <Empty>기록된 변경이 없습니다.</Empty>}
    </section>
  );
}

function SiteChecks({ sites, selected, onChange }: { sites: SiteOption[]; selected: string[]; onChange: (value: string[]) => void }) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  return (
    <fieldset className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/45 p-3.5 dark:border-white/8 dark:bg-white/3">
      <legend className="px-1.5 text-xs font-bold text-slate-600 dark:text-text-dark-primary/70">접근 가능 사업장 · {selected.length}곳 선택</legend>
      <div className="mt-1 grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
        {sites.map((site) => (
          <label key={site.id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${selectedSet.has(site.id) ? "bg-sky-100/70 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200" : "hover:bg-white dark:hover:bg-white/5"}`}>
            <input type="checkbox" checked={selectedSet.has(site.id)} onChange={(event) => {
              onChange(event.target.checked ? [...selected, site.id] : selected.filter((id) => id !== site.id));
            }} />
            <span>{site.id} · {site.name ?? "이름 없음"}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold transition ${active ? "bg-[#174d70] text-white shadow-sm dark:bg-sky-700" : "text-slate-500 hover:bg-slate-100 dark:text-text-dark-primary/55 dark:hover:bg-white/5"}`}>{children}</button>;
}
function Loading() { return <main className="flex min-h-[50vh] items-center justify-center"><ThreeDotLoader size="xl" /></main>; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="text-text-secondary p-5 text-center text-sm">{children}</p>; }
function AccessDenied() { return <main className="mx-auto max-w-md p-8 text-center"><h1 className="text-xl font-bold">접근 권한이 없습니다</h1><Link href="/" className="mt-4 inline-block underline">대시보드로 이동</Link></main>; }
function roleLabel(role: Role) { return role === "SUPER_ADMIN" ? "최고관리자" : role === "ADMIN" ? "관리자" : "일반 사용자"; }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString("ko-KR") : "-"; }
function formatDateTime(value: string) { return new Date(value).toLocaleString("ko-KR"); }
function actionLabel(value: string) { return ({ ACCOUNT_INVITED: "사용자 초대", INVITATION_REVOKED: "초대 취소", INVITATION_ACCEPTED: "가입 완료", ACCOUNT_UPDATED: "계정 변경", PASSWORD_CHANGED: "비밀번호 변경", PASSWORD_RESET_CREATED: "초기화 링크 생성", PASSWORD_RESET_COMPLETED: "비밀번호 초기화 완료" } as Record<string, string>)[value] ?? value; }
function SummaryChip({ value, label }: { value: number; label: string }) { return <div className="rounded-2xl border border-white/10 bg-white/10 px-3.5 py-2 backdrop-blur-sm"><span className="text-base font-extrabold">{value}</span><span className="ml-1.5 text-xs font-medium text-white/65">{label}</span></div>; }
function StatusPill({ status }: { status: "ACTIVE" | "SUSPENDED" }) { return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}><span className={`h-1.5 w-1.5 rounded-full ${status === "ACTIVE" ? "bg-emerald-500" : "bg-rose-500"}`} />{status === "ACTIVE" ? "활성" : "정지"}</span>; }
