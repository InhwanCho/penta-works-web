"use client";

import PullToRefresh from "@/components/common/pull-to-refresh";
import DashboardScrollTo from "@/components/dashboard-scroll-to";
import DashboardExcelView from "@/components/dashboard/dashboard-excel-view";
import ChevronRightIcon from "@/components/icons/chevron-right-icon";
import ThreeDotLoader from "@/components/icons/three-dot-loader";
import {
  type CtrlRange,
  type SiteRow,
  useDashboardQuery,
} from "@/hooks/use-dashboard-query";
import Link from "next/link";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

/** 기본 뷰 / 관리자 뷰(엑셀형 전체 지표) */
type ViewMode = "basic" | "grid";
type StatusFilter = "all" | "issues" | "warning" | "no-data" | "normal";

const VIEW_MODE_STORAGE_KEY = "dashboard-view-mode-v2";

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

function fmtNum(v: number | null, suffix?: string) {
  if (v == null || Number.isNaN(v)) return "-";
  return suffix ? `${v}${suffix}` : String(v);
}

function isOutOfRange(
  v: number | null,
  low: number | null,
  high: number | null,
) {
  if (v == null || Number.isNaN(v)) return false;
  if (low != null && v < low) return true;
  if (high != null && v > high) return true;
  return false;
}

function fmtYmdHms(ms: number) {
  const d = new Date(ms);
  return `${fmtYmd(d)} ${fmtHms(d)}`;
}

