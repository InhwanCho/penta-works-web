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
  "rounded-lg border bg-white shadow-sm dark:border-background-dark-secondary dark:bg-background-dark-card";
const INPUT =
  "w-full rounded-md border bg-white px-3 py-2 text-sm dark:border-background-dark-secondary dark:bg-background-dark-primary";

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
    <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 lg:px-6">
      <header className="mb-5">
        <h1 className="text-text-major dark:text-text-dark-primary text-2xl font-bold">
          계정 관리
        </h1>
        <p className="text-text-secondary mt-1 text-sm">
          사용자 초대, 권한, 사업장 접근 범위와 변경 이력을 관리합니다.
        </p>
      </header>

      <div className="mb-4 flex gap-2">
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
    <section className="space-y-3">
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
    <article className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{user.name}</p>
          <p className="text-text-secondary text-sm">{user.email}</p>
          <p className="text-text-secondary mt-1 text-xs">
            최근 로그인 {formatDate(user.lastLoginAt)} · 가입 {formatDate(user.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
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
        <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
          {message && <span className="text-text-secondary text-xs">{message}</span>}
          <button type="button" disabled={saving} onClick={createPasswordReset}
            className="rounded-md border px-3 py-2 text-sm font-semibold dark:border-background-dark-secondary">
            비밀번호 초기화 링크
          </button>
          <button type="button" disabled={saving} onClick={save}
            className="bg-button-primary rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "저장 중…" : "변경 저장"}
          </button>
        </div>
      )}
      {resetLink && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/20">
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form onSubmit={submit} className={`${CARD} space-y-3 p-4`}>
        <h2 className="font-semibold">새 사용자 초대</h2>
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
          className="bg-button-primary w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? "생성 중…" : "7일 초대 링크 생성"}
        </button>
        {link && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm dark:bg-emerald-950/20">
            <p className="mb-2 font-semibold">초대 링크가 생성되었습니다.</p>
            <textarea className={`${INPUT} min-h-20`} readOnly value={link} />
            <button type="button" className="mt-2 text-sm font-semibold underline"
              onClick={() => navigator.clipboard.writeText(link)}>링크 복사</button>
          </div>
        )}
      </form>
      <section className={`${CARD} p-4`}>
        <h2 className="mb-3 font-semibold">대기 중인 초대</h2>
        <div className="space-y-2">
          {invitations.map((invitation) => (
            <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-md border p-3 dark:border-background-dark-secondary">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{invitation.name} · {invitation.email}</p>
                <p className="text-text-secondary text-xs">{roleLabel(invitation.role)} · 만료 {formatDate(invitation.expiresAt)}</p>
              </div>
              <button type="button" onClick={() => revoke(invitation.id)} className="text-sm font-semibold text-red-600">취소</button>
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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-background-primary dark:bg-background-dark-secondary">
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
    <fieldset className="mt-3 rounded-md border p-3 dark:border-background-dark-secondary">
      <legend className="px-1 text-xs font-semibold">접근 가능 사업장</legend>
      <div className="max-h-44 space-y-1 overflow-y-auto">
        {sites.map((site) => (
          <label key={site.id} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
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
  return <button type="button" onClick={onClick} className={`rounded-md px-4 py-2 text-sm font-semibold ${active ? "bg-button-primary text-white" : "bg-background-tertiary dark:bg-background-dark-secondary"}`}>{children}</button>;
}
function Loading() { return <main className="flex min-h-[50vh] items-center justify-center"><ThreeDotLoader size="xl" /></main>; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="text-text-secondary p-5 text-center text-sm">{children}</p>; }
function AccessDenied() { return <main className="mx-auto max-w-md p-8 text-center"><h1 className="text-xl font-bold">접근 권한이 없습니다</h1><Link href="/" className="mt-4 inline-block underline">대시보드로 이동</Link></main>; }
function roleLabel(role: Role) { return role === "SUPER_ADMIN" ? "최고관리자" : role === "ADMIN" ? "관리자" : "일반 사용자"; }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString("ko-KR") : "-"; }
function formatDateTime(value: string) { return new Date(value).toLocaleString("ko-KR"); }
function actionLabel(value: string) { return ({ ACCOUNT_INVITED: "사용자 초대", INVITATION_REVOKED: "초대 취소", INVITATION_ACCEPTED: "가입 완료", ACCOUNT_UPDATED: "계정 변경", PASSWORD_CHANGED: "비밀번호 변경", PASSWORD_RESET_CREATED: "초기화 링크 생성", PASSWORD_RESET_COMPLETED: "비밀번호 초기화 완료" } as Record<string, string>)[value] ?? value; }
