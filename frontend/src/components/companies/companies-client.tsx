"use client";

import ThreeDotLoader from "@/components/icons/three-dot-loader";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";

type Company = {
  id: number;
  code: string;
  name: string;
  businessRegistrationNumber: string | null;
  businessRegistrationUrl: string | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  createdAt: string;
  businessRegistrationUploadedAt: string | null;
  businessRegistrationVerifiedAt: string | null;
  siteCount: number;
  userCount: number;
  superAdminCount: number;
  pendingInvitationId: string | null;
  pendingAdminEmail: string | null;
  pendingInvitationExpiresAt: string | null;
};
type InvitationResult = { token: string; email: string; expiresAt: string; deliveryStatus: "SENT" | "FAILED" | "DISABLED" };
type CompanyCreated = { company: Company };
type SiteAssignment = { id: string; name: string | null; companyId: number | null; companyName: string | null };
type CompanyActivity = { id: number; action: string; actorName: string; createdAt: string };

const CARD = "rounded-xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(22,58,82,0.045)] dark:border-white/8 dark:bg-background-dark-card";
const INPUT = "w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm transition focus:border-sky-400 focus:bg-white dark:border-white/10 dark:bg-white/5";

export default function CompaniesClient() {
  const { session, isLoading } = useAuth();
  const [query, setQuery] = useState("");
  const companies = useQuery({
    queryKey: ["platform-companies"],
    queryFn: () => apiFetch<Company[]>("/platform/companies"),
    enabled: session?.role === "PLATFORM_ADMIN",
  });
  const rows = useMemo(() => companies.data ?? [], [companies.data]);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return keyword ? rows.filter((item) => `${item.name} ${item.code} ${item.businessRegistrationNumber ?? ""} ${item.pendingAdminEmail ?? ""}`.toLowerCase().includes(keyword)) : rows;
  }, [rows, query]);

  if (isLoading) return <Loading />;
  if (!session || session.role !== "PLATFORM_ADMIN") return <AccessDenied />;
  return <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-4 sm:py-7 lg:px-6">
    <header className="mb-6 rounded-2xl bg-[linear-gradient(120deg,#123b5d,#176083)] px-5 py-6 text-white shadow-[0_10px_28px_rgba(17,65,94,0.14)] sm:px-7">
      <p className="text-xs font-bold tracking-[0.16em] text-sky-200 uppercase">Platform</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">회사 관리</h1>
      <p className="mt-2 text-sm text-white/70">고객 회사를 등록하고 최초 최고관리자 가입까지 관리합니다.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip label="전체" value={rows.length} />
        <Chip label="활성" value={rows.filter((item) => item.status === "ACTIVE").length} />
        <Chip label="가입 대기" value={rows.filter((item) => item.status === "PENDING").length} />
        <Chip label="중지" value={rows.filter((item) => item.status === "SUSPENDED").length} />
      </div>
    </header>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(19rem,.75fr)_minmax(0,1.25fr)]">
      <CreateCompany />
      <section className="space-y-3">
        <div className="flex items-end justify-between px-1"><div><h2 className="text-lg font-extrabold">등록 회사</h2><p className="text-text-secondary mt-1 text-sm">회사 데이터는 서로 분리되며 최고관리자는 자기 회사만 관리합니다.</p></div><span className="text-text-secondary text-xs">{filtered.length}/{rows.length}개</span></div>
        <input type="search" className={INPUT} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="회사명·코드·사업자번호·관리자 이메일 검색" />
        {companies.isLoading ? <Loading /> : filtered.map((company) => <CompanyCard key={company.id} company={company} />)}
        {!companies.isLoading && filtered.length === 0 && <div className={`${CARD} p-8 text-center text-sm text-text-secondary`}>{rows.length === 0 ? "등록된 회사가 없습니다." : "검색 결과가 없습니다."}</div>}
      </section>
    </div>
    <SiteAssignments companies={rows} />
  </main>;
}

