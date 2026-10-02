"use client";

import PullToRefresh from "@/components/common/pull-to-refresh";
import SiteAlertSettingsButton from "@/components/baselines/site-alert-settings-button";
import DashboardScrollTo from "@/components/dashboard-scroll-to";
import DashboardExcelView from "@/components/dashboard/dashboard-excel-view";
import CollectionStatus, { collectionMissing } from "@/components/dashboard/collection-status";
import ChevronRightIcon from "@/components/icons/chevron-right-icon";
import DashboardLoading from "@/components/dashboard/dashboard-loading";
import {
  type CtrlRange,
  type SiteRow,
  useDashboardQuery,
} from "@/hooks/use-dashboard-query";
import Link from "next/link";
import type React from "react";
import { companyMetrics, dashboardColumns } from "@/lib/company-metrics";
import { formatMetricMeasurement, isMetricOutOfRange, type MetricDef } from "@/lib/metrics";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, type SiteAlertSettings } from "@/lib/api";

/** 기본 뷰 / 관리자 뷰(엑셀형 전체 지표) */
type ViewMode = "basic" | "grid";
type StatusFilter = "all" | "issues" | "warning" | "no-data" | "normal" | "configured";
const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: "전체",
  issues: "이상 병원",
  warning: "기준 이탈",
  "no-data": "수신 중단",
  normal: "정상",
  configured: "알림값 확인",
};

const VIEW_MODE_STORAGE_KEY = "dashboard-view-mode-v2";
const MOBILE_VIEW_MODE_STORAGE_KEY = "dashboard-mobile-view-mode-v2";

function isViewMode(v: unknown): v is ViewMode {
  return v === "basic" || v === "grid";
}

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

function parseIso(iso: string | null) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
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

function formatAlertBound(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "—" : value.toLocaleString("ko-KR", {maximumFractionDigits:6});
}

