"use client";
import AlertSnooze from "./alert-snooze";

import { DEFAULT_ALERT_EVENT_FILTER, needsAcknowledgement, type AlertEventFilter } from "@/lib/alert-event-state";
import { averagePeriodMessage, previewAlertRange } from "@/lib/alert-range";
import HelpButton from "@/components/common/context-help";
import { ALERT_HELP } from "@/lib/alert-help";
import AlertSettingsMenu from "./alert-settings-menu";
import AlertSettingsTable from "./alert-settings-table";
import { AlertSection, AlertSwitch } from "./alert-controls";
import {useOperatingHours,nextMonitoringLabel} from "@/lib/site-operating-hours";
import SiteCoolingControl, {useCoolingTypes} from "./site-cooling-control";
import ManagementTabs from "@/components/common/management-tabs";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/provider/auth-provider";
import { ArrowBackIconMini } from "@/components/icons/arrow-back-icon";
import type { AlertEventSummary, AlertThreshold, SiteAlertSettings } from "@/lib/api";
import { formatMetricMeasurement, METRICS } from "@/lib/metrics";
import { alertSettingsPageUrl } from "@/lib/alert-settings-navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

type EditorPane = "metrics" | "missing" | "schedule";

function metricName(key: string, label?: string | null) {
  if (key === "hepres" && (!label || label === "He Pressure")) return "헬륨 압력 (He Pressure)";
  if (key === "heleve" && (!label || label === "He Level")) return "헬륨 잔량 (He Level)";
  return label || key;
}

const METRIC_DESCRIPTION = new Map(METRICS.map((metric) => [metric.key, metric.description]));

