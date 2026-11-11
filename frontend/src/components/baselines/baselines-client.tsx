"use client";

import CompanyAlertSettings from "./company-alert-settings";
import Select from "@/components/common/select";
import Pagination from "@/components/common/pagination";
import PageLoader from "@/components/common/page-loader";
import CircleLoader from "@/components/icons/circle-loader";

import AlertSnooze from "./alert-snooze";

import { DEFAULT_ALERT_EVENT_FILTER, needsAcknowledgement, type AlertEventFilter } from "@/lib/alert-event-state";
import HelpButton from "@/components/common/context-help";
import {useOperatingHours,nextMonitoringLabel} from "@/lib/site-operating-hours";
import SiteCoolingControl from "./site-cooling-control";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/provider/auth-provider";
import type { AlertEventSummary, SiteAlertSettings } from "@/lib/api";
import { formatMetricMeasurement, METRICS } from "@/lib/metrics";
import Link from "@/components/common/app-link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";


function metricName(key: string, label?: string | null) {
  if (key === "hepres" && (!label || label === "He Pressure")) return "헬륨 압력 (He Pressure)";
  if (key === "heleve" && (!label || label === "He Level")) return "헬륨 잔량 (He Level)";
  return label || key;
}


export default function BaselinesClient({
  entries,
  loadFailed = false,
  canEdit = false,
  canEditCompany = false,
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
  const [busySite, setBusySite] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return entries;
    return entries.filter((entry) =>
      entry.siteid.toLowerCase().includes(keyword) || (entry.name ?? "").toLowerCase().includes(keyword),
    );
  }, [entries, query]);
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

  if (["settings", "thresholds"].includes(view)) return <main className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6">
    <button type="button" onClick={()=>navigateView("events")} className="mb-3 min-h-12 font-bold">← 알림 목록</button>
    <h1 className="mb-4 text-2xl font-extrabold">알림 설정</h1>
    <CompanyAlertSettings />
  </main>;
  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      {view === "events" ? <header className="alert-inbox-heading">
        <div className="flex items-center justify-between gap-3">
          <h1 className="!mt-0">알림</h1>
          <button
            type="button"
            onClick={() => navigateView("settings")}
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold whitespace-nowrap hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-background-dark-card dark:hover:bg-slate-800 dark:active:bg-slate-800"
          >
            알림 설정
          </button>
        </div>
        <p>병원 상태를 확인하고 필요한 알림을 관리하세요.</p>
      </header> : null}
      {view === "sites" && <div className="mb-5">
        <button type="button" onClick={() => navigateView("settings")} className="mb-2 inline-flex min-h-12 items-center rounded-lg px-2 text-base font-bold text-sky-800 hover:bg-sky-50 dark:text-sky-200 dark:hover:bg-sky-950/30">← 알림 설정 메뉴</button>
        <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-extrabold">{view === "sites" ? "병원 운영시간·표시" : "병원별 알림 기준"}</h2><span className="lg:hidden"><HelpButton title={view === "sites" ? "병원 운영시간·표시" : "병원별 알림 기준"} message={view === "sites" ? "병원을 찾은 뒤 원하는 항목을 바꾸세요. 운영시간과 냉각 방식은 모든 담당자에게 적용됩니다." : "병원을 검색하고 변경할 기준값을 누르세요. 변경한 알림 기준은 내 계정에만 적용됩니다."}/></span></div>
        <p className="mt-2 hidden text-base leading-7 text-text-secondary lg:block">{view === "sites" ? "설정할 병원을 찾은 뒤 원하는 항목을 바꾸세요." : "병원을 찾은 뒤 바꾸려는 항목의 기준값을 눌러주세요. 내 계정에만 적용됩니다."}</p>
      </div>}

      {view === "sites" ? <section className="space-y-3">
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
      </section> : <AlertEventsPanel onOpenSettings={event => router.push(`/alert-settings/${encodeURIComponent(event.siteId)}`)} availableSites={entries} onAcknowledge={onAcknowledge} onAcknowledgeMany={onAcknowledgeMany} onRetryDelivery={onRetryDelivery} />}

    </main>
  );
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
    if (!window.confirm("이 알림을 확인했나요? 내 알림 목록에 확인으로 표시합니다. 문제 해결 여부는 별도로 표시됩니다.")) return;
    setAcknowledging(eventId); setError(null);
    try { await onAcknowledge(eventId); await history.refetch(); }
    catch (ackError) { setError(ackError instanceof Error ? ackError.message : "알림을 확인 처리하지 못했습니다."); }
    finally { setAcknowledging(null); }
  }

  async function acknowledgeSelected(ids: number[]) {
    if (ids.length === 0) return;
    if (!window.confirm(`${ids.length}건을 확인했나요? 내 알림 목록에 확인으로 표시합니다. 문제 해결 여부는 별도로 표시됩니다.`)) return;
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
    <section className="alert-inbox">
      <div className="alert-inbox-tabs" aria-label="알림 보기">
        {(["unacknowledged", "open", "all"] as const).map(value => <button key={value} type="button" aria-pressed={value === filter} onClick={() => { setFilter(value); setSelecting(false); setSelected([]); }}>{value === "unacknowledged" ? "확인 필요" : value === "open" ? "진행 중" : "전체 기록"}</button>)}
      </div>
      <p className="alert-inbox-guide">{filter === "unacknowledged" ? "아직 확인하지 않은 알림입니다. 문제가 계속되면 24시간 뒤 확인 필요 목록에 다시 표시될 수 있습니다." : filter === "open" ? "확인 여부와 관계없이 아직 정상으로 복구되지 않은 문제입니다." : "확인한 알림과 정상으로 복구된 기록도 함께 볼 수 있습니다."}</p>
      <details className="alert-inbox-filters">
        <summary>상세 검색{(query || siteId || fromDate || toDate || kind !== "all") ? " · 적용 중" : ""}</summary>
        <div className="alert-inbox-filter-fields">
          <label className="alert-inbox-filter-search">알림 내용<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="검색어 입력" /></label>
          <label>병원<Select value={siteId} onChange={event => setSiteId(event.target.value)}><option value="">모든 병원</option>{sites.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</Select></label>
          <label>문제 유형<Select value={kind} onChange={event => setKind(event.target.value)}><option value="all">모든 유형</option><option value="range">수치 이상</option><option value="site">데이터 수집 중단</option><option value="missing">측정항목 누락</option><option value="chiller">냉각장치 정지 의심</option></Select></label>
          <label>시작일<input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} /></label>
          <label>종료일<input type="date" value={toDate} onChange={event => setToDate(event.target.value)} /></label>
          <button type="button" className="work-secondary" onClick={() => { setQuery(""); setSiteId(""); setKind("all"); setFromDate(""); setToDate(""); }}>검색 조건 초기화</button>
        </div>
      </details>
      {total > 0 && <div className="mb-3 flex min-h-11 flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{total}건</span>
        <HelpButton title="알림 확인" message="확인하면 내 확인 필요 목록에서 빠집니다. 문제가 계속되면 24시간 뒤 목록에 다시 표시될 수 있습니다. 회사 공통 카톡 알림은 문제당 한 번 발송됩니다."/>
        <button type="button" aria-pressed={selecting} onClick={() => { setSelecting(!selecting); setSelected([]); }} className="action-cancel ml-auto min-h-11 px-3 text-sm font-semibold text-sky-700 dark:text-sky-300">{selecting ? "선택 취소" : "선택"}</button>
        {selecting && <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100 px-3 dark:bg-white/5">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" checked={selectableIds.length > 0 && selectableIds.every(id => selected.includes(id))} onChange={event => setSelected(event.target.checked ? selectableIds : [])} className="h-5 w-5 accent-sky-700"/>이 페이지 선택</label>
          <button type="button" disabled={busy || selectedIds.length === 0} onClick={() => acknowledgeSelected(selectedIds)} className="min-h-11 rounded-lg px-3 text-sm font-bold text-sky-700 disabled:opacity-40 dark:text-sky-300">{bulkSaving ? <CircleLoader size="xs" inline /> : `${selectedIds.length}건 확인`}</button>
        </div>}
      </div>}
      {history.isPending && <PageLoader />}
      {failed && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">알림 이력을 불러오지 못했습니다. <button type="button" onClick={() => history.refetch()} className="min-h-11 underline">다시 시도</button></p>}
      {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {!history.isPending && !failed && filtered.length === 0 && (
        <p role="status" className="px-1 py-3 text-sm text-text-secondary">
          {query || siteId || fromDate || toDate || kind !== "all"
            ? "조건에 맞는 알림이 없어요."
            : filter === "unacknowledged" ? "확인할 알림이 없어요."
              : filter === "open" ? "지속 중인 문제가 없어요."
                : "알림 기록이 없어요."}
        </p>
      )}
      <div className={filter === "all" ? "received-alert-history" : "alert-inbox-list"}>
        {filtered.map((event) => <AlertEventRow key={event.id} compact={filter === "all"} selecting={selecting} event={event} selected={selected.includes(event.id)} onSelect={(checked) => setSelected((current) => checked ? Array.from(new Set([...current, event.id])) : current.filter((id) => id !== event.id))} disabled={busy} acknowledging={acknowledging === event.id} retrying={retrying === event.id} onAcknowledge={() => acknowledge(event.id)} onRetry={() => retry(event.id)} onOpenSettings={() => onOpenSettings(event)} settingsAvailable={availableSites.some(site => site.siteid === event.siteId)} />)}
      </div>
      {(total > 20 || currentPage > 1) && <Pagination page={currentPage} total={total} onPageChange={setPage} disabled={history.isFetching} label="알림 이력 페이지" />}
    </section>
  );
}

function AlertEventRow({
  event,
  compact = false,
  selecting,
  selected,
  onSelect,
  disabled,
  acknowledging,
  retrying,
  onAcknowledge,
  onRetry,
  onOpenSettings,
  settingsAvailable,
}: {
  event: AlertEventSummary;
  compact?: boolean;
  selecting: boolean;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  disabled: boolean;
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
      className={`received-alert ${recovered ? "is-recovered" : "is-active"} ${compact ? "is-compact" : ""} ${showDelivery ? "is-expanded" : ""}`}
    >
      <div className="received-alert-top">
        {selecting && (
          <input
            type="checkbox"
            aria-label={`${event.siteName ?? event.siteId} 알림 선택`}
            checked={selected}
            disabled={!needsAcknowledgement(event) || disabled}
            onChange={(e) => onSelect(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-sky-700"
          />
        )}
        <h3>{event.siteName ?? event.siteId}</h3>
        <span className="received-alert-state">
          {recovered ? "복구됨" : "진행 중"}
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
        {!event.acknowledgedAt && !recovered && (!compact || showDelivery) && (
          <button
            type="button"
            disabled={disabled}
            onClick={onAcknowledge}
            className="received-alert-confirm"
          >
            {acknowledging ? <CircleLoader size="xs" inline /> : "확인"}
          </button>
        )}
        <button
          type="button"
          aria-expanded={showDelivery}
          onClick={() => setShowDelivery(!showDelivery)}
          className="received-alert-more"
        >
          {showDelivery ? "닫기" : "상세"}
        </button>
      </div>
      {showDelivery && (
        <div className="received-alert-manage">
          <div className="received-alert-facts"><span>발송 <strong>{deliveryLabel(event.deliveryStatus)}</strong></span>{event.recoveredAt && <span>복구 <strong>{new Date(event.recoveredAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</strong></span>}</div>
          <div className="flex items-center justify-between">
            <strong className="text-sm">이 알림 잠시 중지</strong>
            <HelpButton
              title="알림 잠시 중지"
              message="같은 병원·항목·유형의 알림을 일정 기간 중지합니다. 중지 시간을 바꾸거나 수신을 재개할 수 있습니다."
            />
          </div>
          {!recovered && <AlertSnooze event={event} />}
          <button
            type="button"
            disabled={!settingsAvailable}
            onClick={onOpenSettings}
            className="mt-3 min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-bold text-sky-800 disabled:opacity-40 dark:border-slate-600 dark:text-sky-200"
          >
            이 알림 기준 바꾸기
          </button>
          {isAdmin &&
            !recovered &&
            ["FAILED", "PARTIAL", "SKIPPED"].includes(event.deliveryStatus) && (
              <button
                type="button"
                disabled={disabled}
                onClick={onRetry}
                className="mt-2 min-h-11 rounded-lg border px-3 font-bold"
              >
                {retrying ? <CircleLoader size="xs" inline /> : "전송 재시도"}
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
        <details className="received-alert-deliveries">
          <summary>발송 내역 · 수신처별 결과</summary>
          <details className="my-2"><summary className="cursor-pointer text-sm text-text-secondary">발송된 알림 원문</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{event.message}</p></details>
          {results.isLoading ? (
            <p><CircleLoader size="xs" /></p>
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
                className="space-y-1 border-t border-slate-200 py-3 dark:border-white/10"
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
        </details>
      )}
    </article>
  );
}

function formatValue(value: number | null, unit?: string | null) { return value == null ? "-" : `${Number(value.toFixed(2))}${unit ? ` ${unit}` : ""}`; }
function deliveryLabel(status: AlertEventSummary["deliveryStatus"]) { return ({ PENDING: "대기", SENDING: "전송 중", SENT: "접수 완료", PARTIAL: "일부 접수 실패", FAILED: "접수 실패", SKIPPED: "미발송", UNKNOWN: "결과 확인 필요" } as const)[status] ?? status; }

function EmptyState() { return <div className="text-text-secondary rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm dark:border-white/10">검색 결과가 없습니다.</div>; }
