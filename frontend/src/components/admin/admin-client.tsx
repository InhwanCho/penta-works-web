"use client";

import ManagementTabs from "@/components/common/management-tabs";
import CircleLoader from "@/components/icons/circle-loader";
import CompanyMetricsEditor from "@/components/admin/company-metrics-editor";
import RecipientManagement from "@/components/admin/recipient-management";
import DeleteAccountDialog from "@/components/admin/delete-account-dialog";
import PhoneInput from "@/components/forms/phone-input";
import { formatPhone, phoneDigits } from "@/lib/phone";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch, type Role } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { type FormEvent, useEffect, useMemo, useState } from "react";

type UserRow = {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  status: "ACTIVE" | "SUSPENDED";
  lastLoginAt: string | null;
  createdAt: string;
  siteIds: string[];
};
type SiteOption = {
  id: string;
  name: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  timezone: string;
  companyId: number;
  companyCode: string;
  companyName: string;
};
type CompanySummary = { id: number; code: string; name: string };
type Invitation = {
  phone: string | null;
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
  deliveryStatus: "SENT" | "FAILED" | "DISABLED";
};
type AuditRow = {
  id: number;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  beforeData: string | null;
  afterData: string | null;
  ipAddress: string | null;
  createdAt: string;
};
type PasswordResetCreated = { token: string; email: string; expiresAt: string; deliveryStatus: "SENT" | "FAILED" | "DISABLED" };

const CARD =
  "rounded-xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(22,58,82,0.045)] dark:border-white/8 dark:bg-background-dark-card";
const INPUT =
  "min-w-0 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm transition hover:border-slate-300 focus:border-sky-400 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-text-dark-primary dark:caret-sky-300 dark:placeholder:text-text-dark-primary/55 dark:hover:border-white/20 dark:focus:bg-white/8";