function SiteAssignments({ companies }: { companies: Company[] }) {
  const [query, setQuery] = useState("");
  const sites = useQuery({ queryKey: ["platform-sites"], queryFn: () => apiFetch<SiteAssignment[]>("/platform/companies/sites") });
  const filtered = (sites.data ?? []).filter((site) => `${site.id} ${site.name ?? ""} ${site.companyName ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className={`${CARD} mt-6 p-5 sm:p-6`}>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-extrabold">사업장 배정</h2><p className="text-text-secondary mt-1 text-sm">회사 간 이동 시 과거 측정 데이터도 새 회사에서 보입니다.</p></div><span className="text-text-secondary text-xs">미배정 {(sites.data ?? []).filter((site) => site.companyId === null).length}개</span></div>
    <input type="search" className={`${INPUT} mt-4`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="사업장 코드·이름·회사 검색" />
    {sites.isLoading ? <Loading /> : sites.isError ? <p className="mt-4 text-sm text-rose-600">사업장 목록을 불러오지 못했습니다.</p> : <div className="mt-4 grid gap-2 lg:grid-cols-2">{filtered.map((site) => <SiteAssignmentRow key={site.id} site={site} companies={companies} />)}</div>}
    {!sites.isLoading && !sites.isError && filtered.length === 0 && <p className="text-text-secondary mt-4 text-sm">검색 결과가 없습니다.</p>}
  </section>;
}

function SiteAssignmentRow({ site, companies }: { site: SiteAssignment; companies: Company[] }) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState(String(site.companyId ?? ""));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const moving = site.companyId !== null && target !== String(site.companyId);
  async function assign() {
    const company = companies.find((item) => String(item.id) === target);
    if (!company) return;
    if (moving && !window.confirm(`${site.name ?? site.id} 사업장을 ${site.companyName ?? "기존 회사"}에서 ${company.name}(으)로 이동할까요? 과거 측정 데이터도 새 회사에 보이고, 이전 회사의 사용자·초대·알림 수신자 배정은 해제됩니다.`)) return;
    setBusy(true); setMessage(null);
    try {
      await apiFetch(`/platform/companies/sites/${encodeURIComponent(site.id)}/assignment`, { method: "PATCH", body: JSON.stringify({ companyId: company.id, confirmHistoryTransfer: moving }) });
      setMessage("사업장을 배정했습니다.");
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["platform-sites"] }), queryClient.invalidateQueries({ queryKey: ["platform-companies"] }), queryClient.invalidateQueries({ queryKey: ["platform-company-activity"] })]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "사업장을 배정하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <div className="rounded-lg border border-slate-200/80 p-3 dark:border-white/10"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold">{site.name || site.id} <span className="text-text-secondary text-xs font-medium">{site.id}</span></p><p className="text-text-secondary mt-0.5 text-xs">현재: {site.companyName ?? "미배정"}</p></div><div className="flex gap-2"><select aria-label={`${site.id} 배정 회사`} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-white/10 dark:bg-background-dark-card" value={target} onChange={(event) => setTarget(event.target.value)}><option value="">회사 선택</option>{companies.filter((item) => item.status !== "SUSPENDED").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" disabled={busy || !target || target === String(site.companyId)} onClick={assign} className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{busy ? "처리 중…" : moving ? "이동" : "배정"}</button></div></div>{message && <p className="mt-2 text-xs font-semibold text-sky-700 dark:text-sky-300">{message}</p>}</div>;
}

function CreateCompany() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [number, setNumber] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) { setMessage("사업자등록증 파일을 선택해주세요."); return; }
    setSaving(true); setMessage(null);
    const body = new FormData();
    body.set("name", name); body.set("code", code); body.set("businessRegistrationNumber", number);
    body.set("adminName", adminName); body.set("adminEmail", adminEmail); body.set("businessRegistration", file);
    try {
      await apiFetch<CompanyCreated>("/platform/companies", { method: "POST", body });
      setMessage("회사를 등록했습니다. 사업자등록증을 확인한 뒤 최고관리자 초대를 발송해주세요.");
      setName(""); setCode(""); setNumber(""); setAdminName(""); setAdminEmail(""); setFile(null);
      const input = document.getElementById("registration-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await queryClient.invalidateQueries({ queryKey: ["platform-companies"] });
    } catch (error) { setMessage(error instanceof Error ? error.message : "회사를 만들지 못했습니다."); }
    finally { setSaving(false); }
  }

  return <form onSubmit={submit} className={`${CARD} sticky top-20 space-y-3 p-5 sm:p-6`}>
    <div><h2 className="text-lg font-extrabold">새 회사 등록</h2><p className="text-text-secondary mt-1 text-sm">등록증 확인 후 초대가 발송되고, 최고관리자가 가입하면 활성화됩니다.</p></div>
    <label className="text-text-secondary block text-xs font-bold">회사명<input className={`${INPUT} mt-1.5`} required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label className="text-text-secondary block text-xs font-bold">회사 코드<input className={`${INPUT} mt-1.5 uppercase`} required pattern="[A-Za-z0-9_-]{2,64}" placeholder="예: CUSTOMER_A" value={code} onChange={(event) => setCode(event.target.value)} /></label>
    <label className="text-text-secondary block text-xs font-bold">사업자등록번호<input className={`${INPUT} mt-1.5`} required inputMode="numeric" placeholder="000-00-00000" value={number} onChange={(event) => setNumber(event.target.value)} /></label>
    <label className="text-text-secondary block text-xs font-bold">최초 최고관리자 이름<input className={`${INPUT} mt-1.5`} required maxLength={80} value={adminName} onChange={(event) => setAdminName(event.target.value)} /></label>
    <label className="text-text-secondary block text-xs font-bold">최초 최고관리자 이메일<input className={`${INPUT} mt-1.5`} type="email" required value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} /></label>
    <label className="text-text-secondary block text-xs font-bold">사업자등록증 파일<input id="registration-file" className={`${INPUT} mt-1.5 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-sky-700`} type="file" required accept="application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><span className="mt-1 block font-medium">PDF, JPG, PNG · 최대 10MB</span></label>
    {message && <p className="rounded-lg bg-slate-50 p-3 text-xs font-semibold dark:bg-white/5">{message}</p>}
    <button type="submit" disabled={saving} className="bg-button-primary hover:bg-button-primary-hover w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? "등록 중…" : "회사 등록"}</button>
  </form>;
}

function CompanyCard({ company }: { company: Company }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [registrationNumber, setRegistrationNumber] = useState(company.businessRegistrationNumber ?? "");
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [companyName, setCompanyName] = useState(company.name);
  const history = useQuery({ queryKey: ["platform-company-activity", company.id], queryFn: () => apiFetch<CompanyActivity[]>(`/platform/companies/${company.id}/activity`), enabled: showHistory });
  const invitationExpired = company.pendingInvitationExpiresAt ? new Date(company.pendingInvitationExpiresAt).getTime() <= Date.now() : false;
  async function refresh() { await Promise.all([queryClient.invalidateQueries({ queryKey: ["platform-companies"] }), queryClient.invalidateQueries({ queryKey: ["platform-company-activity", company.id] })]); }
  async function resend() { setBusy(true); setMessage(null); try { const result = await apiFetch<InvitationResult>(`/platform/companies/${company.id}/invitation/resend`, { method: "POST" }); setLink(`${window.location.origin}/accept-invite?token=${encodeURIComponent(result.token)}`); setMessage(result.deliveryStatus === "SENT" ? "초대 이메일을 발송했습니다." : "수동 초대 링크를 생성했습니다."); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "초대하지 못했습니다."); } finally { setBusy(false); } }
  async function revoke() { if (!window.confirm("이 회사의 최고관리자 초대를 취소할까요? 기존 초대 링크는 사용할 수 없게 됩니다.")) return; setBusy(true); setMessage(null); try { await apiFetch(`/platform/companies/${company.id}/invitation`, { method: "DELETE" }); setLink(null); setMessage("초대를 취소했습니다. 다른 관리자를 초대할 수 있습니다."); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "초대를 취소하지 못했습니다."); } finally { setBusy(false); } }
  async function invite(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setMessage(null); try { const result = await apiFetch<InvitationResult>(`/platform/companies/${company.id}/invitation`, { method: "POST", body: JSON.stringify({ email: inviteEmail, name: inviteName }) }); setLink(`${window.location.origin}/accept-invite?token=${encodeURIComponent(result.token)}`); setMessage(result.deliveryStatus === "SENT" ? "새 최고관리자 초대를 발송했습니다." : "수동 초대 링크를 생성했습니다."); setInviteName(""); setInviteEmail(""); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "초대하지 못했습니다."); } finally { setBusy(false); } }
  async function verify() { setBusy(true); try { await apiFetch(`/platform/companies/${company.id}/business-registration/verify`, { method: "PATCH" }); setMessage("사업자등록증을 확인 처리했습니다."); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "확인 처리하지 못했습니다."); } finally { setBusy(false); } }
  async function status() { setBusy(true); try { const next = company.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"; await apiFetch(`/platform/companies/${company.id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) }); setMessage(next === "ACTIVE" ? "회사를 활성화했습니다." : "회사를 중지하고 모든 세션을 종료했습니다."); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "상태를 변경하지 못했습니다."); } finally { setBusy(false); } }
  async function updateName(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setMessage(null); try { await apiFetch(`/platform/companies/${company.id}/profile`, { method: "PATCH", body: JSON.stringify({ name: companyName }) }); setMessage("회사명을 수정했습니다."); setEditingName(false); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "회사명을 수정하지 못했습니다."); } finally { setBusy(false); } }
  async function openDocument() { setBusy(true); try { const blob = await apiFetchBlob(`/platform/companies/${company.id}/business-registration`); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); } catch (error) { setMessage(error instanceof Error ? error.message : "문서를 열지 못했습니다."); } finally { setBusy(false); } }
  async function uploadRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!registrationFile) { setMessage("사업자등록증 파일을 선택해주세요."); return; }
    setBusy(true); setMessage(null);
    const body = new FormData();
    body.set("businessRegistrationNumber", registrationNumber);
    body.set("businessRegistration", registrationFile);
    try {
      await apiFetch(`/platform/companies/${company.id}/business-registration`, { method: "POST", body });
      setMessage(company.businessRegistrationUrl ? "사업자등록증을 교체했습니다. 다시 확인해주세요." : "사업자등록증을 등록했습니다.");
      setRegistrationFile(null);
      const input = document.getElementById(`registration-file-${company.id}`) as HTMLInputElement | null;
      if (input) input.value = "";
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "사업자등록증을 등록하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <article className={`${CARD} p-5`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-extrabold">{company.name}</h3><Status status={company.status} /><button type="button" className="text-text-secondary text-xs font-bold underline" onClick={() => { setCompanyName(company.name); setEditingName(!editingName); }}>이름 수정</button></div><p className="text-text-secondary mt-1 text-xs">{company.code} · 사업자번호 {formatBusinessNumber(company.businessRegistrationNumber)}</p></div>{company.businessRegistrationUrl && <div className="flex gap-2"><button type="button" disabled={busy} onClick={openDocument} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">등록증 보기</button>{!company.businessRegistrationVerifiedAt && <button type="button" disabled={busy} onClick={verify} className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">확인 완료</button>}</div>}</div>
    {editingName && <form onSubmit={updateName} className="mt-3 flex gap-2"><input aria-label="회사명" className={INPUT} required maxLength={120} value={companyName} onChange={(event) => setCompanyName(event.target.value)} /><button type="submit" disabled={busy} className="shrink-0 rounded-lg bg-sky-700 px-3 text-xs font-bold text-white disabled:opacity-50">저장</button></form>}
    <dl className="mt-4 grid grid-cols-3 gap-2"><Metric label="사업장" value={company.siteCount} /><Metric label="사용자" value={company.userCount} /><Metric label="최고관리자" value={company.superAdminCount} danger={company.status !== "PENDING" && company.superAdminCount < 1} /></dl>
    <form onSubmit={uploadRegistration} className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end dark:bg-white/4">
      <label className="text-text-secondary text-[11px] font-bold">사업자등록번호<input className={`${INPUT} mt-1`} required inputMode="numeric" placeholder="000-00-00000" value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} /></label>
      <label className="text-text-secondary text-[11px] font-bold">등록증 파일 · 최대 10MB<input id={`registration-file-${company.id}`} className={`${INPUT} mt-1 py-2 file:mr-2 file:border-0 file:bg-transparent file:text-xs file:font-bold`} type="file" required accept="application/pdf,image/jpeg,image/png" onChange={(event) => setRegistrationFile(event.target.files?.[0] ?? null)} /></label>
      <button type="submit" disabled={busy} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5">{company.businessRegistrationUrl ? "등록증 교체" : "등록증 등록"}</button>
    </form>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/7"><div className="text-xs"><p className="font-bold">{!company.businessRegistrationUrl ? "등록증 미등록" : company.businessRegistrationVerifiedAt ? `등록증 확인 · ${formatDate(company.businessRegistrationVerifiedAt)}` : "등록증 확인 대기"}</p>{company.status === "PENDING" && company.pendingAdminEmail && <p className="text-text-secondary mt-1">최초 관리자: {company.pendingAdminEmail} · {invitationExpired ? "초대 기한 만료" : `초대 기한 ${formatDate(company.pendingInvitationExpiresAt)}`}</p>}{message && <p className="mt-1 font-semibold text-sky-700 dark:text-sky-300">{message}</p>}</div><div className="flex gap-2">{company.status === "PENDING" && company.businessRegistrationVerifiedAt && company.pendingInvitationId && <button type="button" disabled={busy} onClick={resend} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold dark:border-white/10">초대 발송·재발송</button>}{company.status === "PENDING" && company.pendingInvitationId && <button type="button" disabled={busy} onClick={revoke} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 dark:border-rose-900/40">초대 취소</button>}{company.status !== "PENDING" && company.code !== "PENTAWORKS" && <button type="button" disabled={busy} onClick={status} className={`rounded-lg px-3 py-2 text-xs font-bold ${company.status === "ACTIVE" ? "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"}`}>{company.status === "ACTIVE" ? "회사 중지" : "회사 활성화"}</button>}</div></div>
    {company.status === "PENDING" && company.businessRegistrationVerifiedAt && !company.pendingInvitationId && <form onSubmit={invite} className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end dark:bg-white/4"><label className="text-text-secondary text-[11px] font-bold">최고관리자 이름<input className={`${INPUT} mt-1`} required maxLength={80} value={inviteName} onChange={(event) => setInviteName(event.target.value)} /></label><label className="text-text-secondary text-[11px] font-bold">최고관리자 이메일<input className={`${INPUT} mt-1`} required type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></label><button type="submit" disabled={busy} className="rounded-lg bg-sky-700 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">새 관리자 초대</button></form>}
    {link && <div className="mt-3 rounded-lg bg-emerald-50/60 p-3 text-xs dark:bg-emerald-950/20"><textarea className={`${INPUT} min-h-16`} readOnly value={link} /><button type="button" className="mt-1 font-bold underline" onClick={() => navigator.clipboard.writeText(link)}>새 링크 복사</button></div>}
    <button type="button" className="text-text-secondary mt-3 text-xs font-bold underline underline-offset-2" onClick={() => setShowHistory(!showHistory)}>{showHistory ? "변경 이력 접기" : "변경 이력 보기"}</button>
    {showHistory && <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs dark:bg-white/4">{history.isLoading ? "이력을 불러오는 중…" : history.isError ? "이력을 불러오지 못했습니다." : history.data?.length ? <ul className="space-y-2">{history.data.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-x-3"><span className="font-semibold">{activityLabel(item.action)} · {item.actorName}</span><time className="text-text-secondary">{formatDate(item.createdAt)}</time></li>)}</ul> : "변경 이력이 없습니다."}</div>}
  </article>;
}