export default function BaselinesClient({
  entries,
  loadFailed = false,
  canEdit = false,
  canEditCompany = false,
  companyThresholds,
  onSaveCompany,
  onRestoreCompany,
  onSave,
  onToggleVisibility,
  onToggleAlerts,
  onAcknowledge,
  onAcknowledgeMany,
  onRetryDelivery,
}: {
  entries: SiteAlertSettings[];
  loadFailed?: boolean;
  canEdit?: boolean;
  canEditCompany?: boolean;
  companyThresholds: AlertThreshold[];
  onSaveCompany: (thresholds: AlertThreshold[]) => Promise<AlertThreshold[]>;
  onRestoreCompany: (siteId: string) => Promise<SiteAlertSettings>;
  onSave: (entry: SiteAlertSettings) => Promise<SiteAlertSettings>;
  onToggleVisibility: (siteId: string, visible: boolean) => Promise<void>;
  onToggleAlerts: (siteId: string, enabled: boolean) => Promise<void>;
  onAcknowledge: (eventId: number) => Promise<AlertEventSummary>;
  onAcknowledgeMany: (eventIds: number[]) => Promise<{ ok: boolean; count: number }>;
  onRetryDelivery: (eventId: number) => Promise<{ ok: boolean; eventId: number }>;

}) {
  type View = "sites" | "thresholds" | "events" | "settings";
  const [view, setView] = useState<View>("events");
  useEffect(() => {
    const sync = () => {
      const requested = new URLSearchParams(window.location.search).get("view");
      setView(requested === "thresholds" || requested === "sites" || requested === "settings" ? requested : "events");
    };
    sync(); window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  function navigateView(next: View) {
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.pushState(null, "", url);
    setView(next);
  }
  const hours=useOperatingHours();
  const router=useRouter();
  const {session:actor}=useAuth();
  const canManageHospital=["PLATFORM_ADMIN","SUPER_ADMIN","ADMIN"].includes(actor?.role??"");
  const [busySite, setBusySite] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [restoringSite, setRestoringSite] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SiteAlertSettings | null>(null);
  const [editorMetric, setEditorMetric] = useState<string | undefined>();
  const [editorPane, setEditorPane] = useState<EditorPane>();
  function openSettings(entry: SiteAlertSettings, metricKey?: string, pane?: EditorPane) {
    setEditorPane(pane);
    setEditorMetric(metricKey);
    setSelected(entry);
  }
  function openEventSettings(event: AlertEventSummary) {
    const entry = entries.find(item => item.siteid === event.siteId);
    if (entry) openSettings(entry, event.eventType === "METRIC_MISSING" ? undefined : event.metricKey, event.eventType === "METRIC_MISSING" ? "missing" : undefined);
  }
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return entries;
    return entries.filter((entry) =>
      entry.siteid.toLowerCase().includes(keyword) || (entry.name ?? "").toLowerCase().includes(keyword),
    );
  }, [entries, query]);
  const activeCount = useMemo(
    () => entries.reduce((count, entry) => count + (entry.alertsEnabled && entry.dashboardVisible ? entry.thresholds.filter((threshold) => threshold.active).length + entry.thresholds.filter(threshold => threshold.missingActive).length + (entry.noDataActive ? 1 : 0) + (entry.coldChillerActive ? 1 : 0) : 0), 0),
    [entries],
  );

  async function toggleVisibility(entry: SiteAlertSettings) {
    setBusySite(entry.siteid); setActionError(null);
    try { await onToggleVisibility(entry.siteid, !entry.dashboardVisible); }
    catch (error) { setActionError(error instanceof Error ? error.message : "표시 설정을 변경하지 못했습니다."); }
    finally { setBusySite(null); }
  }

  async function toggleAlerts(entry: SiteAlertSettings) {
    setBusySite(entry.siteid); setActionError(null);
    try { await onToggleAlerts(entry.siteid, !entry.alertsEnabled); }
    catch (error) { setActionError(error instanceof Error ? error.message : "알림 설정을 변경하지 못했습니다."); }
    finally { setBusySite(null); }
  }

  async function restoreCompany(entry: SiteAlertSettings) {
    if (!window.confirm(`${entry.name ?? entry.siteid}의 내 알림 설정을 초기 기준으로 되돌릴까요? 이 병원의 내 기준값이 바뀝니다. 회원 공통 수신 시간·반복 설정은 유지됩니다.`)) return;
    setRestoringSite(entry.siteid); setActionError(null);
    try { await onRestoreCompany(entry.siteid); }
    catch (error) { setActionError(error instanceof Error ? error.message : "회사 기준으로 복원하지 못했습니다."); }
    finally { setRestoringSite(null); }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <div className="mb-2 hidden lg:mb-3 lg:block">
        <Link href="/" className="text-text-secondary hover:bg-background-tertiary hover:text-text-major dark:text-text-dark-primary/70 dark:hover:bg-background-dark-secondary dark:hover:text-text-dark-primary inline-flex min-h-12 items-center gap-x-1.5 rounded-lg px-2 text-sm font-bold transition-colors">
          <ArrowBackIconMini className="h-4 w-4" /> 대시보드
        </Link>
      </div>

      <header className="mb-4 hidden py-2 lg:block">
        <h1 className="text-2xl font-extrabold tracking-tight">알림</h1>
      </header>
      <ManagementTabs large label="알림" value={view === "events" ? "events" : "settings"} onChange={navigateView} items={[
        {value:"events",label:"도착한 알림"},
        {value:"settings",label:"알림 설정"},
      ]} />
      {view !== "events" && view !== "settings" && <div className="mb-5">
        <button type="button" onClick={() => navigateView("settings")} className="mb-2 inline-flex min-h-12 items-center rounded-lg px-2 text-base font-bold text-sky-800 hover:bg-sky-50 dark:text-sky-200 dark:hover:bg-sky-950/30">← 알림 설정 메뉴</button>
        <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-extrabold">{view === "sites" ? "병원 운영시간·표시" : "병원별 알림 기준"}</h2><span className="lg:hidden"><HelpButton title={view === "sites" ? "병원 운영시간·표시" : "병원별 알림 기준"} message={view === "sites" ? "병원을 찾은 뒤 원하는 항목을 바꾸세요. 운영시간과 냉각 방식은 모든 담당자에게 적용됩니다." : "병원을 검색하고 변경할 기준값을 누르세요. 변경한 알림 기준은 내 계정에만 적용됩니다."}/></span></div>
        <p className="mt-2 hidden text-base leading-7 text-text-secondary lg:block">{view === "sites" ? "설정할 병원을 찾은 뒤 원하는 항목을 바꾸세요." : "병원을 찾은 뒤 바꾸려는 항목의 기준값을 눌러주세요. 내 계정에만 적용됩니다."}</p>
      </div>}

      {view === "settings" ? <AlertSettingsMenu canManageHospital={canManageHospital} onSelect={navigateView} /> : view === "sites" ? <section className="space-y-3">
        <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4 text-sm text-sky-900 dark:border-sky-900/40 dark:bg-background-dark-secondary dark:text-sky-100">
          <div className="flex items-center justify-between"><p className="font-bold">병원 표시 · 알림 켜기/끄기</p><HelpButton title="병원 표시와 운영시간" message="표시를 끄면 대시보드에서 사라지고 이 병원의 알림 발송도 중지됩니다. 운영시간은 모든 담당자에게 공통 적용됩니다."/></div>
          <p className="mt-1 hidden text-sm opacity-75 lg:block">표시를 끄면 대시보드에서 사라지고 이 병원의 알림 발송도 중지됩니다. 상세 설정에서 정한 운영 시간은 모든 담당자에게 공통 적용됩니다.</p>
        </div>
        {actionError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{actionError}</p>}
        {loadFailed && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">병원 설정을 불러오지 못했습니다.</p>}
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="병원 이름 또는 코드 검색" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400 dark:border-white/10 dark:bg-background-dark-card" />
        <div className="space-y-2">{filtered.map((entry) => <article key={entry.siteid} className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(22,58,82,0.035)] lg:flex-row lg:items-center dark:border-white/8 dark:bg-background-dark-card">
          <div className="min-w-0 flex-1"><h2 className="truncate font-bold">{entry.name ?? "이름 없는 병원"}</h2><p className="text-text-secondary mt-0.5 text-sm">{entry.siteid} · {entry.dashboardVisible ? (entry.alertsEnabled ? "대시보드 표시 · 알림 켜짐" : "대시보드 표시 · 알림 꺼짐") : "대시보드 숨김 · 알림 불가"}</p>{hours.data?.[entry.siteid]?.status.enabled && <p className="mt-1 text-xs text-sky-800 dark:text-sky-200">공통 운영 시간 · {hours.data[entry.siteid].status.label}{hours.data[entry.siteid].status.nextMonitoringAt?` · 다음 감시 ${nextMonitoringLabel(hours.data[entry.siteid].status.nextMonitoringAt)}`:""}</p>}</div>
          <SiteCoolingControl siteId={entry.siteid} name={entry.name ?? entry.siteid}/>
          <div className="grid w-full shrink-0 grid-cols-2 gap-2 lg:w-96">
            {canEditCompany && <button type="button" disabled={busySite === entry.siteid} onClick={() => toggleVisibility(entry)} className={`min-h-11 cursor-pointer whitespace-nowrap rounded-lg px-2 text-sm font-bold transition disabled:opacity-50 ${entry.dashboardVisible ? "bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-sky-950/50 dark:text-sky-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/7 dark:text-white/70"}`} aria-label={`${entry.name ?? entry.siteid} 대시보드 ${entry.dashboardVisible ? "숨기기" : "표시하기"}`}><span>화면에 </span>{entry.dashboardVisible ? "표시 중" : "숨김"}</button>}
            {canEdit && <button type="button" disabled={busySite === entry.siteid || !entry.dashboardVisible} onClick={() => toggleAlerts(entry)} className={`min-h-11 cursor-pointer whitespace-nowrap rounded-lg px-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${entry.alertsEnabled && entry.dashboardVisible ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/7 dark:text-white/70"}`}>{entry.alertsEnabled && entry.dashboardVisible ? "알림 켜짐" : "알림 꺼짐"}</button>}
            <button type="button" onClick={() => router.push(`/hospital-settings/${encodeURIComponent(entry.siteid)}`)} className="col-span-2 min-h-12 cursor-pointer rounded-lg border border-slate-200 px-3 text-base font-bold text-sky-700 transition hover:bg-sky-50 dark:border-white/10 dark:text-sky-200">병원 운영시간 변경 →</button>
          </div>
        </article>)}</div>
        {filtered.length === 0 && <EmptyState />}
      </section> : view === "thresholds" ? <>

      {loadFailed && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">기준값을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>}
      {actionError && <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{actionError}</p>}

      <div className="mb-3 flex flex-col gap-2 lg:mb-5 lg:flex-row lg:flex-wrap lg:items-end lg:gap-3">
        <label className="w-full min-w-0 flex-1 text-base font-bold">병원 찾기<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="병원 이름을 입력하세요" className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base dark:border-white/20 dark:bg-background-dark-card" /></label>
        <p className="text-sm text-text-secondary lg:pb-3 lg:text-base">{filtered.length}개 병원<span className="hidden lg:inline"> · {activeCount}개 알림 사용</span></p>
      </div>
      
      {filtered.length === 0 ? <EmptyState /> : <AlertSettingsTable entries={filtered} canEdit={canEdit} busySite={busySite} onToggle={toggleAlerts} onOpen={openSettings} actions={entry=>canEdit && entry.configured ? <button type="button" disabled={restoringSite===entry.siteid} onClick={()=>restoreCompany(entry)} className="mt-2 min-h-12 rounded-lg border px-3 text-base dark:border-white/15">처음 설정으로</button> : null} />}

      {canEditCompany && <div className="mt-8"><CompanyThresholdEditor thresholds={companyThresholds} canEdit={canEditCompany} onSave={onSaveCompany} /></div>}

      </> : <AlertEventsPanel onOpenSettings={openEventSettings} availableSites={entries} onAcknowledge={onAcknowledge} onAcknowledgeMany={onAcknowledgeMany} onRetryDelivery={onRetryDelivery} />}

      {selected && <SiteThresholdEditor entry={entries.find(entry => entry.siteid === selected.siteid) ?? selected} initialMetricKey={editorMetric} initialPane={editorPane} onlyMetricKey={selected.thresholds.some(item => item.key === editorMetric) ? editorMetric : undefined} canEdit={canEdit} onClose={() => setSelected(null)} onSave={async (entry) => { const saved = await onSave(entry); setSelected(saved); return saved; }} />}
    </main>
  );
}

function CompanyThresholdEditor({ thresholds, canEdit, onSave }: {
  thresholds: AlertThreshold[];
  canEdit: boolean;
  onSave: (thresholds: AlertThreshold[]) => Promise<AlertThreshold[]>;
}) {
  const [draft, setDraft] = useState<AlertThreshold[]>(thresholds);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setDraft(thresholds), [thresholds]);
  async function save() {
    for (const row of draft) {
      if (!Number.isFinite(row.min) || !Number.isFinite(row.max) || row.min < 0 || row.min > row.max) {
        setError(`${row.label}: 최소·최대값을 확인해주세요.`); return;
      }
    }
    setSaving(true); setError(null);
    try { await onSave(draft); setOpen(false); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "회사 기준을 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }
  if (thresholds.length === 0) return null;
  return <section className="mb-4 rounded-xl border border-sky-200/80 bg-sky-50/50 p-4 dark:border-sky-900/40 dark:bg-sky-950/15">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-extrabold">신규 사용자의 초기 기준</h2><p className="text-text-secondary mt-1 text-sm">개인 설정을 처음 만들 때 참고하는 기준입니다. 이미 만들어진 다른 사용자의 설정은 변경되지 않습니다.</p></div><button type="button" onClick={() => setOpen(!open)} className="min-h-10 cursor-pointer rounded-lg border border-sky-200 bg-white px-4 text-sm font-bold text-sky-700 hover:bg-sky-50 dark:border-sky-900/50 dark:bg-background-dark-card dark:text-sky-200">{open ? "접기" : "회사 기준 보기"}</button></div>
    {open && <><div className="mt-4 grid gap-3 md:grid-cols-2">{draft.map((threshold) => <MetricEditor key={threshold.key} threshold={threshold} disabled={!canEdit || saving} onChange={(patch) => setDraft((current) => current.map((item) => item.key === threshold.key ? { ...item, ...patch } : item))} />)}</div>{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}{canEdit && <div className="mt-4 flex justify-end"><button type="button" disabled={saving || draft.length === 0} onClick={save} className="bg-button-primary min-h-11 cursor-pointer rounded-lg px-5 text-sm font-bold text-white disabled:opacity-50">{saving ? "저장 중…" : "회사 기준 저장"}</button></div>}</>}
  </section>;
}

function AlertEventsPanel({ onAcknowledge, onAcknowledgeMany, onRetryDelivery, onOpenSettings, availableSites }: {
  onOpenSettings: (event: AlertEventSummary) => void;
  availableSites: Pick<SiteAlertSettings, "siteid" | "name">[];
  onAcknowledge: (eventId: number) => Promise<AlertEventSummary>;
  onAcknowledgeMany: (eventIds: number[]) => Promise<{ ok: boolean; count: number }>;
  onRetryDelivery: (eventId: number) => Promise<{ ok: boolean; eventId: number }>;
}) {
  const [filter, setFilter] = useState<AlertEventFilter>(DEFAULT_ALERT_EVENT_FILTER);
  const [selecting, setSelecting] = useState(false);
  const [page, setPage] = useState(1);

  const [query, setQuery] = useState("");
  const [siteId, setSiteId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [kind, setKind] = useState("all");
  useEffect(() => setPage(1), [filter, query, siteId, fromDate, toDate, kind]);
  const [selected, setSelected] = useState<number[]>([]);
  const [acknowledging, setAcknowledging] = useState<number | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sites = availableSites.map(site => [site.siteid, site.name ?? site.siteid]);
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState(query);
  useEffect(() => { const timer = setTimeout(() => setSearchQuery(query), 300); return () => clearTimeout(timer); }, [query]);
  const params = new URLSearchParams({ page: String(page), size: "20", query: searchQuery, siteId, status: filter, kind });
  if (fromDate) params.set("from", new Date(`${fromDate}T00:00:00`).toISOString());
  if (toDate) params.set("to", new Date(`${toDate}T23:59:59.999`).toISOString());
  const history = useQuery({ queryKey: ["alert-events", "search", session?.id, params.toString()], queryFn: () => apiFetch<{events: AlertEventSummary[]; total: number}>(`/alerts/events/search?${params}`), enabled: Boolean(session), refetchInterval: 60_000 });
  const filtered = history.data?.events ?? [];
  const total = history.data?.total ?? 0;
  const failed = history.isError;
  const selectableIds = filtered.filter(needsAcknowledgement).map(event => event.id);
  const selectedIds = selected.filter(id => selectableIds.includes(id));
  const currentPage = page;
  const busy = bulkSaving || acknowledging !== null || retrying !== null;

  async function acknowledge(eventId: number) {
    if (!window.confirm("이 알림을 확인했나요? 확인하면 나에게 오는 반복 알림이 멈춥니다. 문제가 해결됐다는 뜻은 아닙니다.")) return;
    setAcknowledging(eventId); setError(null);
    try { await onAcknowledge(eventId); await history.refetch(); }
    catch (ackError) { setError(ackError instanceof Error ? ackError.message : "알림을 확인 처리하지 못했습니다."); }
    finally { setAcknowledging(null); }
  }

  async function acknowledgeSelected(ids: number[]) {
    if (ids.length === 0) return;
    if (!window.confirm(`${ids.length}건을 확인했나요? 확인하면 나에게 오는 반복 알림이 멈춥니다. 문제가 해결됐다는 뜻은 아닙니다.`)) return;
    setBulkSaving(true); setError(null);
    try { await onAcknowledgeMany(ids); await history.refetch(); setSelected((current) => current.filter((id) => !ids.includes(id))); }
    catch (ackError) { setError(ackError instanceof Error ? ackError.message : "알림을 일괄 확인 처리하지 못했습니다."); }
    finally { setBulkSaving(false); }
  }

  async function retry(eventId: number) {
    if (!window.confirm("발송에 실패한 수신처에 다시 전송할까요? 확인완료한 담당자는 제외됩니다.")) return;
    setRetrying(eventId); setError(null);
    try { await onRetryDelivery(eventId); await history.refetch(); }
    catch (retryError) { setError(retryError instanceof Error ? retryError.message : "알림을 재전송하지 못했습니다."); }
    finally { setRetrying(null); }
  }


  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="hidden lg:block"><h2 className="text-2xl font-bold">확인할 알림</h2><p className="text-text-secondary mt-1 text-sm">병원과 문제 내용을 확인하세요. ‘확인했어요’를 누르면 나에게 오는 반복 알림이 멈춥니다.</p></div>
        <div className="flex w-full max-w-full overflow-x-auto rounded-xl bg-slate-100 p-1 lg:w-auto dark:bg-white/5">{(["unacknowledged", "open", "all"] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`min-h-11 flex-1 shrink-0 whitespace-nowrap rounded-lg px-2 py-2 text-sm font-bold transition ${filter === value ? "bg-white text-sky-700 shadow-sm dark:bg-sky-800 dark:text-white" : "text-slate-500 dark:text-white/55"}`}>{value === "all" ? "전체 기록" : value === "open" ? "문제 지속" : value === "unacknowledged" ? "확인할 알림" : value === "failed" ? "전송 확인 필요" : value === "skipped" ? "미발송" : "미발송"}</button>)}</div>
      </div>
      <details className="mb-3 rounded-xl border border-slate-200 bg-white px-3 dark:border-white/15 dark:bg-background-dark-card">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">검색 · 필터{(query || siteId || fromDate || toDate || kind !== "all") ? " · 적용 중" : ""}</summary>
        <div className="grid min-w-0 gap-3 pb-3 lg:grid-cols-2">
        <label className="text-base font-bold">병원 찾기<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="병원 이름이나 알림 내용을 입력하세요" className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-white/20 dark:bg-white/5" /></label>
        <label className="text-base font-bold">어떤 문제인가요?<select value={kind} onChange={event => setKind(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-white/20 dark:bg-white/5"><option value="all">모든 문제</option><option value="range">수치 이상</option><option value="site">병원 전체 수집 중단</option><option value="missing">측정항목 누락</option><option value="chiller">콜드칠러 정지 의심</option></select></label>
        <details className="lg:col-span-2"><summary className="min-h-12 cursor-pointer py-3 text-base font-semibold text-sky-800 dark:text-sky-300">기간 · 병원 · 발송 상태로 찾기</summary><div className="mt-2 grid gap-3 lg:grid-cols-2"><label className="text-base font-bold">병원<select value={siteId} onChange={event => setSiteId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3 dark:border-white/20 dark:bg-background-dark-card"><option value="">모든 병원</option>{sites.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label><label className="text-base font-bold">발송 상태<select value={filter} onChange={event => setFilter(event.target.value as AlertEventFilter)} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3 dark:border-white/20 dark:bg-background-dark-card"><option value="unacknowledged">확인할 알림</option><option value="open">문제 지속</option><option value="all">전체 기록</option><option value="failed">발송 확인 필요</option><option value="skipped">발송 안 됨</option></select></label><label className="text-base font-bold">시작일<input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3 dark:border-white/20 dark:bg-background-dark-card" /></label><label className="text-base font-bold">종료일<input type="date" value={toDate} onChange={event => setToDate(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3 dark:border-white/20 dark:bg-background-dark-card" /></label></div></details>
        </div>
      </details>
      <div className="mb-3 flex min-h-11 flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{total}건</span>
        <HelpButton title="알림 확인" message="확인했어요를 누르면 나에게 오는 반복 알림이 멈춥니다. 문제가 해결됐다는 뜻은 아닙니다. 종료되거나 확인한 알림은 전체 기록에서 볼 수 있습니다."/>
        <button type="button" aria-pressed={selecting} onClick={() => { setSelecting(!selecting); setSelected([]); }} className="ml-auto min-h-11 px-3 text-sm font-semibold text-sky-700 dark:text-sky-300">{selecting ? "선택 취소" : "여러 개 확인"}</button>
        {selecting && <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100 px-3 dark:bg-white/5">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" checked={selectableIds.length > 0 && selectableIds.every(id => selected.includes(id))} onChange={event => setSelected(event.target.checked ? selectableIds : [])} className="h-5 w-5 accent-sky-700"/>이 페이지 선택</label>
          <button type="button" disabled={busy || selectedIds.length === 0} onClick={() => acknowledgeSelected(selectedIds)} className="min-h-11 rounded-lg px-3 text-sm font-bold text-sky-700 disabled:opacity-40 dark:text-sky-300">{selectedIds.length}건 확인</button>
        </div>}
      </div>
      {history.isFetching && <p role="status" className="mb-3 text-sm">알림 이력을 불러오는 중…</p>}
      {failed && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">알림 이력을 불러오지 못했습니다. <button type="button" onClick={() => history.refetch()} className="min-h-11 underline">다시 시도</button></p>}
      {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {!history.isPending && filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center dark:border-white/20 dark:bg-background-dark-card"><p className="text-xl font-bold">{failed ? "알림을 불러오지 못했습니다" : filter === "unacknowledged" && !query && kind === "all" ? "확인할 알림이 없습니다" : "조건에 맞는 알림이 없습니다"}</p><p className="mt-3 text-base text-text-secondary">{failed ? "잠시 후 다시 시도해주세요." : "위의 ‘알림 설정’에서 병원별 기준이나 알림 받는 시간을 바꿀 수 있습니다."}</p></div> : <div className="space-y-4">{filtered.map((event) => <AlertEventRow key={event.id} selecting={selecting} event={event} selected={selected.includes(event.id)} onSelect={(checked) => setSelected((current) => checked ? Array.from(new Set([...current, event.id])) : current.filter((id) => id !== event.id))} acknowledging={busy} retrying={busy} onAcknowledge={() => acknowledge(event.id)} onRetry={() => retry(event.id)} onOpenSettings={() => onOpenSettings(event)} settingsAvailable={availableSites.some(site => site.siteid === event.siteId)} />)}</div>}
      {(total > 20 || currentPage > 1) && <div className="mt-4 flex items-center justify-center gap-4"><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="min-h-11 rounded-lg border px-4 disabled:opacity-30">이전</button><span className="text-sm">{currentPage} / {Math.max(1, Math.ceil(total / 20))}</span><button type="button" disabled={history.isFetching || currentPage * 20 >= total} onClick={() => setPage(currentPage + 1)} className="min-h-11 rounded-lg border px-4 disabled:opacity-30">다음</button></div>}
    </section>
  );
}

function AlertEventRow({
  event,
  selecting,
  selected,
  onSelect,
  acknowledging,
  retrying,
  onAcknowledge,
  onRetry,
  onOpenSettings,
  settingsAvailable,
}: {
  event: AlertEventSummary;
  selecting: boolean;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  acknowledging: boolean;
  retrying: boolean;
  onAcknowledge: () => void;
  onRetry: () => void;
  onOpenSettings: () => void;
  settingsAvailable: boolean;
}) {
  const { isAdmin } = useAuth();
  const [showDelivery, setShowDelivery] = useState(false);
  const queryClient = useQueryClient();
  const [resolving, setResolving] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState("");
  async function confirmDelivery(resultId: number, received: boolean) {
    if (
      !window.confirm(
        received
          ? "해당 수신처에 알림이 도착한 것을 확인했나요?"
          : "해당 수신처에 알림이 도착하지 않은 것을 확인했나요? 이후 재시도할 수 있습니다.",
      )
    )
      return;
    setResolving(true);
    setDeliveryMessage("");
    try {
      await apiFetch(`/alerts/events/${event.id}/deliveries/${resultId}`, {
        method: "PATCH",
        body: JSON.stringify({ received }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["alert-events"] }),
        queryClient.invalidateQueries({
          queryKey: ["alert-deliveries", event.id],
        }),
      ]);
    } catch (error) {
      setDeliveryMessage(
        error instanceof Error ? error.message : "처리하지 못했습니다.",
      );
    } finally {
      setResolving(false);
    }
  }
  const results = useQuery({
    queryKey: [
      "alert-deliveries",
      event.id,
      event.deliveryStatus,
      event.notificationCount,
    ],
    queryFn: () =>
      apiFetch<
        {
          id: number;
          recipientLabel: string;
          status: AlertEventSummary["deliveryStatus"];
          attemptCount: number;
          errorMessage: string | null;
          startedAt: string | null;
          currentBatch: boolean;
          providerSendStatus: number | null;
          providerResultCode: number | null;
          providerResultMessage: string | null;
          smsSendState: string | null;
          providerCheckedAt: string | null;
        }[]
      >(`/alerts/events/${event.id}/deliveries`),
    enabled: showDelivery,
    refetchInterval: showDelivery ? 30000 : false,
  });
  const recovered = event.eventType === "RECOVERY" || !!event.recoveredAt;
  const metric = METRICS.find((item) => item.key === event.metricKey);
  const isNoData = event.metricKey === "__data__";
  const isMetricMissing = event.eventType === "METRIC_MISSING";
  const isColdChiller = event.metricKey === "__cold_chiller__";
  const simpleMetricName = metricName(event.metricKey, metric?.label).replace(/\s*\([^)]*\)/g, "");
  const issue = isNoData
    ? "장비 데이터가 들어오지 않아요"
    : isColdChiller
      ? "냉각장치 정지가 의심돼요"
      : isMetricMissing
        ? `${simpleMetricName} 값이 들어오지 않아요`
        : `${simpleMetricName} · 기준보다 ${event.eventType === "LOW" ? "낮아요" : "높아요"}`;
  const value = isNoData
    ? event.measuredValue == null
      ? "수집 기록 없음"
      : `${formatValue(event.measuredValue, "분")}째 중단`
    : isMetricMissing
      ? `${formatValue(event.measuredValue, "회")} 연속 누락`
      : formatMetricMeasurement(event.measuredValue, metric?.unit);
  const reference = isNoData
    ? `${formatValue(event.max, "분")}부터 알림`
    : isMetricMissing
      ? `${formatValue(event.max, "회")}부터 알림`
      : isColdChiller
        ? "IN·OUT 온도 차이 0.1°C 이하"
        : `설정 범위 ${formatValue(event.min, metric?.unit)} ~ ${formatValue(event.max, metric?.unit)}`;
  return (
    <article
      className={`received-alert ${recovered ? "is-recovered" : "is-active"}`}
    >
      <div className="received-alert-top">
        {selecting && (
          <input
            type="checkbox"
            aria-label={`${event.siteName ?? event.siteId} 알림 선택`}
            checked={selected}
            disabled={!needsAcknowledgement(event) || acknowledging}
            onChange={(e) => onSelect(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-sky-700"
          />
        )}
        <h3>{event.siteName ?? event.siteId}</h3>
        <span className="received-alert-state">
          {recovered ? "정상 복구" : "문제 지속"}
        </span>
      </div>
      <p className="received-alert-issue">{issue}</p>
      <div className="received-alert-reading">
        <strong>{value}</strong>
        <span>{reference}</span>
      </div>
      <div className="received-alert-time">
        <time dateTime={event.occurredAt}>
          {new Date(event.occurredAt).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          발생
        </time>
        {event.acknowledgedAt && <span>✓ 확인한 알림</span>}
      </div>
      <div className="received-alert-actions">
        {!event.acknowledgedAt && (
          <button
            type="button"
            disabled={acknowledging}
            onClick={onAcknowledge}
            className="received-alert-confirm"
          >
            {acknowledging ? "처리 중…" : "확인했어요"}
          </button>
        )}
        <button
          type="button"
          aria-expanded={showDelivery}
          onClick={() => setShowDelivery(!showDelivery)}
          className="received-alert-more"
        >
          {showDelivery ? "접기 ↑" : "자세히 · 관리 ›"}
        </button>
      </div>
      {showDelivery && (
        <div className="received-alert-manage">
          <div className="flex items-center justify-between">
            <strong className="text-base">알림 관리</strong>
            <HelpButton
              title="확인과 잠시 중지"
              message="확인했어요는 현재 문제의 반복 알림을 끝냅니다. 정상 복구 후 다시 발생하면 새 알림을 받습니다. 시간 지정 중지는 그 시간까지 같은 병원·항목·유형의 알림을 받지 않는 기능입니다."
            />
          </div>
          {!recovered && <AlertSnooze event={event} />}
          <button
            type="button"
            disabled={!settingsAvailable}
            onClick={onOpenSettings}
            className="mt-3 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base font-bold text-sky-800 disabled:opacity-40 dark:border-slate-600 dark:text-sky-200"
          >
            이 알림 기준 바꾸기
          </button>
          {event.recoveredAt && (
            <p className="mt-3 text-sm">
              복구 {new Date(event.recoveredAt).toLocaleString("ko-KR")}
            </p>
          )}
          <p className="mt-3 text-sm">
            발송 상태: {deliveryLabel(event.deliveryStatus)}
          </p>
          {isAdmin &&
            !recovered &&
            ["FAILED", "PARTIAL", "SKIPPED"].includes(event.deliveryStatus) && (
              <button
                type="button"
                disabled={retrying}
                onClick={onRetry}
                className="mt-2 min-h-11 rounded-lg border px-3 font-bold"
              >
                {retrying ? "재전송 중…" : "전송 재시도"}
              </button>
            )}
          {event.deliveryError && (
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
              {event.deliveryError}
            </p>
          )}
        </div>
      )}
      {showDelivery && (
        <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-white/5">
          <p className="mb-3 text-base leading-7">{event.message}</p>
          {event.deliveryError && (
            <p className="text-amber-700 lg:hidden dark:text-amber-300">
              {event.deliveryError}
            </p>
          )}
          {results.isLoading ? (
            <p>불러오는 중…</p>
          ) : results.isError ? (
            <button
              type="button"
              onClick={() => results.refetch()}
            >
              결과를 불러오지 못했습니다. 다시 시도
            </button>
          ) : !results.data?.length ? (
            <p>
              기록된 수신처별 결과가 없습니다. 이전 발송 또는 미발송 건일 수
              있습니다.
            </p>
          ) : (
            results.data.map((result) => (
              <div
                key={result.id}
                className="space-y-1"
              >
                <p className="font-semibold">
                  {result.recipientLabel} · {deliveryLabel(result.status)} ·
                  시도 {result.attemptCount}회
                </p>
                {result.providerCheckedAt && (
                  <p className="text-text-secondary">
                    {result.providerSendStatus === 1
                      ? "알림톡 전송 성공"
                      : result.providerSendStatus === 2
                        ? "알림톡 실패"
                        : result.providerSendStatus === 0
                          ? "알림톡 전송 중"
                          : "바로빌 상태 확인 필요"}
                    {result.smsSendState
                      ? ` · 대체문자: ${result.smsSendState}`
                      : ""}{" "}
                    · 확인{" "}
                    {new Date(result.providerCheckedAt).toLocaleString("ko-KR")}
                  </p>
                )}
                {result.providerResultMessage &&
                  result.providerSendStatus !== 1 && (
                    <p className="text-amber-700 dark:text-amber-300">
                      {result.providerResultMessage}
                    </p>
                  )}
                {result.startedAt && (
                  <p className="text-text-secondary">
                    {new Date(result.startedAt).toLocaleString("ko-KR")}
                  </p>
                )}
                {result.errorMessage && (
                  <p className="text-amber-700 dark:text-amber-300">
                    {result.errorMessage}
                  </p>
                )}
                {isAdmin &&
                  result.currentBatch &&
                  event.deliveryStatus === "UNKNOWN" &&
                  result.status === "UNKNOWN" && (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        disabled={resolving}
                        onClick={() => confirmDelivery(result.id, true)}
                        className="min-h-10 cursor-pointer font-semibold text-sky-700 dark:text-sky-300"
                      >
                        수신 확인
                      </button>
                      <button
                        type="button"
                        disabled={resolving}
                        onClick={() => confirmDelivery(result.id, false)}
                        className="min-h-10 cursor-pointer font-semibold text-rose-600"
                      >
                        미수신 확인
                      </button>
                    </div>
                  )}
              </div>
            ))
          )}
          {deliveryMessage && <p role="alert">{deliveryMessage}</p>}
        </div>
      )}
    </article>
  );
}

function EventBadge({ type }: { type: AlertEventSummary["eventType"] | "COLD_CHILLER" }) {
  const style = type === "RECOVERY" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : type === "LOW" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300";
  return <span className={`shrink-0 rounded-lg px-2 py-1 text-sm font-extrabold ${style}`}>{type === "COLD_CHILLER" ? "정지 의심" : type === "RECOVERY" ? "복구" : type === "LOW" ? "수치 낮음" : type === "METRIC_MISSING" ? "항목 누락" : type === "NO_DATA" ? "병원 수집 중단" : "수치 높음"}</span>;
}

function formatValue(value: number | null, unit?: string | null) { return value == null ? "-" : `${Number(value.toFixed(2))}${unit ? ` ${unit}` : ""}`; }
function deliveryLabel(status: AlertEventSummary["deliveryStatus"]) { return ({ PENDING: "대기", SENDING: "전송 중", SENT: "접수 완료", PARTIAL: "일부 접수 실패", FAILED: "접수 실패", SKIPPED: "미발송", UNKNOWN: "결과 확인 필요" } as const)[status] ?? status; }

export function SiteThresholdEditor({ page = false, entry, canEdit, initialMetricKey, initialPane, onlyMetricKey, onClose, onSave }: {
  page?: boolean;
  entry: SiteAlertSettings;
  canEdit: boolean;
  initialMetricKey?: string;
  initialPane?: EditorPane;
  onlyMetricKey?: string;
  onClose: () => void;
  onSave: (entry: SiteAlertSettings) => Promise<SiteAlertSettings>;
}) {
  const router = useRouter();
  const cooling = useCoolingTypes();
  const airCooled = cooling.data?.[entry.siteid] === true;
  const [smallScreen, setSmallScreen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setSmallScreen(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (page || !smallScreen) return;
    router.push(alertSettingsPageUrl(entry.siteid, window.location.pathname, {metric:initialMetricKey, pane:initialPane, only:onlyMetricKey}));
  }, [page, smallScreen, router, entry.siteid, initialMetricKey, initialPane, onlyMetricKey]);
  const [thresholds, setThresholds] = useState(() => onlyMetricKey ? entry.thresholds.filter(item => item.key === onlyMetricKey) : entry.thresholds);
  const [metricFilter, setMetricFilter] = useState<"active" | "all">(initialMetricKey && !initialMetricKey.startsWith("__") ? "all" : entry.thresholds.some(item => item.active) ? "active" : "all");
  const [pane, setPane] = useState<EditorPane>(initialPane ?? (initialMetricKey === "__data__" ? "missing" : "metrics"));
  const [collectionIntervalMinutes, setCollectionIntervalMinutes] = useState(entry.collectionIntervalMinutes ?? 10);
  const [missingCollectionThreshold, setMissingCollectionThreshold] = useState(entry.missingCollectionThreshold ?? 2);
  const noDataMinutes = collectionIntervalMinutes * missingCollectionThreshold;
  const [noDataActive, setNoDataActive] = useState(entry.noDataActive);
  const [coldChillerActive, setColdChillerActive] = useState(entry.coldChillerActive);
  const [alertsEnabled, setAlertsEnabled] = useState(entry.alertsEnabled);
  const [triggerAfterMinutes, setTriggerAfterMinutes] = useState(entry.triggerAfterMinutes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogForm = useRef<HTMLFormElement>(null);
  const dialogState = useRef({ saving, onClose });
  dialogState.current = { saving, onClose };
  useEffect(() => {
    if (page || window.matchMedia("(max-width: 1023px)").matches) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogForm.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !dialogState.current.saving) dialogState.current.onClose();
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogForm.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex="0"]') ?? []).filter(node => node.getClientRects().length > 0);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [page]);

  // Refresh the stored hourly snapshot without overwriting unsaved preferences.
  useEffect(() => {
    setThresholds(current => current.map(item => {
      const latest = entry.thresholds.find(value => value.key === item.key);
      return latest ? {...item, averageValue:latest.averageValue,
        averageSampleCount:latest.averageSampleCount, excludedZeroCount:latest.excludedZeroCount,
        averageCapturedAt:latest.averageCapturedAt, averageApplied:latest.averageApplied,
        averageUnavailableReason:latest.averageUnavailableReason, historicalAverage:latest.historicalAverage} : item;
    }));
  }, [entry.thresholds]);

  function update(key: string, patch: Partial<AlertThreshold>) {
    setThresholds((current) => current.map((threshold) => threshold.key === key ? { ...threshold, ...patch } : threshold));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    for (const threshold of thresholds) {
      if (!Number.isFinite(threshold.min) || !Number.isFinite(threshold.max) || threshold.min < 0 || threshold.max < 0) {
        setError(`${threshold.label}: 기준값은 0 이상의 숫자여야 합니다.`); return;
      }
      if (!Number.isInteger(threshold.missingThreshold ?? 3) || (threshold.missingThreshold ?? 3) < 3 || (threshold.missingThreshold ?? 3) > 288) { setError(`${threshold.label}: 누락 횟수는 3회에서 288회 사이여야 합니다.`); return; }
      if (threshold.min > threshold.max) { setError(`${threshold.label}: 최소값이 최대값보다 큽니다.`); return; }
    }
    if (!onlyMetricKey) {
    if (!Number.isInteger(collectionIntervalMinutes) || collectionIntervalMinutes < 5 || collectionIntervalMinutes > 1440 || !Number.isInteger(missingCollectionThreshold) || missingCollectionThreshold < 1 || missingCollectionThreshold > 288 || noDataMinutes > 1440) {
      setError("수집 주기는 5~1440분, 누락 기준은 1~288회 정수이며 총 대기시간은 1440분 이하여야 합니다."); return;
    }
    if (!Number.isInteger(triggerAfterMinutes) || triggerAfterMinutes < 0 || triggerAfterMinutes > 1440) {
      setError("이상 지속 기준은 0분에서 1440분 사이의 정수여야 합니다."); return;
    }
    }
    for (const threshold of thresholds) {
      if (!Number.isFinite(threshold.tolerancePercent) || threshold.tolerancePercent < 0.1 || threshold.tolerancePercent > 100) {
        setError(`${threshold.label}: 자동 평균 허용편차는 0.1%에서 100% 사이여야 합니다.`); return;
      }
    }
    setSaving(true); setError(null);
    try { await onSave({ ...entry, thresholds, noDataMinutes, noDataActive, coldChillerActive, collectionIntervalMinutes, missingCollectionThreshold, alertsEnabled, triggerAfterMinutes }); onClose(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "기준값을 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }

  const editor = (
    <div className={page ? "mx-auto w-full max-w-4xl px-2 py-3 sm:px-4" : "fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:p-4"} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form ref={dialogForm} role={page ? undefined : "dialog"} aria-modal={page ? undefined : true} aria-labelledby="threshold-editor-title" onSubmit={submit} className={page ? "w-full rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-background-dark-card" : `flex max-h-[calc(100dvh-env(safe-area-inset-top,0px))] sm:max-h-[92dvh] w-full flex-col rounded-t-2xl border border-slate-200 bg-white shadow-[0_14px_48px_rgba(12,37,54,0.2)] ${onlyMetricKey ? "sm:max-w-lg" : "sm:max-w-4xl"} sm:rounded-2xl dark:border-white/10 dark:bg-background-dark-card`}>
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6 dark:border-white/7">
          <div><p className="text-sm font-bold text-sky-700 dark:text-sky-300">병원별 알림 기준</p><h2 id="threshold-editor-title" className="mt-1 text-xl font-extrabold">{entry.name ?? "이름 없는 병원"}</h2><p className="text-text-secondary mt-1 text-sm">{onlyMetricKey ? "선택한 항목의 수치 범위와 연속 누락 횟수를 설정하세요." : "이 병원의 수치·누락 기준과 이상 지속 시간을 설정하세요."}</p></div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="닫기" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/70">×</button>
        </header>
        <div className={page ? "p-4 sm:p-6" : "min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"}>
          {!onlyMetricKey && <>
            <div className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 dark:bg-white/5"><div className="min-w-0"><p className="text-lg font-bold">이 병원의 내 알림</p><p className="mt-1 text-sm text-text-secondary">{entry.dashboardVisible ? "끄면 내 알림이 모두 멈춥니다." : "숨긴 병원은 알림을 켤 수 없습니다."}</p></div><AlertSwitch label="이 병원의 내 알림" checked={alertsEnabled} disabled={!canEdit || saving || !entry.dashboardVisible} onChange={setAlertsEnabled} /></div>
            <ManagementTabs large label="병원 알림 설정" value={pane} onChange={setPane} items={[{value:"metrics",label:"수치 이상"},{value:"missing",label:"데이터 누락"},{value:"schedule",label:"이상 지속 시간"}]} />
          </>}
          {(onlyMetricKey || pane === "metrics") && <>
          <p className="mb-4 text-base leading-7 text-text-secondary">측정값이 정상 범위를 벗어나면 알려드립니다. 항목을 눌러 기준을 변경하세요.</p>
          {!onlyMetricKey && <div className="mb-3 flex flex-wrap items-center gap-2">{(["active", "all"] as const).map(value => <button type="button" key={value} onClick={() => setMetricFilter(value)} className={`min-h-11 rounded-lg px-4 text-sm font-bold ${metricFilter === value ? "bg-sky-700 text-white" : "bg-slate-100 dark:bg-white/10"}`}>{value === "active" ? "수치 알림 켠 항목" : "전체 항목"}</button>)}<button type="button" disabled={!canEdit || saving} onClick={() => setThresholds(current => current.map(item => ({...item, useAverage: true})))} className="min-h-11 rounded-lg border px-3 text-sm font-bold dark:border-white/10">모든 항목을 24시간 평균으로</button></div>}
          <div className="grid gap-3">
            {thresholds.filter(threshold => metricFilter === "all" || threshold.active)
              .sort((a, b) => Number(b.key === initialMetricKey) - Number(a.key === initialMetricKey))
              .map(threshold => <div key={threshold.key}>
                {onlyMetricKey ? <MetricEditor threshold={threshold} disabled={!canEdit || saving} allowAverage onChange={patch => update(threshold.key, patch)} /> : <details open={threshold.key === initialMetricKey} className="rounded-xl border border-slate-200 bg-white dark:border-white/15 dark:bg-white/5"><summary className="flex min-h-16 cursor-pointer flex-wrap items-center justify-between gap-3 p-4"><span className="text-lg font-bold">{metricName(threshold.key, threshold.label)}</span><span className="text-base text-text-secondary">{threshold.active ? `${roundThreshold(threshold.effectiveMin)} ~ ${roundThreshold(threshold.effectiveMax)}${threshold.unit ? ` ${threshold.unit}` : ""}` : "알림 꺼짐"}</span></summary><div className="border-t border-slate-100 p-3 dark:border-white/10"><MetricEditor threshold={threshold} disabled={!canEdit || saving} allowAverage onChange={patch => update(threshold.key, patch)} /></div></details>}

              </div>)}
          </div>
          {!onlyMetricKey && <div className="mt-5"><AlertSection title="콜드칠러 정지 의심" description="IN·OUT 온도 차이가 0.1°C 이하면 냉각이 멈췄을 가능성을 알려드립니다. 고장이 확정된다는 뜻은 아닙니다. 미측정 값은 제외합니다."><AlertSwitch label="콜드칠러 정지 의심" checked={coldChillerActive && !airCooled} disabled={!canEdit || saving || airCooled || cooling.isPending || cooling.isError} onChange={setColdChillerActive} />{airCooled && <p className="mt-2 text-sm font-semibold text-text-secondary">공냉식 병원이라 사용하지 않음 · 전체 담당자 적용</p>}</AlertSection></div>}
          </>}
          {onlyMetricKey && <div className="mt-5 space-y-3">{thresholds.map(threshold=><MetricMissingEditor key={threshold.key} threshold={threshold} disabled={!canEdit || saving} onChange={patch=>update(threshold.key,patch)} />)}</div>}
          {!onlyMetricKey && pane === "schedule" && <AlertSection title="이상 지속 시간" description="이 병원의 수치·콜드칠러 이상이 얼마나 지속되면 알릴지 정합니다."><NumberField label="몇 분 지속되면 알릴까요?" value={triggerAfterMinutes} min={0} max={1440} disabled={!canEdit || saving} onChange={setTriggerAfterMinutes}/><p className="mt-3 text-base leading-7 text-text-secondary">수치 알림은 실제 측정값이 2회 연속 범위를 벗어나야 발생합니다. 0분은 추가 대기 없이, 1분 이상은 지속 시간도 충족해야 합니다. 콜드칠러 감지와 데이터 누락은 각각의 기준을 사용합니다.</p><Link href="/notification-settings" className="mt-4 inline-flex min-h-11 items-center font-bold text-sky-800 dark:text-sky-200">알림 받는 시간·반복 바꾸기 →</Link></AlertSection>}
          {!onlyMetricKey && pane === "missing" && <div className="space-y-5">
            <AlertSection title="병원 전체 수집 중단" description="이 병원에서 새 데이터가 통째로 오지 않을 때 알려드립니다. 정전이나 공유기 종료 등이 원인일 수 있으니 전원과 인터넷 연결을 확인하세요.">
              <AlertSwitch label="병원 전체 수집 중단" checked={noDataActive} disabled={!canEdit || saving} onChange={setNoDataActive} />
              {noDataActive && <><div className="mt-5 grid gap-4 sm:grid-cols-2"><NumberField label="몇 분마다 데이터가 들어오나요?" value={collectionIntervalMinutes} min={5} max={1440} disabled={!canEdit || saving} onChange={setCollectionIntervalMinutes} /><NumberField label="몇 번 연속 안 오면 알릴까요?" value={missingCollectionThreshold} min={1} max={288} disabled={!canEdit || saving} onChange={setMissingCollectionThreshold} /></div><p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-lg font-bold leading-8 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{collectionIntervalMinutes}분마다 확인해서, {missingCollectionThreshold}회 연속 누락되면 알립니다.<br/>마지막 수집 후 {noDataMinutes}분부터 알림 대상입니다.</p></>}
            </AlertSection>
            <AlertSection title="특정 측정항목 누락" description="데이터는 들어오는데 필요한 항목만 비어 있거나 미측정일 때 알려드립니다. 정상 값이 한 번 들어오면 누락 횟수는 다시 0회가 됩니다.">
              <p className="mb-4 text-base leading-7 text-text-secondary">1~2회 누락은 알리지 않습니다. 감시할 항목을 켜고, 몇 회 연속 빠지면 알릴지 정하세요. 병원 전체 수집이 중단된 동안에는 항목별 누락 알림을 보내지 않습니다.</p>
              <div className="space-y-3">{thresholds.map(threshold=><MetricMissingEditor key={threshold.key} threshold={threshold} disabled={!canEdit || saving} onChange={patch=>update(threshold.key,patch)} />)}</div>
            </AlertSection>
            <div className="rounded-xl bg-sky-50 p-5 text-base leading-7 text-sky-900 dark:bg-sky-950/30 dark:text-sky-200"><p className="font-bold">퇴근 후 공유기를 끄는 병원인가요?</p><p className="mt-2">‘내 알림 수신 설정’에서 퇴근부터 출근까지 알림을 받지 않도록 설정할 수 있습니다. 이 시간에는 수치 이상을 포함한 모든 알림 발송이 쉬어갑니다.</p></div>
          </div>}

        </div>
        {error && <p role="alert" className="shrink-0 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-100 bg-white px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:flex sm:justify-end sm:px-6 dark:border-white/7 dark:bg-background-dark-card">
          <button type="button" disabled={saving} onClick={onClose} className="min-h-12 rounded-xl border border-slate-200 px-5 py-3 text-base font-bold transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">{canEdit ? "취소" : "닫기"}</button>
          {canEdit && <button type="submit" disabled={saving} className="bg-button-primary hover:bg-button-primary-hover min-h-12 rounded-xl px-6 py-3 text-base font-bold text-white shadow-sm transition disabled:opacity-50">{saving ? "저장 중…" : onlyMetricKey ? "이 알림 저장" : "설정 저장"}</button>}
        </footer>
      </form>
    </div>
  );
  if (!page && smallScreen) return <p role="status" className="p-4">알림 설정 화면으로 이동 중…</p>;
  return page ? editor : createPortal(editor, document.body);
}

function MetricMissingEditor({threshold,disabled,onChange}:{threshold:AlertThreshold;disabled:boolean;onChange:(patch:Partial<AlertThreshold>)=>void}) {
  const count = threshold.missingThreshold ?? (threshold.key === "hepres" ? 5 : 3);
  const active = threshold.missingActive ?? threshold.key === "hepres";
  return <section className="rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-600 dark:bg-background-dark-secondary">
    <h4 className="mb-3 flex flex-wrap items-center text-lg font-bold">{metricName(threshold.key,threshold.label)} · 항목 누락<HelpButton title="항목 누락" message={ALERT_HELP["항목 누락"]}/></h4>
    <p className="mb-4 text-sm leading-6 text-text-secondary">병원 데이터는 들어오는데 이 측정값만 빠진 경우를 확인합니다. 병원 전체 수집 누락 알림과 별개입니다.</p>
    <AlertSwitch label={`${metricName(threshold.key,threshold.label)} 누락 알림`} checked={active} disabled={disabled} onChange={missingActive=>onChange({missingActive,missingThreshold:count})}/>
    {active && <div className="mt-4"><NumberField label="몇 회 연속 빠지면 알릴까요?" value={count} min={3} max={288} disabled={disabled} onChange={missingThreshold=>onChange({missingThreshold})}/>
      <p className="mt-2 text-base leading-7 text-text-secondary">{Number.isInteger(count) && count >= 3 && count <= 288 ? `1~${count - 1}회는 알리지 않고, ${count}회 이상 연속 누락되면 알립니다. 정상 값이 들어오면 다시 0회가 됩니다.` : "3회에서 288회 사이의 정수를 입력해주세요."}</p>
    </div>}
  </section>;
}

function MetricEditor({ threshold, disabled, allowAverage = false, onChange }: { threshold: AlertThreshold; disabled: boolean; allowAverage?: boolean; onChange: (patch: Partial<AlertThreshold>) => void }) {
  const preview = previewAlertRange(threshold);
  const unit = threshold.unit ? ` ${threshold.unit}` : "";
  const formatRange = (min: number, max: number) => `${roundThreshold(min)} – ${roundThreshold(max)}${unit}`;
  const manualFields = <div className="grid grid-cols-2 gap-3">
    <NumberField label="최소값" value={threshold.min} disabled={disabled} onChange={min => onChange({min})} />
    <NumberField label="최대값" value={threshold.max} disabled={disabled} onChange={max => onChange({max})} />
  </div>;
  return (
    <section className={allowAverage ? "py-2" : "rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-background-dark-secondary"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="font-extrabold">{metricName(threshold.key, threshold.label)}{threshold.unit && <span className="text-text-secondary ml-1 text-sm font-medium">({threshold.unit})</span>}</h3><p className="text-text-secondary mt-0.5 line-clamp-2 text-sm">{METRIC_DESCRIPTION.get(threshold.key)}</p></div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" checked={threshold.active} disabled={disabled} onChange={(event) => onChange({ active: event.target.checked })} className="h-5 w-5 accent-sky-700" />사용</label>
      </div>
      {allowAverage && <fieldset className="mt-4">
        <legend className="text-sm font-bold">정상 범위를 정하는 방법<HelpButton title="정상 범위를 정하는 방법" message={ALERT_HELP["정상 범위를 정하는 방법"]}/></legend>
        <div className="mt-2 grid gap-1 lg:grid-cols-2">
          {[{value:true,label:"평균에 맞춰 자동 조정",description:"평균이 갱신되면 범위도 자동 변경"}, {value:false,label:"직접 범위 입력",description:"입력한 범위를 계속 사용"}].map(mode =>
            <label key={String(mode.value)} className="flex min-h-11 cursor-pointer items-center gap-3 py-2">
              <input type="radio" name={`alert-basis-${threshold.key}`} checked={threshold.useAverage === mode.value} disabled={disabled} onChange={()=>onChange({useAverage:mode.value})} className="mt-0.5 h-5 w-5 shrink-0 accent-sky-700" />
              <span className="text-sm font-semibold">{mode.label}</span>
            </label>)}
        </div>
      </fieldset>}
      {allowAverage && threshold.useAverage ? <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
        <div><p className="text-sm font-semibold text-text-secondary">{threshold.historicalAverage ? "과거 24시간 평균 사용" : "최근 24시간 평균"}</p>
        {threshold.historicalAverage && <p className="mt-1 text-sm leading-5 text-amber-700 dark:text-amber-300">최근 평균을 사용할 수 없어 마지막 정상 평균을 사용합니다. 최근 표본이 충분해지면 자동 복귀합니다.</p>}
        {averagePeriodMessage(threshold) && <p className="mt-1 text-sm text-text-secondary">{averagePeriodMessage(threshold)}</p>}
        <p className="mt-1 text-lg font-extrabold">{threshold.averageValue == null ? "데이터 없음" : `${roundThreshold(threshold.averageValue)}${unit}`}</p>
        <p className="mt-1 text-sm text-text-secondary">유효 {threshold.averageSampleCount}건 · 미측정 제외 {threshold.excludedZeroCount}건 · 매시간 자동 갱신</p></div>
        <div className="max-w-sm"><div className="flex items-center text-sm font-semibold">평균에서 벗어나는 비율<HelpButton title="허용편차" message={ALERT_HELP["허용편차"]}/></div><NumberField label="허용편차 (±%)" value={threshold.tolerancePercent} min={0.1} max={100} disabled={disabled} onChange={tolerancePercent=>onChange({tolerancePercent})} /></div>
        <div role="status" aria-live="polite" className="border-l-2 border-sky-600 py-1 pl-3 dark:border-sky-400">
          <p className="text-sm font-bold">저장 후 적용될 범위 · {preview.averageApplied ? threshold.historicalAverage ? "과거 24시간 평균" : "24시간 평균" : "대체 범위"}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatRange(preview.min,preview.max)}</p>
          {!preview.averageApplied && <p className="mt-2 text-sm leading-5">{preview.reason ?? "허용편차를 확인해주세요."} 현재는 아래 대체 범위로 판단합니다. 표본과 최신성 조건이 충족되면 평균 기준으로 자동 전환됩니다.</p>}
        </div>
        {threshold.averageValue != null && !preview.averageApplied && <p className="mt-2 text-sm text-text-secondary">평균 적용 조건 충족 시 계산 범위: {formatRange(threshold.averageValue - Math.abs(threshold.averageValue)*threshold.tolerancePercent/100, threshold.averageValue + Math.abs(threshold.averageValue)*threshold.tolerancePercent/100)} · 현재 미적용</p>}
        <details className="border-t border-slate-200 pt-2 dark:border-slate-700"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">평균 사용 불가 시 대체 범위 수정</summary>{manualFields}<p className="mt-2 text-sm text-text-secondary">최근 평균이 부족하거나 오래되면 이전의 정상 24시간 평균을 찾아 사용합니다. 과거에도 유효 표본 12건 이상인 정상 평균이 없으면 이 대체 범위를 사용합니다. 미측정 값은 평균에서 제외합니다.</p></details>
      </div> : <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
        <p className="mb-3 text-sm font-bold">수동 범위 설정</p>{manualFields}
        <p role="status" aria-live="polite" className="mt-3 text-sm font-bold">저장 후 적용될 범위: {formatRange(threshold.min,threshold.max)}</p>
        {allowAverage && <p className="mt-2 text-sm text-text-secondary">24시간 평균과 허용편차는 알림 판단에 사용하지 않습니다.</p>}
      </div>}
    </section>
  );
}

function roundThreshold(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : value;
}

function NumberField({ label, value, disabled, ignoreBlank = false, min = 0, max, onChange }: { label: string; value: number; disabled: boolean; ignoreBlank?: boolean; min?: number; max?: number; onChange: (value: number) => void }) {
  return <label className="text-text-secondary text-base font-bold">{label}<input type="number" min={min} max={max} step="any" required value={Number.isFinite(value) ? roundThreshold(value) : ""} disabled={disabled} onChange={(event) => { if (ignoreBlank && event.target.value === "") return; onChange(event.target.value === "" ? Number.NaN : Number(event.target.value)); }} className="text-text-major mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold tabular-nums outline-none focus:border-sky-400 disabled:opacity-70 dark:border-white/10 dark:bg-background-dark-primary dark:text-text-dark-primary" /></label>;
}

function EmptyState() { return <div className="text-text-secondary rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm dark:border-white/10">검색 결과가 없습니다.</div>; }
