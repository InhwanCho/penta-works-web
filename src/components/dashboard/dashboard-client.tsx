"use client";

import PullToRefresh from "@/components/common/pull-to-refresh";
import DashboardScrollTo from "@/components/dashboard-scroll-to";
import ChevronRightIcon from "@/components/icons/chevron-right-icon";
import ThreeDotLoader from "@/components/icons/three-dot-loader";
import {
  type CtrlRange,
  type SiteRow,
  useDashboardQuery,
} from "@/hooks/use-dashboard-query";
import Link from "next/link";
import type React from "react";
import { useCallback, useMemo } from "react";

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

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const filteredRows = useMemo(() => {
    const currentRows = data?.rows ?? [];
    return currentRows.filter((r) => !!r.lastAt);
  }, [data?.rows]);

  const sortedRows = useMemo(
    () => filteredRows.slice().sort(compareSite),
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
      <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
        <div className="rounded-lg border border-red-200 bg-red-50/60 p-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          데이터를 불러오지 못했습니다.{" "}
          {String((error as Error)?.message ?? "알 수 없는 오류")}
        </div>
      </main>
    );
  }

  const { meta, ctrl, stats } = data;

  return (
    <PullToRefresh onRefresh={handleRefresh} topOffset={56}>
    <main className="mx-auto w-full max-w-6xl px-4 py-5 lg:px-8 lg:py-8">
      <DashboardScrollTo offset={80} />

      <header className="mb-5 lg:mb-6">
        <h1 className="text-text-major dark:text-text-dark-primary text-xl font-semibold tracking-tight lg:text-2xl">
          대시보드
        </h1>
        <p className="text-text-secondary dark:text-text-dark-primary/60 mt-1 text-sm">
          업데이트 <span className="tabular-nums">{fmtYmdHms(meta.nowMs)}</span>
        </p>
      </header>

      {/* 요약 카드 */}
      <section className="mb-5 grid grid-cols-3 gap-2 sm:gap-3 lg:mb-6">
        <SummaryCard label="전체" value={stats.totalSites} tone="neutral" />
        <SummaryCard label="정상 (1시간)" value={stats.active1h} tone="ok" />
        <SummaryCard
          label="미수집 (24시간)"
          value={stats.stale24h}
          tone={stats.stale24h > 0 ? "warn" : "neutral"}
        />
      </section>

      {/* Mobile: cards */}
      <section className="md:hidden">
        {sortedRows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {sortedRows.map((r) => {
              const lastAtMs = r.lastAt ? Date.parse(r.lastAt) : null;
              const isActive1h = !!lastAtMs && lastAtMs >= meta.since1hMs;
              const isActive24h = !!lastAtMs && lastAtMs >= meta.since24hMs;

              return (
                <SiteCard
                  key={r.siteDb}
                  row={r}
                  status={isActive1h ? "ok" : isActive24h ? "warn" : "stale"}
                  range={ctrl[r.siteDb] ?? null}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Desktop: table */}
      <section className="dark:border-background-dark-secondary dark:bg-background-dark-card hidden overflow-hidden rounded-lg border bg-white shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)] md:block">
        {sortedRows.length === 0 ? (
          <div className="py-12">
            <EmptyState />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="border-b bg-background-primary/60 text-text-secondary dark:border-background-dark-secondary dark:bg-background-dark-secondary/40 dark:text-text-dark-primary/70">
                <tr>
                  <Th>Site</Th>
                  <Th>병원명</Th>
                  <Th>상태</Th>
                  <Th>최신 시각</Th>
                  <Th className="text-right">hePsi</Th>
                  <Th className="text-right">he%</Th>
                  <Th className="text-right" />
                </tr>
              </thead>

              <tbody>
                {sortedRows.map((r) => {
                  const lastAtMs = r.lastAt ? Date.parse(r.lastAt) : null;
                  const isActive1h = !!lastAtMs && lastAtMs >= meta.since1hMs;
                  const isActive24h = !!lastAtMs && lastAtMs >= meta.since24hMs;

                  const lastAtDate = parseIso(r.lastAt);
                  const range = ctrl[r.siteDb] ?? null;

                  const hePsiAlert = isOutOfRange(
                    r.hePsi,
                    range?.mrprel ?? null,
                    range?.mrpreh ?? null,
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
                      className="dark:border-background-dark-secondary scroll-mt-[120px] border-b last:border-b-0 transition-colors hover:bg-background-primary/40 dark:hover:bg-background-dark-secondary/30"
                    >
                      <Td className="text-text-major dark:text-text-dark-primary text-sm font-semibold tabular-nums">
                        {r.siteSlug}
                      </Td>

                      <Td className="text-text-major dark:text-text-dark-primary font-medium">
                        {r.name ?? "-"}
                      </Td>

                      <Td>
                        <StatusBadge
                          variant={
                            isActive1h ? "ok" : isActive24h ? "warn" : "stale"
                          }
                        >
                          {isActive1h
                            ? "정상"
                            : isActive24h
                              ? "주의"
                              : "미수집"}
                        </StatusBadge>
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
                          "whitespace-nowrap text-right tabular-nums",
                          hePsiAlert
                            ? "font-semibold text-red-600 dark:text-red-400"
                            : "text-text-major dark:text-text-dark-primary/90",
                        ].join(" ")}
                      >
                        {fmtNum(r.hePsi)}
                      </Td>

                      <Td
                        className={[
                          "whitespace-nowrap text-right tabular-nums",
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
                          aria-label={`${r.name ?? r.siteSlug} 상세 보기`}
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
    </main>
    </PullToRefresh>
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

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "ok" | "warn" | "neutral";
}) {
  const toneCls =
    tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : "text-text-major dark:text-text-dark-primary";
  return (
    <div className="dark:border-background-dark-secondary dark:bg-background-dark-card rounded-lg border bg-white px-3 py-2.5 shadow-[0_1px_2px_0_rgb(0_0_0_/_0.03)] sm:px-4 sm:py-3">
      <div className="text-text-secondary dark:text-text-dark-primary/60 text-[11px] font-medium sm:text-xs">
        {label}
      </div>
      <div
        className={[
          "mt-1 text-xl font-semibold tabular-nums sm:text-2xl",
          toneCls,
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function SiteCard({
  row,
  status,
  range,
}: {
  row: SiteRow;
  status: "ok" | "warn" | "stale";
  range: CtrlRange | null;
}) {
  const statusLabel =
    status === "ok" ? "정상" : status === "warn" ? "주의" : "비활성";

  const hePsiAlert = isOutOfRange(
    row.hePsi,
    range?.mrprel ?? null,
    range?.mrpreh ?? null,
  );
  const hePctAlert = isOutOfRange(
    row.hePct,
    range?.mrlevl ?? null,
    range?.mrlevh ?? null,
  );

  const anyAlert = hePsiAlert || hePctAlert;
  const d = parseIso(row.lastAt);

  return (
    <Link
      href={`/sites/${row.siteSlug}`}
      id={`site-m-${row.siteSlug}`}
      className={[
        "group block scroll-mt-[120px] rounded-lg border bg-white p-4 shadow-[0_1px_2px_0_rgb(0_0_0_/_0.03)] transition-all active:scale-[0.997]",
        "hover:border-border-secondary dark:hover:border-background-dark-secondary/60",
        "dark:border-background-dark-secondary dark:bg-background-dark-card",
        anyAlert
          ? "border-red-300/80 dark:border-red-900/50"
          : "border-border",
      ].join(" ")}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-text-secondary dark:text-text-dark-primary/70 text-sm font-semibold tabular-nums">
            {row.siteSlug}
          </span>
          <span className="text-border-strong dark:text-background-dark-secondary">·</span>
          <span
            className="text-text-major dark:text-text-dark-primary truncate text-[15px] font-semibold"
            title={row.name ?? ""}
          >
            {row.name ?? "-"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge variant={status}>{statusLabel}</StatusBadge>
          <ChevronRightIcon className="text-text-secondary/60 dark:text-text-dark-primary/40 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      {/* Divider */}
      <div className="my-3 h-px bg-border/60 dark:bg-background-dark-secondary/60" />

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCol
          label="최신 시각"
          value={
            <span className="text-text-major dark:text-text-dark-primary text-sm font-semibold tabular-nums leading-tight">
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

function MetricCol({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-text-secondary dark:text-text-dark-primary/60 text-[11px] font-medium">
        {label}
      </div>
      <div className="mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "ok" | "warn" | "stale";
}) {
  const cls =
    variant === "ok"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : variant === "warn"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        : "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300";

  const dotCls =
    variant === "ok"
      ? "bg-emerald-500"
      : variant === "warn"
        ? "bg-amber-500"
        : "bg-slate-400";

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        cls,
      ].join(" ")}
    >
      <span className={["h-1.5 w-1.5 rounded-full", dotCls].join(" ")} />
      {children}
    </span>
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
        "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap",
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