function activityLabel(action: string) { return ({ COMPANY_CREATED: "회사 등록", COMPANY_PROFILE_UPDATED: "회사명 수정", COMPANY_STATUS_CHANGED: "회사 상태 변경", BUSINESS_REGISTRATION_UPLOADED: "등록증 등록·교체", BUSINESS_REGISTRATION_VERIFIED: "등록증 확인", COMPANY_ADMIN_INVITED: "최고관리자 초대", COMPANY_ADMIN_INVITATION_RESENT: "최고관리자 초대 발송·재발송", COMPANY_ADMIN_INVITATION_REVOKED: "최고관리자 초대 취소", SITE_ASSIGNED: "사업장 배정", SITE_TRANSFERRED_OUT: "사업장 이전" } as Record<string, string>)[action] ?? action; }

function Status({ status }: { status: Company["status"] }) { const label = status === "ACTIVE" ? "활성" : status === "PENDING" ? "가입 대기" : "중지"; const style = status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : status === "PENDING" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"; return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${style}`}>{label}</span>; }
function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) { return <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-white/4"><dt className="text-text-secondary text-[11px] font-bold">{label}</dt><dd className={`mt-1 text-lg font-extrabold ${danger ? "text-rose-600" : ""}`}>{value}</dd></div>; }
function Chip({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs"><strong className="mr-1.5 text-base">{value}</strong>{label}</div>; }
function formatBusinessNumber(value: string | null) { return value?.replace(/^(\d{3})(\d{2})(\d{5})$/, "$1-$2-$3") ?? "-"; }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleString("ko-KR") : "-"; }
function Loading() { return <div className="flex min-h-48 items-center justify-center"><ThreeDotLoader size="xl" /></div>; }
function AccessDenied() { return <main className="mx-auto max-w-md p-8 text-center"><h1 className="text-xl font-bold">플랫폼 관리자만 접근할 수 있습니다.</h1><Link href="/" className="mt-4 inline-block underline">대시보드로 이동</Link></main>; }
