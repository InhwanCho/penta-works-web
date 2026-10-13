"use client";

import { DeferredUnreadAlertDot } from "@/components/common/unread-alert-dot";
import { useAuth } from "@/components/provider/auth-provider";
import { defaultPreferences, readDashboardPreferences, writeDashboardPreferences, type DashboardPreferences } from "@/lib/dashboard-preferences";
import PullToRefresh from "@/components/common/pull-to-refresh";
import { SiteAlertSettingsDialog } from "@/components/baselines/site-alert-settings-button";
import AlertSettingsTable, { type AlertSettingsPane } from "@/components/baselines/alert-settings-table";
import DashboardScrollTo from "@/components/dashboard-scroll-to";
import DashboardExcelView from "@/components/dashboard/dashboard-excel-view";
import { dashboardRowStatus, sortDashboardRows } from "@/lib/dashboard-row-order";
import { visibleDashboardSites } from "@/lib/dashboard-site-visibility";
import DashboardHiddenSites from "./dashboard-hidden-sites";
import DashboardSiteFilter from "./dashboard-site-filter";
import DashboardMetricInfo, { type MetricSelection } from "./dashboard-metric-info";
import DashboardLoading from "@/components/dashboard/dashboard-loading";
import {
  type SiteRow,
  useDashboardQuery,
} from "@/hooks/use-dashboard-query";
import Link from "next/link";
import { companyMetrics, dashboardColumns } from "@/lib/company-metrics";
import type { MetricDef } from "@/lib/metrics";
import type { ReactNode } from "react";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const profile = useQuery({queryKey: ["my-profile", userId], queryFn: () => apiFetch<{phone: string | null}>("/auth/profile"), enabled: userId != null});
  const [preferences, setPreferences] = useState<DashboardPreferences>(defaultPreferences);
  const [showColumns, setShowColumns] = useState(false);
  const queryClient = useQueryClient();
  const hiddenSitesKey = ["dashboard-hidden-sites", userId];
  const hiddenSites = useQuery({ queryKey: hiddenSitesKey, queryFn: () => apiFetch<string[]>("/dashboard/hidden-sites"), enabled: userId != null, staleTime: 0 });
  const [linkedSite, setLinkedSite] = useState<string | null>(null);
  const visibilityMutation = useMutation({
    mutationFn: (change: { siteId: string; hidden: boolean } | null) => change
      ? apiFetch<string[]>(`/dashboard/hidden-sites/${encodeURIComponent(change.siteId)}`, {method: "PUT", body: JSON.stringify({hidden: change.hidden})})
      : apiFetch<string[]>("/dashboard/hidden-sites", {method: "DELETE"}),
    onMutate: async () => {
      await queryClient.cancelQueries({queryKey: hiddenSitesKey});
      return { key: hiddenSitesKey, userId };
    },
    onSuccess: (result, _change, context) => {
      if (context) queryClient.setQueryData(context.key, result);
      if (context?.userId === userId) setLinkedSite(null);
    },
  });
  useEffect(() => { setPreferences(userId === undefined ? defaultPreferences : readDashboardPreferences(userId)); }, [userId]);
  const updatePreferences = (next: DashboardPreferences) => { setPreferences(next); if (session) writeDashboardPreferences(session.id, next); };

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  useEffect(() => { if (new URLSearchParams(window.location.search).get("view") === "alerts") setStatusFilter("configured"); }, []);
  const [metricSelection, setMetricSelection] = useState<MetricSelection | null>(null);
  const closeMetricInfo = useCallback(() => setMetricSelection(null), []);
  const inspectMetric = useCallback((row: SiteRow, metric: MetricDef) => setMetricSelection({siteId: row.siteDb, hospital: row.name ?? "병원명 없음", metricKey: metric.key, label: metric.label ?? metric.code}), []);
  const [selectedAlert, setSelectedAlert] = useState<{siteId: string; metricKey?: string; pane?: AlertSettingsPane; onlyMetric?: boolean} | null>(null);
  const openAlertSettings = useCallback((siteId: string, metricKey?: string) => setSelectedAlert({siteId, metricKey}), []);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const closeMobileFilters = useCallback(() => {
    // Release the browser's modal/inert state before React removes the dialog.
    const dialog = document.getElementById("dashboard-mobile-tools") as HTMLDialogElement | null;
    if (dialog?.open) dialog.close();
    setShowMobileFilters(false);
  }, []);
  const alertSettings = useQuery({ queryKey: ["alert-thresholds"], queryFn: () => apiFetch<SiteAlertSettings[]>("/alerts/thresholds"), enabled: statusFilter === "configured", staleTime: 60_000, refetchInterval: 60_000 });

  const changeStatusFilter = useCallback((next: StatusFilter) => {
    closeMobileFilters();
    setStatusFilter(next);
    window.scrollTo({top: 0, behavior: "instant"});
  }, [closeMobileFilters]);

  useEffect(() => {
    const showAll = () => { changeStatusFilter("all"); setLinkedSite(null); setSelectedAlert(null); };
    window.addEventListener("dashboard-show-all", showAll);
    return () => window.removeEventListener("dashboard-show-all", showAll);
  }, [changeStatusFilter]);

  const resetStatusFilter = useCallback((siteId: string) => {
    changeStatusFilter("all");
    setLinkedSite(siteId);
  }, [changeStatusFilter]);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const metrics = useMemo(() => companyMetrics(data?.metricConfig), [data?.metricConfig]);
  const displayedRows = useMemo(() => visibleDashboardSites(data?.rows ?? [], hiddenSites.data ?? [])
    .map(row => ({...row, alertStatus: dashboardRowStatus(row, data?.ctrl ?? {}, metrics)})),
    [data?.rows, data?.ctrl, metrics, hiddenSites.data]);
  const filteredRows = useMemo(() => {
    const currentRows = displayedRows;
    return currentRows.filter((row) => statusFilter === "all" || statusFilter === "configured" ||
      (statusFilter === "issues" && row.alertStatus !== "NORMAL") ||
      (statusFilter === "warning" && row.alertStatus === "WARNING") ||
      (statusFilter === "no-data" && row.alertStatus === "NO_DATA") ||
      (statusFilter === "normal" && row.alertStatus === "NORMAL"));
  }, [displayedRows, statusFilter]);

  const sortedRows = useMemo(
    () => sortDashboardRows(filteredRows, data?.ctrl ?? {}, metrics),
    [filteredRows, data?.ctrl, metrics],
  );

  if (isLoading || (userId != null && hiddenSites.isPending)) {
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
  const dashboardMetrics = metrics;
  const allColumns = dashboardColumns(data.metricConfig);
  const visibleColumns = preferences.columns === null ? allColumns : allColumns.filter(column => preferences.columns!.includes(column.key));
  const displayStats = {
    total: displayedRows.length,
    warning: displayedRows.filter(row => row.alertStatus === "WARNING").length,
    noData: displayedRows.filter(row => row.alertStatus === "NO_DATA").length,
    normal: displayedRows.filter(row => row.alertStatus === "NORMAL").length,
  };
  const viewOptions = <div className="mt-3 space-y-2 text-sm">
    <DashboardSiteFilter rows={data.rows} hiddenSites={hiddenSites.data ?? []} disabled={hiddenSites.isError || visibilityMutation.isPending} onChange={(siteId, hidden) => visibilityMutation.mutate({siteId, hidden})} onRestore={() => visibilityMutation.mutate(null)} />
    {visibilityMutation.isPending && <p role="status" className="text-xs">병원 표시 설정 저장 중…</p>}
    {visibilityMutation.isError && <p role="alert" className="text-xs text-rose-600">저장하지 못했습니다. 다시 시도해주세요.</p>}
    {hiddenSites.isError && <button type="button" onClick={() => hiddenSites.refetch()} className="min-h-11 text-rose-600 underline">병원 표시 설정 불러오기 실패 · 다시 시도</button>}

    <button type="button" aria-expanded={showColumns} onClick={() => setShowColumns(value => !value)} className="min-h-11 rounded-lg border px-3">표시할 열 ({visibleColumns.length})</button>
    {showColumns && <fieldset className="rounded-xl border p-3"><legend>내 전체표 열 선택</legend><div className="grid grid-cols-2 gap-1">{allColumns.map(column => <label key={column.key} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={visibleColumns.some(item => item.key === column.key)} onChange={event => {
      const keys = visibleColumns.map(item => item.key);
      updatePreferences({ ...preferences, columns: event.target.checked ? [...keys, column.key] : keys.filter(key => key !== column.key) });
    }} />{column.displayName}</label>)}</div><button type="button" onClick={() => updatePreferences({ ...preferences, columns: null })} className="min-h-11 text-sky-700 underline">전체 열 복원</button></fieldset>}
    <button type="button" onClick={() => {setStatusFilter("all");}} className="min-h-11 px-3 underline">병원 필터 초기화</button>
  </div>;

  const statusFilterButtons = (
    <>
      <StatusFilterButton active={statusFilter === "all"} onClick={() => changeStatusFilter("all")} label="전체" value={displayStats.total} tone="slate" />
      <StatusFilterButton active={statusFilter === "issues"} onClick={() => changeStatusFilter("issues")} label="이상 병원" value={displayStats.warning + displayStats.noData} tone="rose" />
      <StatusFilterButton active={statusFilter === "warning"} onClick={() => changeStatusFilter("warning")} label="기준 이탈" value={displayStats.warning} tone="amber" />
      <StatusFilterButton active={statusFilter === "no-data"} onClick={() => changeStatusFilter("no-data")} label="수신 중단" value={displayStats.noData} tone="rose" />
      <StatusFilterButton active={statusFilter === "normal"} onClick={() => changeStatusFilter("normal")} label="정상" value={displayStats.normal} tone="emerald" />
      <StatusFilterButton active={statusFilter === "configured"} onClick={() => changeStatusFilter("configured")} label={<>알림값 <DeferredUnreadAlertDot /></>} value="확인" tone="slate" />
    </>
  );

  const mobileControls = (
    <div className="dashboard-compact-controls lg:hidden" data-ptr-ignore>
      {showMobileFilters && <MobileFilterDialog onClose={closeMobileFilters}>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-extrabold">필터</h2><div className="flex gap-2"><button type="button" autoFocus aria-label="필터 패널 닫기" onClick={closeMobileFilters} className="min-h-10 min-w-10 rounded-lg text-xl">×</button></div></div>
        <p className="mt-4 mb-2 text-xs font-bold text-slate-500 dark:text-slate-300">병원 필터 · {STATUS_FILTER_LABEL[statusFilter]}</p>
        <div className="grid grid-cols-2 gap-2">{statusFilterButtons}</div>
        <Link href="/baselines?view=events" className="mt-3 block min-h-11 rounded-xl border px-3 py-3 text-sm font-bold text-sky-700 dark:text-sky-300">알림 관리 · 이력·설정·패턴 →</Link>
        {viewOptions}
      </MobileFilterDialog>}
      <button type="button" aria-label="대시보드 필터" aria-expanded={showMobileFilters} aria-controls="dashboard-mobile-tools" onClick={() => setShowMobileFilters(open => !open)} className="fixed right-0 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-[55] min-h-11 rounded-l-xl border border-slate-200 bg-white/95 px-2 text-xs font-bold text-sky-800 shadow-sm dark:border-white/10 dark:bg-background-dark-card dark:text-sky-200">필터 {showMobileFilters ? "›" : "‹"}{statusFilter !== "all" && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-sky-500" aria-label={`${STATUS_FILTER_LABEL[statusFilter]} ${sortedRows.length}개`} />}</button>
    </div>
  );

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      disabled={showMobileFilters}
      topOffset={56}
    >
      <main className={`dashboard-layout mobile-safe-inline mx-auto w-full max-w-7xl px-[4px] pt-[8px] pb-[2px] lg:px-6 lg:py-5 flex min-h-0 flex-col`}>
        {profile.isSuccess && !/^01[016789][0-9]{7,8}$/.test((profile.data.phone ?? "").replace(/[-\s]/g, "")) && <Link href="/account" className="mb-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">휴대폰 번호를 등록해야 카카오톡·문자 알림을 받을 수 있습니다. 내 계정에서 등록하기 →</Link>}
        {linkedSite && data.rows.some(row => (row.siteDb === linkedSite || row.siteSlug === String(Number(linkedSite))) && (hiddenSites.data ?? []).includes(row.siteDb)) && <p role="status" className="mb-2 p-2 text-sm text-amber-700">이 링크의 병원은 숨김·알림 중지 상태입니다. 아래 ‘숨긴 병원’에서 다시 표시할 수 있습니다.</p>}
        <Suspense fallback={null}><DashboardScrollTo offset={80} onTargetRequested={resetStatusFilter} /></Suspense>

        <header className="dashboard-expanded-header mb-3 hidden shrink-0 flex-wrap items-center justify-between gap-2 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 px-3 py-2 shadow-[0_10px_35px_rgba(22,58,82,0.07)] backdrop-blur-sm lg:flex lg:mb-5 lg:gap-4 lg:rounded-3xl lg:px-5 lg:py-4 dark:border-white/8 dark:bg-background-dark-card/90">
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
        <details className="dashboard-expanded-filters mb-3 hidden shrink-0 rounded-xl border p-3 lg:block"><summary className="cursor-pointer text-sm font-bold">필터</summary>{viewOptions}</details>

        {isError && <p role="status" className="dashboard-compact-feedback mb-2 px-1 text-xs font-bold text-amber-700 lg:hidden dark:text-amber-300">연결 실패 · 마지막으로 받은 화면입니다.</p>}

        <section className="dashboard-expanded-status mb-5 hidden shrink-0 grid-cols-6 gap-2 lg:grid" aria-label="상태별 병원 필터">
          {statusFilterButtons}
        </section>

        {statusFilter === "configured" ? (
          <section className="space-y-3">
            <Link href="/baselines" className="hidden min-h-12 py-3 text-base font-bold text-sky-700 lg:inline-block dark:text-sky-300">알림 관리에서 전체 설정 보기 →</Link>
            {alertSettings.isPending ? <p className="p-4 text-sm">설정 불러오는 중…</p> : alertSettings.isError ? <button type="button" className="min-h-11 p-3 text-sm text-rose-600" onClick={() => alertSettings.refetch()}>설정을 불러오지 못했습니다. 다시 시도</button> : (
              <AlertSettingsTable entries={sortedRows.map(row => alertSettings.data?.find(site => site.siteid === row.siteDb)).filter((site): site is SiteAlertSettings => Boolean(site))} metrics={dashboardMetrics} onOpen={(site,metricKey,pane)=>setSelectedAlert({siteId:site.siteid,metricKey,pane,onlyMetric:!!metricKey && !metricKey.startsWith("__")})} />
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
            emptyMessage={displayedRows.length === 0 && data.rows.length > 0 ? "모든 병원을 숨겼습니다. 필터에서 표시할 병원을 선택해주세요." : data.rows.length === 0 ? "표시할 병원이 없습니다. 병원 표시 설정이나 연결 상태를 확인해주세요." : `${STATUS_FILTER_LABEL[statusFilter]} 조건에 맞는 병원이 없습니다.`}
            onResetFilters={() => {setStatusFilter("all"); if (displayedRows.length === 0) visibilityMutation.mutate(null);}}
          />
        )}
        <DashboardHiddenSites rows={data.rows.filter(row => (hiddenSites.data ?? []).includes(row.siteDb))} saving={visibilityMutation.isPending} error={visibilityMutation.isError} onShow={siteId => visibilityMutation.mutate({siteId, hidden: false})} />
        <p className="dashboard-compact-feedback text-text-secondary mt-1 shrink-0 px-1 text-center text-[10px] leading-3 lg:hidden dark:text-text-dark-primary/70">
          화면 갱신 {fmtYmdHms(meta.nowMs)} · 5분마다 자동 갱신{data.stats.openAlerts > 0 ? ` · 진행 중 알림 ${data.stats.openAlerts}건` : ""}
        </p>
        {metricSelection && <DashboardMetricInfo selection={metricSelection} onClose={closeMetricInfo} onEdit={() => { setSelectedAlert({siteId: metricSelection.siteId, metricKey: metricSelection.metricKey, onlyMetric: true}); closeMetricInfo(); }} />}
        {selectedAlert && <SiteAlertSettingsDialog key={`${selectedAlert.siteId}:${selectedAlert.metricKey ?? ""}`} siteId={selectedAlert.siteId} initialMetricKey={selectedAlert.metricKey} initialPane={selectedAlert.pane} onlyMetricKey={selectedAlert.onlyMetric ? selectedAlert.metricKey : undefined} onClose={() => setSelectedAlert(null)} />}
      </main>
      {mobileControls}
    </PullToRefresh>
  );
}

function StatusFilterButton({ active, onClick, label, value, tone }: { active: boolean; onClick: () => void; label: ReactNode; value: number | string; tone: "slate" | "rose" | "amber" | "emerald" }) {
  const colors = { slate: "text-slate-600 dark:text-slate-300", rose: "text-rose-600 dark:text-rose-300", amber: "text-amber-600 dark:text-amber-300", emerald: "text-emerald-600 dark:text-emerald-300" };
  return <button type="button" onClick={onClick} className={`cursor-pointer rounded-2xl border bg-white px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 dark:bg-background-dark-card ${active ? "border-sky-400 ring-2 ring-sky-100 dark:border-sky-500 dark:ring-sky-950" : "border-slate-200/80 dark:border-white/8"}`}><span className="text-text-secondary block text-[11px] font-bold">{label}</span><span className={`mt-0.5 block text-xl font-extrabold tabular-nums ${colors[tone]}`}>{value}</span></button>;
}

function MobileFilterDialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    const desktop = window.matchMedia("(min-width: 1024px) and (min-height: 761px)");
    const closeOnDesktop = () => { if (desktop.matches) onCloseRef.current(); };
    desktop.addEventListener("change", closeOnDesktop);
    closeOnDesktop();
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return <dialog ref={dialogRef} id="dashboard-mobile-tools" aria-label="대시보드 필터" aria-modal="true" data-ptr-ignore
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}
    className="fixed inset-x-3 top-auto bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] m-0 mx-auto max-h-[70dvh] w-[calc(100%-1.5rem)] max-w-sm overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-4 text-text-major shadow-xl backdrop:bg-slate-900/30 backdrop:backdrop-blur-sm dark:border-white/10 dark:bg-background-dark-card dark:text-text-dark-primary">
    {children}
  </dialog>;
}
