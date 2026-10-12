"use client";

import { useAuth } from "@/components/provider/auth-provider";
import { defaultPreferences, readDashboardPreferences, writeDashboardPreferences, type DashboardPreferences } from "@/lib/dashboard-preferences";
import PullToRefresh from "@/components/common/pull-to-refresh";
import { SiteAlertSettingsDialog } from "@/components/baselines/site-alert-settings-button";
import AlertSettingsTable, { type AlertSettingsPane } from "@/components/baselines/alert-settings-table";
import DashboardScrollTo from "@/components/dashboard-scroll-to";
import DashboardExcelView from "@/components/dashboard/dashboard-excel-view";
import DashboardMetricInfo, { type MetricSelection } from "./dashboard-metric-info";
import DashboardLoading from "@/components/dashboard/dashboard-loading";
import {
  type SiteRow,
  useDashboardQuery,
} from "@/hooks/use-dashboard-query";
import Link from "next/link";
import { companyMetrics, dashboardColumns } from "@/lib/company-metrics";
import type { MetricDef } from "@/lib/metrics";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, type SiteAlertSettings } from "@/lib/api";

type StatusFilter = "all" | "issues" | "warning" | "no-data" | "normal" | "configured";
const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: "전체",
  issues: "이상 병원",
  warning: "기준 이탈",
  "no-data": "수신 중단",
  normal: "정상",
  configured: "알림값 확인",
};

function compareSite(a: SiteRow, b: SiteRow) {
  const aSlug = a.siteSlug ?? "";
  const bSlug = b.siteSlug ?? "";

  const aIsNum = /^\d+$/.test(aSlug);
  const bIsNum = /^\d+$/.test(bSlug);

  if (aIsNum && bIsNum) return Number(aSlug) - Number(bSlug);
  if (aIsNum) return -1;
  if (bIsNum) return 1;

  return aSlug.localeCompare(bSlug);
}