export default function DashboardClient() {
  const { data, isLoading, isError, error, refetch } = useDashboardQuery();

  // 전체 지표를 한눈에 보는 관리자 뷰를 기본으로 사용합니다.
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (isViewMode(saved)) setViewMode(saved);
  }, []);

  const changeViewMode = useCallback((next: ViewMode) => {
    setViewMode(next);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, next);
  }, []);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const filteredRows = useMemo(() => {
    const currentRows = data?.rows ?? [];
    return currentRows.filter((row) => statusFilter === "all" ||
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
    return (
      <main className="mx-auto flex h-[90vh] w-full items-center justify-center">
        <ThreeDotLoader size="xl" />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 lg:px-6">
        <div className="rounded-lg border border-red-200 bg-red-50/60 p-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          데이터를 불러오지 못했습니다.{" "}
          {String((error as Error)?.message ?? "알 수 없는 오류")}
        </div>
      </main>
    );
  }

  const { meta, ctrl } = data;

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      topOffset={56}
    >
      <main className="mobile-safe-inline mx-auto w-full max-w-7xl px-[4px] py-[8px] sm:px-4 sm:py-4 lg:px-6 lg:py-5">
        <DashboardScrollTo offset={80} />

        <header className="mb-3 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 px-4 py-4 shadow-[0_10px_35px_rgba(22,58,82,0.07)] backdrop-blur-sm sm:mb-5 sm:px-5 dark:border-white/8 dark:bg-background-dark-card/90">
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
            </div>
          </div>

          <ViewModeTabs
            value={viewMode}
            onChange={changeViewMode}
          />
        </header>

        <section className="mb-3 grid grid-cols-2 gap-2 sm:mb-5 sm:grid-cols-5">
          <StatusFilterButton active={statusFilter === "all"} onClick={() => setStatusFilter("all")} label="전체" value={data.stats.totalSites} tone="slate" />
          <StatusFilterButton active={statusFilter === "issues"} onClick={() => setStatusFilter("issues")} label="이상 병원" value={data.stats.warningSites + data.stats.noDataSites} tone="rose" />
          <StatusFilterButton active={statusFilter === "warning"} onClick={() => setStatusFilter("warning")} label="기준 이탈" value={data.stats.warningSites} tone="amber" />
          <StatusFilterButton active={statusFilter === "no-data"} onClick={() => setStatusFilter("no-data")} label="수신 중단" value={data.stats.noDataSites} tone="rose" />
          <StatusFilterButton active={statusFilter === "normal"} onClick={() => setStatusFilter("normal")} label="정상" value={data.stats.normalSites} tone="emerald" />
        </section>

        {viewMode === "grid" ? (
          <DashboardExcelView
            rows={sortedRows}
            ctrl={ctrl}
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <section className="md:hidden">
              {sortedRows.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-2">
                  {sortedRows.map((r) => {
                    return (
                      <SiteCard
                        key={r.siteDb}
                        row={r}
                        range={ctrl[r.siteDb] ?? null}
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
                        <Th>최신 시각</Th>
                        <Th className="text-right">hePsi</Th>
                        <Th className="text-right">he%</Th>
                        <Th className="text-right" />
                      </tr>
                    </thead>

                    <tbody>
                      {sortedRows.map((r) => {
                        const lastAtDate = parseIso(r.lastAt);
                        const range = ctrl[r.siteDb] ?? null;

                        const hePsiAlert = isOutOfRange(
                          r.hePsi,
                          range?.mrplel ?? null,
                          range?.mrpleh ?? null,
                        );
                        const hePctAlert = isOutOfRange(
                          r.hePct,
                          range?.mrlevl ?? null,
                          range?.mrlevh ?? null,
                        );

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

                            <Td
                              className={[
                                "text-right whitespace-nowrap tabular-nums",
                                hePsiAlert
                                  ? "font-semibold text-red-600 dark:text-red-400"
                                  : "text-text-major dark:text-text-dark-primary/90",
                              ].join(" ")}
                            >
                              {fmtNum(r.hePsi)}
                            </Td>

                            <Td
                              className={[
                                "text-right whitespace-nowrap tabular-nums",
                                hePctAlert
                                  ? "font-semibold text-red-600 dark:text-red-400"
                                  : "text-text-major dark:text-text-dark-primary/90",
                              ].join(" ")}
                            >
                              {fmtNum(r.hePct, "%")}
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
        label="관리자 뷰"
      />
      <ViewModeTab
        active={value === "basic"}
        onClick={() => onChange("basic")}
        label="간단 보기"
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

function SiteCard({ row, range }: { row: SiteRow; range: CtrlRange | null }) {
  const hePsiAlert = isOutOfRange(
    row.hePsi,
    range?.mrplel ?? null,
    range?.mrpleh ?? null,
  );
  const hePctAlert = isOutOfRange(
    row.hePct,
    range?.mrlevl ?? null,
    range?.mrlevh ?? null,
  );

  const anyAlert = row.alertStatus !== "NORMAL" || hePsiAlert || hePctAlert;
  const d = parseIso(row.lastAt);

  return (
    <Link
      href={`/sites/${row.siteSlug}`}
      id={`site-m-${row.siteSlug}`}
      className={[
        "group block scroll-mt-[120px] rounded-2xl border bg-white p-4 shadow-[0_6px_24px_rgba(22,58,82,0.06)] transition-all active:scale-[0.997]",
        "hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_12px_34px_rgba(22,58,82,0.1)] dark:hover:border-sky-900/60",
        "dark:border-background-dark-secondary dark:bg-background-dark-card",
        anyAlert ? "border-red-300/80 dark:border-red-900/50" : "border-border",
      ].join(" ")}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center">
          <span
            className="text-text-major dark:text-text-dark-primary truncate text-[15px] font-semibold"
            title={row.name ?? ""}
          >
            {row.name ?? "-"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <AlertStatusBadge row={row} />
          <ChevronRightIcon className="text-text-secondary/60 dark:text-text-dark-primary/40 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      {row.alertIssues.length > 0 && <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 dark:bg-rose-950/25"><p className="line-clamp-2 text-xs font-semibold text-rose-700 dark:text-rose-300">{row.alertIssues.slice(0, 2).map((issue) => issue.message).join(" · ")}</p>{row.alertIssues.length > 2 && <p className="mt-1 text-[10px] font-bold text-rose-500">외 {row.alertIssues.length - 2}건</p>}</div>}

      {/* Divider */}
      <div className="bg-border/50 dark:bg-background-dark-secondary/60 my-3 h-px" />

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50/75 p-2.5 dark:bg-white/3">
        <MetricCol
          label="최신 시각"
          value={
            <span className="text-text-major dark:text-text-dark-primary text-sm leading-tight font-semibold tabular-nums">
              <span className="block">{fmtYmd(d)}</span>
              <span className="text-text-secondary dark:text-text-dark-primary/70 mt-0.5 block text-xs font-medium">
                {fmtHms(d)}
              </span>
            </span>
          }
        />
        <MetricCol
          label="hePsi"
          value={
            <span
              className={[
                "text-lg font-semibold tabular-nums",
                hePsiAlert
                  ? "text-red-600 dark:text-red-400"
                  : "text-text-major dark:text-text-dark-primary",
              ].join(" ")}
            >
              {fmtNum(row.hePsi)}
            </span>
          }
        />
        <MetricCol
          label="he%"
          value={
            <span
              className={[
                "text-lg font-semibold tabular-nums",
                hePctAlert
                  ? "text-red-600 dark:text-red-400"
                  : "text-text-major dark:text-text-dark-primary",
              ].join(" ")}
            >
              {fmtNum(row.hePct, "%")}
            </span>
          }
        />
      </div>
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