export default function DashboardClient() {
  const { data, isLoading, isError, error, refetch } = useDashboardQuery();

  // 전체 지표를 한눈에 보는 관리자 뷰를 기본으로 사용합니다.
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const alertSettings = useQuery({ queryKey: ["alert-thresholds"], queryFn: () => apiFetch<SiteAlertSettings[]>("/alerts/thresholds"), enabled: statusFilter === "configured", staleTime: 60_000, refetchInterval: 60_000 });

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 639px)").matches;
    try {
      const saved = localStorage.getItem(mobile ? MOBILE_VIEW_MODE_STORAGE_KEY : VIEW_MODE_STORAGE_KEY);
      if (isViewMode(saved)) setViewMode(saved);
    } catch { /* Use the device default if storage is unavailable. */ }
  }, []);

  const changeViewMode = useCallback((next: ViewMode) => {
    setViewMode(next);
    try {
      const mobile = window.matchMedia("(max-width: 639px)").matches;
      localStorage.setItem(mobile ? MOBILE_VIEW_MODE_STORAGE_KEY : VIEW_MODE_STORAGE_KEY, next);
    } catch { /* The selected view still works without storage. */ }
  }, []);

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
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 lg:px-6">
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
  const helium = ["hepres", "heleve"].flatMap((key) => metrics.filter((metric) => metric.key === key));
  const dashboardMetrics = metrics;
  const summaryMetrics = helium.length ? helium : metrics.slice(0, 2);
  const statusFilterButtons = (
    <>
      <StatusFilterButton active={statusFilter === "all"} onClick={() => changeStatusFilter("all")} label="전체" value={data.stats.totalSites} tone="slate" />
      <StatusFilterButton active={statusFilter === "issues"} onClick={() => changeStatusFilter("issues")} label="이상 병원" value={data.stats.warningSites + data.stats.noDataSites} tone="rose" />
      <StatusFilterButton active={statusFilter === "warning"} onClick={() => changeStatusFilter("warning")} label="기준 이탈" value={data.stats.warningSites} tone="amber" />
      <StatusFilterButton active={statusFilter === "no-data"} onClick={() => changeStatusFilter("no-data")} label="수신 중단" value={data.stats.noDataSites} tone="rose" />
      <StatusFilterButton active={statusFilter === "normal"} onClick={() => changeStatusFilter("normal")} label="정상" value={data.stats.normalSites} tone="emerald" />
      <button type="button" onClick={() => changeStatusFilter("configured")} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold ${statusFilter === "configured" ? "border-sky-500 bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200" : "border-slate-200 bg-white dark:border-white/10 dark:bg-background-dark-card"}`}>알림값 확인</button>
    </>
  );

  const mobileControls = (
    <div className={`${viewMode === "basic" ? "mb-3" : "mt-3"} space-y-2 px-1 sm:hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ViewModeTabs value={viewMode} onChange={changeViewMode} />
            <button
              type="button"
              aria-controls="dashboard-mobile-status-filters"
              aria-expanded={showMobileFilters}
              onClick={() => setShowMobileFilters((open) => !open)}
              className="min-h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-text-major dark:border-white/10 dark:bg-background-dark-card dark:text-text-dark-primary"
            >
              필터 · {STATUS_FILTER_LABEL[statusFilter]}
            </button>
          </div>
          <section id="dashboard-mobile-status-filters" className={`${showMobileFilters ? "grid" : "hidden"} grid-cols-2 gap-2`} aria-label="상태별 병원 필터">
            {statusFilterButtons}
          </section>
        </div>
  );

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      topOffset={56}
    >
      <main className="mobile-safe-inline mx-auto w-full max-w-7xl px-[4px] py-[8px] sm:px-4 sm:py-4 lg:px-6 lg:py-5">
        <Suspense fallback={null}><DashboardScrollTo offset={80} onTargetRequested={resetStatusFilter} /></Suspense>

        <header className="mb-3 hidden flex-wrap items-center justify-between gap-2 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 px-3 py-2 shadow-[0_10px_35px_rgba(22,58,82,0.07)] backdrop-blur-sm sm:flex lg:mb-5 lg:gap-4 lg:rounded-3xl lg:px-5 lg:py-4 dark:border-white/8 dark:bg-background-dark-card/90">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-50 dark:from-sky-950 dark:to-cyan-950">
              <span className="absolute h-3 w-3 animate-ping rounded-full bg-emerald-400/50" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <div className="min-w-0">
            <h1 className="text-text-major dark:text-text-dark-primary text-xl font-extrabold tracking-tight sm:text-2xl">
              실시간 현황
            </h1>
            <p className="text-text-secondary dark:text-text-dark-primary/70 mt-0.5 text-[0.8125rem] font-medium">
              마지막 갱신{" "}
              <span className="tabular-nums">{fmtYmdHms(meta.nowMs)}</span>{data.stats.openAlerts > 0 && <span className="ml-2 font-bold text-rose-600 dark:text-rose-300">· 진행 중 알림 {data.stats.openAlerts}건</span>}
            </p>
            {isError && <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">연결 실패 · 마지막으로 받은 화면입니다.</p>}
            </div>
          </div>

          <ViewModeTabs
            value={viewMode}
            onChange={changeViewMode}
          />
        </header>

        {viewMode === "basic" && mobileControls}
        {isError && <p role="status" className="mb-2 px-1 text-xs font-bold text-amber-700 sm:hidden dark:text-amber-300">연결 실패 · 마지막으로 받은 화면입니다.</p>}

        <section className="mb-5 hidden grid-cols-6 gap-2 sm:grid" aria-label="상태별 병원 필터">
          {statusFilterButtons}
        </section>

        {statusFilter === "configured" ? (
          <section className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-background-dark-card">
            <div className="p-3"><h2 className="font-extrabold">병원별 알림 적용 항목</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-300">켜진 항목의 실제 적용 범위입니다. —는 비활성 항목입니다. 전체 알림이 꺼진 병원은 발송되지 않습니다.</p><Link href="/baselines" className="mt-2 inline-block text-sm font-bold text-sky-700 dark:text-sky-300">알림값 설정으로 이동 →</Link></div>
            {alertSettings.isPending ? <p className="p-4 text-sm">설정 불러오는 중…</p> : alertSettings.isError ? <button type="button" className="min-h-11 p-3 text-sm text-rose-600" onClick={() => alertSettings.refetch()}>설정을 불러오지 못했습니다. 다시 시도</button> : (
              <div className="max-h-[70dvh] overflow-auto"><table className="w-full border-collapse whitespace-nowrap text-xs"><thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800"><tr><th className="sticky left-0 z-30 bg-slate-100 p-3 text-left dark:bg-slate-800">병원명</th>{dashboardMetrics.map(metric => <th key={metric.key} className="p-3">{metric.label ?? metric.code}</th>)}<th className="p-3">연속 수집 누락</th><th className="p-3">콜드칠러 정지</th><th className="p-3">반복</th></tr></thead><tbody>
                {(alertSettings.data ?? []).map(site => <tr key={site.siteid} className={`border-t border-slate-200 dark:border-white/10 ${!site.alertsEnabled ? "text-slate-400" : ""}`}><th className="sticky left-0 z-10 bg-white p-3 text-left dark:bg-background-dark-card"><span className="block">{site.name ?? site.siteid}</span><div className="my-1"><SiteAlertSettingsButton siteId={site.siteid} /></div><span className={`text-[10px] ${site.alertsEnabled ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>{site.alertsEnabled ? "알림 켜짐" : "전체 알림 꺼짐"}</span></th>{dashboardMetrics.map(metric => { const threshold = site.thresholds.find(item => item.key === metric.key); return <td key={metric.key} className="p-3 text-center">{threshold?.active ? <span className={`inline-block rounded-lg px-2 py-1 ${site.alertsEnabled ? "bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-200" : "bg-slate-100 dark:bg-slate-800"}`}>{formatAlertBound(threshold.effectiveMin)} – {formatAlertBound(threshold.effectiveMax)}<small className="block">{threshold.unit}{threshold.averageApplied ? " · 24h 평균" : ""}</small></span> : "—"}</td>; })}<td className="p-3 text-center">{site.noDataActive ? `${site.collectionIntervalMinutes}분 · ${site.missingCollectionThreshold}회` : "—"}</td><td className="p-3 text-center">{site.coldChillerActive ? "IN = OUT" : "—"}</td><td className="p-3 text-center">{site.repeatMinutes > 0 ? `${site.repeatMinutes}분` : "최초 1회"}</td></tr>)}
              </tbody></table></div>
            )}
          </section>
        ) : viewMode === "grid" ? (
              <DashboardExcelView
            rows={sortedRows}
            ctrl={ctrl}
            metrics={dashboardMetrics}
            columns={dashboardColumns(data.metricConfig)}
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <section className="md:hidden">
              {sortedRows.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-2 px-1">
                  {sortedRows.map((r) => {
                    return (
                      <SiteCard
                        key={r.siteDb}
                        row={r}
                        range={ctrl[r.siteDb] ?? null}
                        metrics={summaryMetrics}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            {/* Desktop: table */}
            <section className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(22,58,82,0.06)] md:block dark:border-white/8 dark:bg-background-dark-card">
              {sortedRows.length === 0 ? (
                <div className="py-12">
        <EmptyState />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-sm">
                    <thead className="bg-background-primary/60 text-text-secondary dark:border-background-dark-secondary dark:bg-background-dark-secondary/40 dark:text-text-dark-primary/70 border-b">
                      <tr>
                        <Th>병원명</Th>
                        {summaryMetrics.map((metric) => <Th key={metric.key} className="text-right">{metric.label ?? metric.code}</Th>)}
                        <Th>최신 시각</Th>
                        <Th className="text-right" />
                      </tr>
                    </thead>

                    <tbody>
                      {sortedRows.map((r) => {
                        const lastAtDate = parseIso(r.lastAt);
                        const range = ctrl[r.siteDb] ?? null;

                        return (
                          <tr
                            key={r.siteDb}
                            id={`site-d-${r.siteSlug}`}
                            className="dark:border-background-dark-secondary hover:bg-background-primary/40 dark:hover:bg-background-dark-secondary/30 scroll-mt-[120px] border-b transition-colors last:border-b-0"
                          >
                            <Td className="text-text-major dark:text-text-dark-primary font-medium">
                              <div className="flex items-center gap-2"><span>{r.name ?? "-"}</span><AlertStatusBadge row={r} /></div>
                              {r.alertIssues[0] && <p className="text-text-secondary mt-1 max-w-72 truncate text-[11px]" title={r.alertIssues.map((issue) => issue.message).join("\n")}>{r.alertIssues[0].message}</p>}
                            </Td>

                            {summaryMetrics.map((metric) => <Td key={metric.key} className={`text-right whitespace-nowrap tabular-nums ${isMetricOutOfRange(r.metrics[metric.key], metric.bound, range) ? "font-semibold text-red-600 dark:text-red-400" : "text-text-major dark:text-text-dark-primary/90"}`}>
                              {formatMetricMeasurement(r.metrics[metric.key], metric.unit, r.lastAt != null, "-")}
                            </Td>)}

                            <Td className="text-text-secondary dark:text-text-dark-primary/70 whitespace-nowrap tabular-nums">
                              <div className="leading-tight">
                                <div className="text-xs font-medium">
                                  {fmtYmd(lastAtDate)}
                                </div>
                                <div className="mt-0.5 text-[11px] opacity-70">
                                  {fmtHms(lastAtDate)}
                                </div>
                              </div>
                            </Td>

                            <Td className="text-right">
                              <Link
                                className="text-text-secondary hover:bg-background-tertiary hover:text-text-major dark:text-text-dark-primary/60 dark:hover:bg-background-dark-secondary dark:hover:text-text-dark-primary inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
                                href={`/sites/${r.siteSlug}`}
                                aria-label={`${r.name ?? "병원"} 상세 보기`}
                              >
                                <ChevronRightIcon className="h-4 w-4" />
                              </Link>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
        {viewMode === "grid" && mobileControls}
        <p className="text-text-secondary mt-2 px-1 text-xs sm:hidden dark:text-text-dark-primary/70">
          마지막 갱신 {fmtYmdHms(meta.nowMs)}{data.stats.openAlerts > 0 ? ` · 진행 중 알림 ${data.stats.openAlerts}건` : ""}
        </p>
      </main>
    </PullToRefresh>
  );
}

function ViewModeTabs({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (next: ViewMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="대시보드 보기 방식"
      className="inline-flex min-h-10 items-center rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1 text-sm dark:border-white/8 dark:bg-white/5"
    >
      <ViewModeTab
        active={value === "grid"}
        onClick={() => onChange("grid")}
        label="전체 표"
      />
      <ViewModeTab
        active={value === "basic"}
        onClick={() => onChange("basic")}
        label="요약 보기"
      />
    </div>
  );
}

function StatusFilterButton({ active, onClick, label, value, tone }: { active: boolean; onClick: () => void; label: string; value: number; tone: "slate" | "rose" | "amber" | "emerald" }) {
  const colors = { slate: "text-slate-600 dark:text-slate-300", rose: "text-rose-600 dark:text-rose-300", amber: "text-amber-600 dark:text-amber-300", emerald: "text-emerald-600 dark:text-emerald-300" };
  return <button type="button" onClick={onClick} className={`cursor-pointer rounded-2xl border bg-white px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 dark:bg-background-dark-card ${active ? "border-sky-400 ring-2 ring-sky-100 dark:border-sky-500 dark:ring-sky-950" : "border-slate-200/80 dark:border-white/8"}`}><span className="text-text-secondary block text-[11px] font-bold">{label}</span><span className={`mt-0.5 block text-xl font-extrabold tabular-nums ${colors[tone]}`}>{value}</span></button>;
}

function ViewModeTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "inline-flex min-h-8 shrink-0 cursor-pointer items-center justify-center rounded-xl px-2.5 text-sm font-bold whitespace-nowrap transition-all sm:px-3",
        active
          ? "bg-white text-[#174d70] shadow-sm dark:bg-sky-800 dark:text-white"
          : "text-text-secondary hover:text-text-major dark:text-text-dark-primary/60 dark:hover:text-text-dark-primary",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

/* ---- 이하 UI 컴포넌트 ---- */

function EmptyState() {
  return (
    <div className="text-text-secondary dark:text-text-dark-primary/60 py-12 text-center text-sm">
      데이터가 없습니다.
    </div>
  );
}

function SiteCard({ row, range, metrics }: { row: SiteRow; range: CtrlRange | null; metrics: MetricDef[] }) {
  const anyAlert = row.alertStatus !== "NORMAL" || metrics.some((metric) => isMetricOutOfRange(row.metrics[metric.key], metric.bound, range));
  const d = parseIso(row.lastAt);

  return (
    <Link
      href={`/sites/${row.siteSlug}`}
      id={`site-m-${row.siteSlug}`}
      aria-label={`${row.name ?? "병원"} 상세 보기`}
      className={[
        "group block scroll-mt-[120px] rounded-2xl border bg-white p-3 shadow-sm transition-colors active:bg-sky-50 dark:active:bg-sky-950/20",
        "hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_12px_34px_rgba(22,58,82,0.1)] dark:hover:border-sky-900/60",
        "dark:border-background-dark-secondary dark:bg-background-dark-card",
        collectionMissing(row) ? "border-rose-400 ring-2 ring-rose-200 dark:ring-rose-900" : anyAlert ? "border-red-300/80 dark:border-red-900/50" : "border-border",
      ].join(" ")}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col items-start">
          <span
            className="text-text-major dark:text-text-dark-primary line-clamp-2 text-base font-bold"
            title={row.name ?? ""}
          >
            {row.name ?? "-"}
          </span>
          <span className="text-text-secondary mt-1 text-[11px] tabular-nums dark:text-text-dark-primary/70">최근 수집 {fmtYmd(d)} {fmtHms(d)}</span>
          <CollectionStatus row={row} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <AlertStatusBadge row={row} />
          <ChevronRightIcon className="text-text-secondary/60 dark:text-text-dark-primary/40 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      {/* Metrics */}
      <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-50/75 p-3 dark:bg-white/3">
        {metrics.map((metric) => <MetricCol key={metric.key} label={metric.label ?? metric.code}
          value={<span className={`text-2xl font-bold tabular-nums ${isMetricOutOfRange(row.metrics[metric.key], metric.bound, range) ? "text-red-600 dark:text-red-400" : "text-text-major dark:text-text-dark-primary"}`}>
            {formatMetricMeasurement(row.metrics[metric.key], metric.unit, row.lastAt != null, "-")}
          </span>}
        />)}
      </div>
      {row.alertIssues.length > 0 && <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-rose-700 dark:text-rose-300">{row.alertIssues[0].message}{row.alertIssues.length > 1 ? ` · 외 ${row.alertIssues.length - 1}건` : ""}</p>}
    </Link>
  );
}

function AlertStatusBadge({ row }: { row: SiteRow }) {
  if (row.alertStatus === "NO_DATA") return <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-extrabold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">수신 중단 {row.openAlertCount}</span>;
  if (row.alertStatus === "WARNING") return <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-extrabold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">기준 이탈 {row.openAlertCount}</span>;
  return <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">정상</span>;
}

function MetricCol({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-text-secondary dark:text-text-dark-primary/70 text-sm font-medium">
        {label}
      </div>
      <div className="mt-1">{value}</div>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={[
        "px-4 py-2.5 text-left text-sm font-bold tracking-wide whitespace-nowrap",
        className,
      ].join(" ")}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      className={["px-4 py-3 whitespace-nowrap", className].join(" ")}
      colSpan={colSpan}
    >
      {children}
    </td>
  );
}