function fmtYmd(d: Date | null) {
  if (!d) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtHms(d: Date | null) {
  if (!d) return "-";
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mi}:${ss}`;
}

function fmtYmdHms(ms: number) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "-";
  return `${fmtYmd(date)} ${fmtHms(date)}`;
}


export default function DashboardClient() {
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboardQuery();

  const { session } = useAuth();
  const userId = session?.id;
  const [preferences, setPreferences] = useState<DashboardPreferences>(defaultPreferences);
  const [showColumns, setShowColumns] = useState(false);
  useEffect(() => { setPreferences(userId === undefined ? defaultPreferences : readDashboardPreferences(userId)); }, [userId]);
  const updatePreferences = (next: DashboardPreferences) => { setPreferences(next); if (session) writeDashboardPreferences(session.id, next); };

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [metricSelection, setMetricSelection] = useState<MetricSelection | null>(null);
  const closeMetricInfo = useCallback(() => setMetricSelection(null), []);
  const inspectMetric = useCallback((row: SiteRow, metric: MetricDef) => setMetricSelection({siteId: row.siteDb, hospital: row.name ?? "병원명 없음", metricKey: metric.key, label: metric.label ?? metric.code}), []);
  const [selectedAlert, setSelectedAlert] = useState<{siteId: string; metricKey?: string; pane?: AlertSettingsPane; onlyMetric?: boolean} | null>(null);
  const openAlertSettings = useCallback((siteId: string, metricKey?: string) => setSelectedAlert({siteId, metricKey}), []);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const alertSettings = useQuery({ queryKey: ["alert-thresholds"], queryFn: () => apiFetch<SiteAlertSettings[]>("/alerts/thresholds"), enabled: statusFilter === "configured", staleTime: 60_000, refetchInterval: 60_000 });

  useEffect(() => {
    if (!showMobileFilters) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setShowMobileFilters(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [showMobileFilters]);

  const changeStatusFilter = useCallback((next: StatusFilter) => {
    setStatusFilter(next);
    setShowMobileFilters(false);
  }, []);

  const resetStatusFilter = useCallback(() => changeStatusFilter("all"), [changeStatusFilter]);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const filteredRows = useMemo(() => {
    const currentRows = data?.rows ?? [];
    return currentRows.filter((row) => statusFilter === "all" || statusFilter === "configured" ||
      (statusFilter === "issues" && row.alertStatus !== "NORMAL") ||
      (statusFilter === "warning" && row.alertStatus === "WARNING") ||
      (statusFilter === "no-data" && row.alertStatus === "NO_DATA") ||
      (statusFilter === "normal" && row.alertStatus === "NORMAL"));
  }, [data?.rows, statusFilter]);

  const sortedRows = useMemo(
    () => filteredRows.slice().sort((a, b) => {
      const rank = { NO_DATA: 0, WARNING: 1, NORMAL: 2 } as const;
      return rank[a.alertStatus] - rank[b.alertStatus] || b.unacknowledgedAlertCount - a.unacknowledgedAlertCount || compareSite(a, b);
    }),
    [filteredRows],
  );

  if (isLoading) {
    return <DashboardLoading />;
  }

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-7xl px-3 py-4 lg:px-6">
        <div className="rounded-lg border border-red-200 bg-red-50/60 p-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          데이터를 불러오지 못했습니다.{" "}
          {String((error as Error)?.message ?? "알 수 없는 오류")}
          <button type="button" onClick={handleRefresh} className="mt-3 block min-h-11 rounded-xl bg-white px-4 font-bold text-sky-800">다시 불러오기</button>
        </div>
      </main>
    );
  }

  const { meta, ctrl } = data;
  const metrics = companyMetrics(data.metricConfig);
  const dashboardMetrics = metrics;
  const allColumns = dashboardColumns(data.metricConfig);
  const visibleColumns = preferences.columns === null ? allColumns : allColumns.filter(column => preferences.columns!.includes(column.key));
  const viewOptions = <div className="mt-3 space-y-2 text-sm">

    <button type="button" aria-expanded={showColumns} onClick={() => setShowColumns(value => !value)} className="min-h-11 rounded-lg border px-3">표시할 열 ({visibleColumns.length})</button>
    {showColumns && <fieldset className="rounded-xl border p-3"><legend>내 전체표 열 선택</legend><div className="grid grid-cols-2 gap-1">{allColumns.map(column => <label key={column.key} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={visibleColumns.some(item => item.key === column.key)} onChange={event => {
      const keys = visibleColumns.map(item => item.key);
      updatePreferences({ ...preferences, columns: event.target.checked ? [...keys, column.key] : keys.filter(key => key !== column.key) });
    }} />{column.displayName}</label>)}</div><button type="button" onClick={() => updatePreferences({ ...preferences, columns: null })} className="min-h-11 text-sky-700 underline">전체 열 복원</button></fieldset>}
    <button type="button" onClick={() => {setStatusFilter("all");}} className="min-h-11 px-3 underline">병원 필터 초기화</button>
  </div>;

  const statusFilterButtons = (
    <>
      <StatusFilterButton active={statusFilter === "all"} onClick={() => changeStatusFilter("all")} label="전체" value={data.stats.totalSites} tone="slate" />
      <StatusFilterButton active={statusFilter === "issues"} onClick={() => changeStatusFilter("issues")} label="이상 병원" value={data.stats.warningSites + data.stats.noDataSites} tone="rose" />
      <StatusFilterButton active={statusFilter === "warning"} onClick={() => changeStatusFilter("warning")} label="기준 이탈" value={data.stats.warningSites} tone="amber" />
      <StatusFilterButton active={statusFilter === "no-data"} onClick={() => changeStatusFilter("no-data")} label="수신 중단" value={data.stats.noDataSites} tone="rose" />
      <StatusFilterButton active={statusFilter === "normal"} onClick={() => changeStatusFilter("normal")} label="정상" value={data.stats.normalSites} tone="emerald" />
      <StatusFilterButton active={statusFilter === "configured"} onClick={() => changeStatusFilter("configured")} label="알림값" value="확인" tone="slate" />
    </>
  );

  const mobileControls = (
    <div className="lg:hidden" data-ptr-ignore>
      {showMobileFilters && <section id="dashboard-mobile-tools" aria-label="대시보드 필터" className="fixed right-3 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-3 z-[55] mx-auto max-h-[70dvh] max-w-sm overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-background-dark-card">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-extrabold">필터</h2><div className="flex gap-2"><button type="button" aria-label="필터 패널 닫기" onClick={() => setShowMobileFilters(false)} className="min-h-10 min-w-10 rounded-lg text-xl">×</button></div></div>
        <p className="mt-4 mb-2 text-xs font-bold text-slate-500 dark:text-slate-300">병원 필터 · {STATUS_FILTER_LABEL[statusFilter]}</p>
        <div className="grid grid-cols-2 gap-2">{statusFilterButtons}</div>
        <Link href="/baselines?view=events" className="mt-3 block min-h-11 rounded-xl border px-3 py-3 text-sm font-bold text-sky-700 dark:text-sky-300">알림 관리 · 이력·설정·패턴 →</Link>
        {viewOptions}
      </section>}
      <button type="button" aria-label="대시보드 필터" aria-expanded={showMobileFilters} aria-controls="dashboard-mobile-tools" onClick={() => setShowMobileFilters(open => !open)} className="fixed right-0 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-[55] min-h-11 rounded-l-xl border border-slate-200 bg-white/95 px-2 text-xs font-bold text-sky-800 shadow-sm dark:border-white/10 dark:bg-background-dark-card dark:text-sky-200">필터 {showMobileFilters ? "›" : "‹"}{statusFilter !== "all" && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-sky-500" aria-label={`${STATUS_FILTER_LABEL[statusFilter]} ${sortedRows.length}개`} />}</button>
    </div>
  );

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      topOffset={56}
    >
      <main className={`mobile-safe-inline mx-auto w-full max-w-7xl px-[4px] pt-[8px] pb-[2px] lg:px-6 lg:py-5 ${statusFilter !== "configured" ? "flex h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] min-h-[32rem] flex-col" : ""}`}>
        <Suspense fallback={null}><DashboardScrollTo offset={80} onTargetRequested={resetStatusFilter} /></Suspense>

        <header className="mb-3 hidden shrink-0 flex-wrap items-center justify-between gap-2 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 px-3 py-2 shadow-[0_10px_35px_rgba(22,58,82,0.07)] backdrop-blur-sm lg:flex lg:mb-5 lg:gap-4 lg:rounded-3xl lg:px-5 lg:py-4 dark:border-white/8 dark:bg-background-dark-card/90">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-50 dark:from-sky-950 dark:to-cyan-950">
              <span className="absolute h-3 w-3 animate-ping rounded-full bg-emerald-400/50" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <div className="min-w-0">
            <h1 className="text-text-major dark:text-text-dark-primary text-xl font-extrabold tracking-tight lg:text-2xl">
              수집 현황
            </h1>
            <p className="text-text-secondary dark:text-text-dark-primary/70 mt-0.5 text-[0.8125rem] font-medium">
              화면 갱신{" "}
              <span className="tabular-nums">{fmtYmdHms(meta.nowMs)}</span>{data.stats.openAlerts > 0 && <span className="ml-2 font-bold text-rose-600 dark:text-rose-300">· 진행 중 알림 {data.stats.openAlerts}건</span>}
            </p>
            {isError && <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">연결 실패 · 마지막으로 받은 화면입니다.</p>}
            </div>
          </div>
          <button type="button" disabled={isFetching} onClick={handleRefresh} className="min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-50">{isFetching ? "갱신 중…" : "새로고침"}</button>
        </header>
        <details className="mb-3 hidden shrink-0 rounded-xl border p-3 lg:block"><summary className="cursor-pointer text-sm font-bold">표시할 열 설정</summary>{viewOptions}</details>
        <div className="mb-1 flex shrink-0 items-center justify-between px-1 text-[11px] lg:hidden"><span>가로로 밀어 더 보기 · 수집 시각은 병원별 표시</span><button type="button" disabled={isFetching} onClick={handleRefresh} className="min-h-11 px-2 font-bold text-sky-700 dark:text-sky-300">{isFetching ? "갱신 중…" : "새로고침"}</button></div>

        {isError && <p role="status" className="mb-2 px-1 text-xs font-bold text-amber-700 lg:hidden dark:text-amber-300">연결 실패 · 마지막으로 받은 화면입니다.</p>}

        <section className="mb-5 hidden shrink-0 grid-cols-6 gap-2 lg:grid" aria-label="상태별 병원 필터">
          {statusFilterButtons}
        </section>

        {statusFilter === "configured" ? (
          <section className="space-y-3">
            <Link href="/baselines" className="hidden min-h-12 py-3 text-base font-bold text-sky-700 lg:inline-block dark:text-sky-300">알림 관리에서 전체 설정 보기 →</Link>
            {alertSettings.isPending ? <p className="p-4 text-sm">설정 불러오는 중…</p> : alertSettings.isError ? <button type="button" className="min-h-11 p-3 text-sm text-rose-600" onClick={() => alertSettings.refetch()}>설정을 불러오지 못했습니다. 다시 시도</button> : (
              <AlertSettingsTable entries={alertSettings.data ?? []} metrics={dashboardMetrics} onOpen={(site,metricKey,pane)=>setSelectedAlert({siteId:site.siteid,metricKey,pane,onlyMetric:!!metricKey && !metricKey.startsWith("__")})} />
            )}
          </section>
        ) : (
          <DashboardExcelView
            onInspectMetric={inspectMetric}
            onOpenAlertSettings={openAlertSettings}
            rows={sortedRows}
            ctrl={ctrl}
            metrics={dashboardMetrics}
            columns={visibleColumns}
            emptyMessage={data.rows.length === 0 ? "표시할 병원이 없습니다. 병원 표시 설정이나 연결 상태를 확인해주세요." : `${STATUS_FILTER_LABEL[statusFilter]} 조건에 맞는 병원이 없습니다.`}
            onResetFilters={() => {setStatusFilter("all");}}
          />
        )}
        <p className="text-text-secondary mt-1 shrink-0 px-1 text-center text-[10px] leading-3 lg:hidden dark:text-text-dark-primary/70">
          화면 갱신 {fmtYmdHms(meta.nowMs)} · 5분마다 자동 갱신{data.stats.openAlerts > 0 ? ` · 진행 중 알림 ${data.stats.openAlerts}건` : ""}
        </p>
        {metricSelection && <DashboardMetricInfo selection={metricSelection} onClose={closeMetricInfo} onEdit={() => { setSelectedAlert({siteId: metricSelection.siteId, metricKey: metricSelection.metricKey, onlyMetric: true}); closeMetricInfo(); }} />}
        {selectedAlert && <SiteAlertSettingsDialog key={`${selectedAlert.siteId}:${selectedAlert.metricKey ?? ""}`} siteId={selectedAlert.siteId} initialMetricKey={selectedAlert.metricKey} initialPane={selectedAlert.pane} onlyMetricKey={selectedAlert.onlyMetric ? selectedAlert.metricKey : undefined} onClose={() => setSelectedAlert(null)} />}
      </main>
      {mobileControls}
    </PullToRefresh>
  );
}

function StatusFilterButton({ active, onClick, label, value, tone }: { active: boolean; onClick: () => void; label: string; value: number | string; tone: "slate" | "rose" | "amber" | "emerald" }) {
  const colors = { slate: "text-slate-600 dark:text-slate-300", rose: "text-rose-600 dark:text-rose-300", amber: "text-amber-600 dark:text-amber-300", emerald: "text-emerald-600 dark:text-emerald-300" };
  return <button type="button" onClick={onClick} className={`cursor-pointer rounded-2xl border bg-white px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 dark:bg-background-dark-card ${active ? "border-sky-400 ring-2 ring-sky-100 dark:border-sky-500 dark:ring-sky-950" : "border-slate-200/80 dark:border-white/8"}`}><span className="text-text-secondary block text-[11px] font-bold">{label}</span><span className={`mt-0.5 block text-xl font-extrabold tabular-nums ${colors[tone]}`}>{value}</span></button>;
}