export default function AdminClient() {
  const { session, isLoading } = useAuth();
  const [tab, setTab] = useState<"users" | "invitations" | "sites" | "metrics" | "recipients" | "audit">("users");
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch<UserRow[]>("/admin/accounts/users"),
    enabled: Boolean(session && session.role !== "USER"),
  });
  const company = useQuery({
    queryKey: ["admin-company"],
    queryFn: () => apiFetch<CompanySummary>("/admin/accounts/company"),
    enabled: Boolean(session && session.role !== "USER"),
    staleTime: 10 * 60_000,
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
      <header className="relative mb-6 overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#123b5d,#176083)] px-5 py-6 text-white shadow-[0_10px_28px_rgba(17,65,94,0.14)] sm:px-7 sm:py-7">
        <div className="absolute -top-16 -right-12 h-48 w-48 rounded-full bg-white/8 blur-sm" />
        <div className="absolute -right-4 -bottom-20 h-40 w-40 rounded-full bg-sky-300/10" />
        <div className="relative">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold tracking-[0.16em] text-sky-200 uppercase">Workspace</p>
            {company.data && <span className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-bold text-white/85">{company.data.name} · {company.data.code}</span>}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">워크스페이스 관리</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
            사용자·병원과 대시보드 측정항목을 관리하세요.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <SummaryChip value={users.data?.length ?? 0} label="전체 사용자" />
            <SummaryChip value={(users.data ?? []).filter((user) => user.status === "ACTIVE").length} label="활성 계정" />
            <SummaryChip value={invitations.data?.length ?? 0} label="대기 중 초대" />
            <SummaryChip value={sites.data?.length ?? 0} label="병원" />
          </div>
        </div>
      </header>

      <ManagementTabs label="관리 설정" value={tab} onChange={setTab} items={[
        {value:"users",label:"사용자"}, {value:"invitations",label:"초대"}, {value:"sites",label:"병원"},
        {value:"metrics",label:"측정항목"}, {value:"recipients",label:"수신처"}, {value:"audit",label:"활동 기록"},
      ]} />

      {tab === "users" && (
        <UserSection
          users={users.data ?? []}
          sites={sites.data ?? []}
          loading={users.isLoading || sites.isLoading}
          canManageAdmins={session.role === "PLATFORM_ADMIN" || session.role === "SUPER_ADMIN"}
          currentUserId={session.id}
        />
      )}
      {tab === "invitations" && (
        <InvitationSection
          invitations={invitations.data ?? []}
          sites={sites.data ?? []}
          canInviteAdmins={session.role === "PLATFORM_ADMIN" || session.role === "SUPER_ADMIN"}
        />
      )}
      {tab === "sites" && <SiteSection sites={sites.data ?? []} company={company.data ?? null} loading={sites.isLoading || company.isLoading} />}
      {tab === "audit" && <AuditSection rows={audits.data ?? []} loading={audits.isLoading} />}
      {tab === "metrics" && <CompanyMetricsEditor />}
      {tab === "recipients" && <RecipientManagement sites={(sites.data ?? []).map(site => ({siteid: site.id, name: site.name}))} />}
    </main>
  );
}

function UserSection({ users, sites, loading, canManageAdmins, currentUserId }: {
  users: UserRow[];
  sites: SiteOption[];
  loading: boolean;
  canManageAdmins: boolean;
  currentUserId: number;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return users.filter((user) => (!keyword || `${user.name} ${user.email} ${user.phone ?? ""}`.toLowerCase().includes(keyword)) &&
      (roleFilter === "ALL" || user.role === roleFilter) &&
      (statusFilter === "ALL" || user.status === statusFilter));
  }, [users, query, roleFilter, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageUsers = filtered.slice((page - 1) * pageSize, page * pageSize);
  const editingUser = pageUsers.find((user) => user.id === editingId);
  useEffect(() => setPage(1), [query, roleFilter, statusFilter]);
  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount]);
  if (loading) return <Loading />;
  return (
    <section>
      <div className={`${CARD} mb-4 grid min-w-0 gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]`}>
        <input type="search" className={INPUT} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름·이메일·휴대폰번호 검색" />
        <select className={INPUT} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as "ALL" | Role)}><option value="ALL">모든 권한</option><option value="PLATFORM_ADMIN">플랫폼 관리자</option><option value="SUPER_ADMIN">최고관리자</option><option value="ADMIN">관리자</option><option value="USER">일반 사용자</option></select>
        <select className={INPUT} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "SUSPENDED")}><option value="ALL">모든 상태</option><option value="ACTIVE">활성</option><option value="SUSPENDED">정지</option></select>
      </div>
      <p className="text-text-secondary mb-2 px-1 text-xs dark:text-text-dark-primary/70">휴대폰번호는 사용자 연락처입니다. 실제 알림톡 수신번호는 관리 설정의 수신처에서 별도로 등록합니다.</p>
      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full min-w-[900px] text-left text-sm whitespace-nowrap">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-text-secondary dark:border-white/10 dark:bg-white/5 dark:text-text-dark-primary/70">
            <tr>
              <th scope="col" className="px-3 py-3 font-bold">이름</th>
              <th scope="col" className="px-3 py-3 font-bold">이메일 (아이디)</th>
              <th scope="col" className="px-3 py-3 font-bold">휴대폰번호</th>
              <th scope="col" className="px-3 py-3 font-bold">권한</th>
              <th scope="col" className="px-3 py-3 font-bold">상태</th>
              <th scope="col" className="px-3 py-3 font-bold">병원</th>
              <th scope="col" className="px-3 py-3 font-bold">최근 로그인</th>
              <th scope="col" className="px-3 py-3 font-bold">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/7">
            {pageUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/70 dark:hover:bg-white/5">
                <td className="px-3 py-3 font-bold">{user.name}</td>
                <td className="px-3 py-3">{user.email}</td>
                <td className="px-3 py-3 whitespace-nowrap">{formatPhone(user.phone) || "미등록"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{roleLabel(user.role)}</td>
                <td className="px-3 py-3"><StatusPill status={user.status} /></td>
                <td className="px-3 py-3 whitespace-nowrap">{user.role === "USER" ? `${user.siteIds.length}곳` : "전체"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{formatDate(user.lastLoginAt)}</td>
                <td className="px-3 py-3"><button type="button" onClick={() => setEditingId((current) => current === user.id ? null : user.id)} aria-expanded={editingId === user.id} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-sky-700 dark:border-white/10 dark:text-sky-300">{editingId === user.id ? "닫기" : "관리"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <Empty>조건에 맞는 사용자가 없습니다.</Empty>}
      </div>
      {editingUser && <div className="mt-4"><UserEditor key={editingUser.id} user={editingUser} sites={sites} canManageAdmins={canManageAdmins} currentUserId={currentUserId} /></div>}
      {filtered.length > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-text-secondary text-xs">총 {filtered.length}명 · {page}/{pageCount} 페이지</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40 dark:border-white/10">이전</button><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40 dark:border-white/10">다음</button></div></div>}
    </section>
  );
}

function UserEditor({ user, sites, canManageAdmins, currentUserId }: {
  user: UserRow;
  sites: SiteOption[];
  canManageAdmins: boolean;
  currentUserId: number;
}) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<Role>(user.role);
  const [status, setStatus] = useState(user.status);
  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [siteIds, setSiteIds] = useState(user.siteIds);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const immutable = user.role === "PLATFORM_ADMIN" || user.role === "SUPER_ADMIN" || (user.role === "ADMIN" && !canManageAdmins);
  const canDelete = user.role !== "PLATFORM_ADMIN" && user.id !== currentUserId && (user.role === "USER" || canManageAdmins);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch(`/admin/accounts/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ email, name, phone: phoneDigits(phone) || null, role, status, siteIds }),
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

  async function remove(confirmationEmail: string) {
    if (!canDelete || saving || confirmationEmail.trim().toLowerCase() !== user.email.toLowerCase()) return;
    setSaving(true); setMessage(null);
    try {
      await apiFetch(`/admin/accounts/users/${user.id}`, { method: "DELETE", body: JSON.stringify({ confirmationEmail }) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-audits"] }),
      ]);
    } finally { setSaving(false); }
  }

  async function createPasswordReset() {
    setSaving(true);
    setMessage(null);
    try {
      const result = await apiFetch<PasswordResetCreated>(`/admin/accounts/users/${user.id}/password-reset`, { method: "POST" });
      setResetLink(`${window.location.origin}/reset-password?token=${encodeURIComponent(result.token)}`);
      setMessage(result.deliveryStatus === "SENT" ? "재설정 이메일을 발송했습니다." : result.deliveryStatus === "FAILED" ? "메일 발송에 실패해 수동 링크를 생성했습니다." : "메일이 비활성화되어 수동 링크를 생성했습니다.");
      await queryClient.invalidateQueries({ queryKey: ["admin-audits"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "재설정 링크를 만들지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`${CARD} group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(22,58,82,0.075)]`}>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 opacity-0 transition group-hover:opacity-100" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-cyan-50 text-base font-extrabold text-sky-700 dark:from-sky-950 dark:to-cyan-950 dark:text-sky-200">
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
        <div className="grid w-full min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2 sm:max-w-sm">
          <select className={INPUT} value={role} disabled={immutable}
            onChange={(event) => setRole(event.target.value as Role)}>
            {user.role === "PLATFORM_ADMIN" && <option value="PLATFORM_ADMIN">플랫폼 관리자</option>}
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
      {!immutable && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-text-secondary text-xs font-bold">이름<input className={`${INPUT} mt-1.5`} required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="text-text-secondary text-xs font-bold">이메일 (아이디)<input className={`${INPUT} mt-1.5`} type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="text-text-secondary text-xs font-bold sm:col-span-2">휴대폰번호<PhoneInput className={`${INPUT} mt-1.5`} value={phone} onValueChange={setPhone} placeholder="010-1234-5678" /></label></div>}
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
          {canDelete && <button type="button" disabled={saving} onClick={() => setConfirmDelete(true)} className="cursor-pointer rounded-xl px-3.5 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30">계정 삭제</button>}
        </div>
      )}
      {immutable && canDelete && <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-white/7">{message && <span className="text-text-secondary text-xs">{message}</span>}<button type="button" disabled={saving} onClick={() => setConfirmDelete(true)} className="cursor-pointer rounded-xl px-3.5 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30">{user.role === "SUPER_ADMIN" ? "최고관리자 삭제" : "계정 삭제"}</button></div>}
      {confirmDelete && canDelete && <DeleteAccountDialog email={user.email} name={user.name} onClose={() => setConfirmDelete(false)} onConfirm={remove} />}
      {resetLink && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
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
  const form = useForm<{ email: string; name: string; phone: string; role: Role }>({
    mode: "onChange", defaultValues: { email: "", name: "", phone: "", role: "USER" },
  });
  const role = useWatch({ control: form.control, name: "role" });
  const { register, formState: { errors } } = form;
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit({ email, name, phone, role }: { email: string; name: string; phone: string; role: Role }) {
    setSaving(true);
    setMessage(null);
    try {
      const result = await apiFetch<InvitationCreated>("/admin/accounts/invitations", {
        method: "POST",
        body: JSON.stringify({ email, name, role, siteIds, phone: phoneDigits(phone) || null }),
      });
      setLink(`${window.location.origin}/accept-invite?token=${encodeURIComponent(result.token)}`);
      setMessage(result.deliveryStatus === "SENT" ? "초대 이메일을 발송했습니다." : result.deliveryStatus === "FAILED" ? "메일 발송에 실패해 수동 링크를 생성했습니다." : "메일이 비활성화되어 수동 링크를 생성했습니다.");
      form.reset({ email: "", name: "", phone: "", role });
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

  async function resend(id: string) {
    setResendingId(id); setSaving(true); setMessage(null);
    try {
      const result = await apiFetch<InvitationCreated>(`/admin/accounts/invitations/${id}/resend`, { method: "POST" });
      setLink(`${window.location.origin}/accept-invite?token=${encodeURIComponent(result.token)}`);
      setMessage(result.deliveryStatus === "SENT" ? "초대 이메일을 다시 발송했습니다." : result.deliveryStatus === "FAILED" ? "메일 발송에 실패해 새 수동 링크를 생성했습니다." : "메일이 비활성화되어 새 수동 링크를 생성했습니다.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-invitations"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-audits"] }),
      ]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "초대를 재발송하지 못했습니다."); }
    finally { setResendingId(null); setSaving(false); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
      <form noValidate onSubmit={form.handleSubmit(submit)} aria-busy={saving} className={`${CARD} space-y-4 p-5 sm:p-6`}>
        <div><h2 className="text-lg font-bold">새 사용자 초대</h2><p className="text-text-secondary mt-1 text-sm">초대받은 사용자가 직접 비밀번호를 설정합니다.</p></div>
        <fieldset disabled={saving} className="space-y-4">
        <div><label htmlFor="invite-email" className="text-sm font-bold">이메일</label><input id="invite-email" className={`${INPUT} mt-1.5`} type="email" aria-invalid={Boolean(errors.email)} aria-describedby="invite-email-error" placeholder="이메일" {...register("email", { required: "이메일을 입력해주세요.", maxLength: {value:254,message:"이메일은 254자 이하로 입력해주세요."}, pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "올바른 이메일을 입력해주세요." }, setValueAs: value => value.trim() })} />{errors.email && <p id="invite-email-error" role="alert" className="mt-1 text-xs text-rose-600">{errors.email.message}</p>}</div>
        <div><label htmlFor="invite-name" className="text-sm font-bold">이름</label><input id="invite-name" className={`${INPUT} mt-1.5`} aria-invalid={Boolean(errors.name)} aria-describedby="invite-name-error" placeholder="이름" maxLength={80} {...register("name", { required: "이름을 입력해주세요.", maxLength: {value:80,message:"이름은 80자 이하로 입력해주세요."}, setValueAs: value => value.trim() })} />{errors.name && <p id="invite-name-error" role="alert" className="mt-1 text-xs text-rose-600">{errors.name.message}</p>}</div>
        <div><label htmlFor="invite-phone" className="text-sm font-bold">휴대폰번호 (카카오 알림용)</label>
          <Controller control={form.control} name="phone" rules={{ validate: value => !value || /^01[016789][0-9]{7,8}$/.test(value) || "휴대폰번호를 확인해주세요. 예: 010-1234-5678" }} render={({ field }) => <PhoneInput id="invite-phone" name={field.name} onBlur={field.onBlur} value={field.value} onValueChange={field.onChange} className={`${INPUT} mt-1.5`} aria-invalid={Boolean(errors.phone)} aria-describedby="invite-phone-help invite-phone-error" placeholder="010-1234-5678" />} />
          {errors.phone && <p id="invite-phone-error" role="alert" className="mt-1 text-xs text-rose-600">{errors.phone.message}</p>}
          <p id="invite-phone-help" className="text-text-secondary mt-1.5 text-xs leading-5">가입 완료 시 연락처에 저장됩니다. 알림관리에서 담당자를 선택하면 이 번호가 입력됩니다. 초대 링크는 이메일로 발송합니다.</p>
        </div>
        <label className="block text-sm font-bold">권한<select className={`${INPUT} select-inset-arrow mt-1.5`} {...register("role")}>
          <option value="USER">일반 사용자</option>
          {canInviteAdmins && <option value="ADMIN">관리자</option>}
          {canInviteAdmins && <option value="SUPER_ADMIN">최고관리자</option>}
        </select></label>
        </fieldset>
        {role === "USER" && <fieldset disabled={saving}><SiteChecks sites={sites} selected={siteIds} onChange={setSiteIds} /></fieldset>}
        {message && <p className="text-sm text-red-600">{message}</p>}
        <button type="submit" disabled={saving}
          className="bg-button-primary hover:bg-button-primary-hover w-full cursor-pointer rounded-xl px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50">
          {saving && !resendingId && <CircleLoader className="mr-2 align-middle [&>span]:h-4 [&>span]:w-4 [&>span]:border-white/40 [&>span]:border-t-white" />}{saving && !resendingId ? "초대 발송 중" : "7일 초대 링크 생성"}
        </button>
        {link && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
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
            <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/3 dark:hover:bg-white/5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{invitation.name} · {invitation.email}</p>
                <p className="text-text-secondary text-xs">{invitation.phone && `${formatPhone(invitation.phone)} · `}{roleLabel(invitation.role)} · 만료 {formatDate(invitation.expiresAt)}</p>
              </div>
              <div className="flex shrink-0 gap-1"><button type="button" disabled={saving || (!canInviteAdmins && invitation.role !== "USER")} onClick={() => resend(invitation.id)} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 disabled:opacity-40 dark:text-sky-300 dark:hover:bg-sky-950/30">{resendingId === invitation.id && <CircleLoader className="mr-1 align-middle [&>span]:h-3 [&>span]:w-3" />}{resendingId === invitation.id ? "발송 중" : "재발송"}</button><button type="button" disabled={saving} onClick={() => revoke(invitation.id)} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30">취소</button></div>
            </div>
          ))}
          {invitations.length === 0 && <Empty>대기 중인 초대가 없습니다.</Empty>}
        </div>
      </section>
    </div>
  );
}

function SiteSection({ sites, company, loading }: { sites: SiteOption[]; company: CompanySummary | null; loading: boolean }) {
  const queryClient = useQueryClient();
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setMessage(null);
    try {
      await apiFetch<SiteOption>("/admin/accounts/sites", {
        method: "POST",
        body: JSON.stringify({ id, name, timezone: "Asia/Seoul" }),
      });
      setId(""); setName(""); setMessage("병원을 추가했습니다.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-sites"] }),
        queryClient.invalidateQueries({ queryKey: ["alert-thresholds"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-audits"] }),
      ]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "병원을 추가하지 못했습니다."); }
    finally { setSaving(false); }
  }

  return <section>
    <form onSubmit={create} className={`${CARD} mb-5 grid gap-3 p-5 sm:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)_auto] sm:items-end sm:p-6`}>
      <div className="sm:col-span-3"><h2 className="text-lg font-bold">새 병원 추가</h2><p className="text-text-secondary mt-1 text-sm">{company ? `${company.name} 회사에 추가됩니다. ` : ""}코드는 생성 후 변경할 수 없습니다. 기존 측정 데이터와 같은 코드를 사용하면 자동으로 연결됩니다.</p></div>
      <label className="text-text-secondary text-xs font-bold">병원 코드<input className={`${INPUT} mt-1.5`} required maxLength={32} pattern="[A-Za-z0-9_-]+" placeholder="예: 031" value={id} onChange={(event) => setId(event.target.value)} /></label>
      <label className="text-text-secondary text-xs font-bold">병원 이름<input className={`${INPUT} mt-1.5`} required maxLength={20} placeholder="병원 이름" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <button type="submit" disabled={saving} className="bg-button-primary hover:bg-button-primary-hover cursor-pointer rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "추가 중…" : "병원 추가"}</button>
      {message && <p className="text-text-secondary text-xs sm:col-span-3">{message}</p>}
    </form>
    {loading ? <Loading /> : sites.length === 0 ? <Empty>등록된 병원이 없습니다.</Empty> : (
      <div className="space-y-5">
        {groupSites(sites).map((group) => (
          <section key={group.companyId} aria-labelledby={`company-sites-${group.companyId}`}>
            <div className="mb-2.5 flex items-center gap-2 px-1">
              <h2 id={`company-sites-${group.companyId}`} className="font-extrabold">{group.companyName}</h2>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500 dark:bg-white/7 dark:text-text-dark-primary/60">{group.companyCode}</span>
              <span className="text-text-secondary text-xs">병원 {group.sites.length}곳</span>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">{group.sites.map((site) => <SiteEditor key={site.id} site={site} />)}</div>
          </section>
        ))}
      </div>
    )}
  </section>;
}

function SiteEditor({ site }: { site: SiteOption }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(site.name ?? "");
  const [address, setAddress] = useState(site.address ?? "");
  const [contactName, setContactName] = useState(site.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(site.contactPhone ?? "");
  const [timezone, setTimezone] = useState(site.timezone || "Asia/Seoul");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      await apiFetch<SiteOption>(`/admin/accounts/sites/${encodeURIComponent(site.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name, address: address || null, contactName: contactName || null, contactPhone: contactPhone || null, timezone }),
      });
      setMessage("저장했습니다.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-sites"] }),
        queryClient.invalidateQueries({ queryKey: ["alert-thresholds"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-audits"] }),
      ]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "병원 정보를 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }

  return <form onSubmit={save} className={`${CARD} p-5`}>
    <div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="font-extrabold">{site.name ?? "이름 없는 병원"}</h3><p className="text-text-secondary mt-0.5 text-xs">병원 코드 {site.id}</p></div><span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 dark:bg-sky-950/40 dark:text-sky-200">코드 고정</span></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-text-secondary text-xs font-bold">병원 이름<input className={`${INPUT} mt-1.5`} required maxLength={20} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="text-text-secondary text-xs font-bold">시간대<input className={`${INPUT} mt-1.5`} required maxLength={40} value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label>
      <label className="text-text-secondary text-xs font-bold sm:col-span-2">주소<input className={`${INPUT} mt-1.5`} maxLength={255} value={address} onChange={(event) => setAddress(event.target.value)} /></label>
      <label className="text-text-secondary text-xs font-bold">담당자<input className={`${INPUT} mt-1.5`} maxLength={80} value={contactName} onChange={(event) => setContactName(event.target.value)} /></label>
      <label className="text-text-secondary text-xs font-bold">담당자 연락처<input className={`${INPUT} mt-1.5`} maxLength={30} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></label>
    </div>
    <div className="mt-4 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-white/7">{message && <span className="text-text-secondary text-xs">{message}</span>}<button type="submit" disabled={saving} className="bg-button-primary hover:bg-button-primary-hover cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "저장 중…" : "정보 저장"}</button></div>
  </form>;
}

function AuditSection({ rows, loading }: { rows: AuditRow[]; loading: boolean }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  if (loading) return <Loading />;
  return (
    <section className={`${CARD} overflow-hidden`}>
      <div className="border-b border-slate-100 px-5 py-4 dark:border-white/7"><h2 className="font-bold">최근 변경 이력</h2><p className="text-text-secondary mt-1 text-sm">계정과 권한에 적용된 변경을 확인할 수 있습니다.</p></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-slate-50/80 dark:bg-white/4">
            <tr><th className="p-3 text-left">시각</th><th className="p-3 text-left">작업자</th><th className="p-3 text-left">작업</th><th className="p-3 text-left">대상</th><th className="w-20 p-3 text-center whitespace-nowrap">상세</th></tr>
          </thead>
          <tbody>{rows.map((row) => <AuditRows key={row.id} row={row} open={expanded === row.id} onToggle={() => setExpanded((current) => current === row.id ? null : row.id)} />)}</tbody>
        </table>
      </div>
      {rows.length === 0 && <Empty>기록된 변경이 없습니다.</Empty>}
    </section>
  );
}

function AuditRows({ row, open, onToggle }: { row: AuditRow; open: boolean; onToggle: () => void }) {
  return <><tr className="border-t dark:border-background-dark-secondary"><td className="p-3">{formatDateTime(row.createdAt)}</td><td className="p-3">{row.actorName}</td><td className="p-3 font-medium">{actionLabel(row.action)}</td><td className="p-3">{row.targetType} {row.targetId ?? ""}</td><td className="w-20 p-3 text-center whitespace-nowrap"><button type="button" onClick={onToggle} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/30">{open ? "닫기" : "보기"}</button></td></tr>{open && <tr className="bg-slate-50/70 dark:bg-white/3"><td colSpan={5} className="p-4"><div className="grid gap-3 sm:grid-cols-2"><AuditData label="변경 전" value={row.beforeData} /><AuditData label="변경 후" value={row.afterData} /></div>{row.ipAddress && <p className="text-text-secondary mt-3 text-xs">IP {row.ipAddress}</p>}</td></tr>}</>;
}

function AuditData({ label, value }: { label: string; value: string | null }) {
  let formatted = value ?? "기록 없음";
  if (value) { try { formatted = JSON.stringify(JSON.parse(value), null, 2); } catch { /* 원문 표시 */ } }
  return <div><p className="text-text-secondary mb-1 text-xs font-bold">{label}</p><pre className="max-h-52 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] leading-5 whitespace-pre-wrap text-slate-100">{formatted}</pre></div>;
}

function SiteChecks({ sites, selected, onChange }: { sites: SiteOption[]; selected: string[]; onChange: (value: string[]) => void }) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  return (
    <fieldset className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/45 p-3.5 dark:border-white/8 dark:bg-white/3">
      <legend className="px-1.5 text-xs font-bold text-slate-600 dark:text-text-dark-primary/70">접근 가능 병원 · {selected.length}곳 선택</legend>
      <div className="mb-2 flex flex-wrap gap-2">
        <button type="button" disabled={sites.length === 0 || sites.every(site => selectedSet.has(site.id))} onClick={() => onChange([...new Set(sites.map(site => site.id))])} className="min-h-11 rounded-lg border border-sky-200 px-3 text-xs font-bold text-sky-700 disabled:opacity-40 dark:border-sky-800 dark:text-sky-300">전체 선택</button>
        <button type="button" disabled={selected.length === 0} onClick={() => onChange([])} className="min-h-11 rounded-lg border border-slate-200 px-3 text-xs font-bold disabled:opacity-40 dark:border-white/10">전체 해제</button>
      </div>
      <div className="mt-1 max-h-56 space-y-2 overflow-y-auto">
        {groupSites(sites).map((group) => <div key={group.companyId}>
          <p className="px-2 py-1 text-[11px] font-extrabold text-slate-500 dark:text-text-dark-primary/55">{group.companyName} · {group.companyCode}</p>
          <div className="grid gap-1 sm:grid-cols-2">{group.sites.map((site) => (
            <label key={site.id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${selectedSet.has(site.id) ? "bg-sky-100/70 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200" : "hover:bg-white dark:hover:bg-white/5"}`}>
              <input type="checkbox" checked={selectedSet.has(site.id)} onChange={(event) => {
                onChange(event.target.checked ? [...selected, site.id] : selected.filter((id) => id !== site.id));
              }} />
              <span>{site.id} · {site.name ?? "이름 없음"}</span>
            </label>
          ))}</div>
        </div>)}
      </div>
    </fieldset>
  );
}

function groupSites(sites: SiteOption[]) {
  const groups = new Map<number, { companyId: number; companyCode: string; companyName: string; sites: SiteOption[] }>();
  for (const site of sites) {
    const group = groups.get(site.companyId) ?? {
      companyId: site.companyId,
      companyCode: site.companyCode,
      companyName: site.companyName,
      sites: [],
    };
    group.sites.push(site);
    groups.set(site.companyId, group);
  }
  return [...groups.values()];
}

function Loading() { return <main className="flex min-h-[50vh] items-center justify-center"><CircleLoader size="xl" /></main>; }
function Empty({ children }: { children: React.ReactNode }) { return <p className="text-text-secondary p-5 text-center text-sm">{children}</p>; }
function AccessDenied() { return <main className="mx-auto max-w-md p-8 text-center"><h1 className="text-xl font-bold">접근 권한이 없습니다</h1><Link href="/" className="mt-4 inline-block underline">대시보드로 이동</Link></main>; }
function roleLabel(role: Role) { return role === "PLATFORM_ADMIN" ? "플랫폼 관리자" : role === "SUPER_ADMIN" ? "최고관리자" : role === "ADMIN" ? "관리자" : "일반 사용자"; }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString("ko-KR") : "-"; }
function formatDateTime(value: string) { return new Date(value).toLocaleString("ko-KR"); }
function actionLabel(value: string) { return ({ COMPANY_METRICS_UPDATED: "측정항목 표시 변경", PASSWORD_RESET_REQUESTED: "비밀번호 찾기 요청", ALERT_DELIVERY_CONFIRMED: "수신 여부 확인", ACCOUNT_INVITED: "사용자 초대", INVITATION_RESENT: "초대 재발송", INVITATION_REVOKED: "초대 취소", INVITATION_ACCEPTED: "가입 완료", ACCOUNT_UPDATED: "계정 변경", ACCOUNT_DELETED: "계정 삭제", PASSWORD_CHANGED: "비밀번호 변경", ACCOUNT_PROFILE_UPDATED: "내 정보 변경", PASSWORD_RESET_CREATED: "초기화 링크 생성", PASSWORD_RESET_COMPLETED: "비밀번호 초기화 완료", PSI_THRESHOLD_UPDATED: "hePsi 기준값 변경", ALERT_THRESHOLDS_UPDATED: "알림 기준값 변경", ALERT_ACKNOWLEDGED: "알림 확인", ALERT_RECIPIENT_CREATED: "알림 수신자 추가", ALERT_RECIPIENT_UPDATED: "알림 수신자 변경", ALERT_RECIPIENT_DELETED: "알림 수신자 삭제", SITE_CREATED: "병원 추가", SITE_UPDATED: "병원 정보 변경" } as Record<string, string>)[value] ?? value; }
function SummaryChip({ value, label }: { value: number; label: string }) { return <div className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-2 backdrop-blur-sm"><span className="text-base font-extrabold">{value}</span><span className="ml-1.5 text-xs font-medium text-white/65">{label}</span></div>; }
function StatusPill({ status }: { status: "ACTIVE" | "SUSPENDED" }) { return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}><span className={`h-1.5 w-1.5 rounded-full ${status === "ACTIVE" ? "bg-emerald-500" : "bg-rose-500"}`} />{status === "ACTIVE" ? "활성" : "정지"}</span>; }
