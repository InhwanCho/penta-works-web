"use client";

import DashboardScrollTo from "@/components/dashboard-scroll-to";
import ThreeDotLoader from "@/components/icons/three-dot-loader";
import { fmtDate } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type React from "react";
import { useMemo } from "react";

type SiteRow = {
  siteDb: string;
  siteSlug: string;
  name: string | null;
  lastAt: string | null; // ISO
  lagMin: number | null;
  count1h: number;
  count24h: number;
};

type DashboardResponse = {
  meta: {
    nowMs: number;
    since1hMs: number;
    since24hMs: number;
  };
  stats: {
    totalSites: number;
    active1h: number;
    stale24h: number;
    total24hRecords: number;
  };
  rows: SiteRow[];
};

async function fetchDashboard(): Promise<DashboardResponse> {
  const res = await fetch("/api/dashboard", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json();
}

function compareSite(a: SiteRow, b: SiteRow) {
  // "1", "2", "003" 같은 형태는 숫자로 정렬
  const aSlug = a.siteSlug ?? "";
  const bSlug = b.siteSlug ?? "";

  const aIsNum = /^\d+$/.test(aSlug);
  const bIsNum = /^\d+$/.test(bSlug);

  if (aIsNum && bIsNum) return Number(aSlug) - Number(bSlug);
  if (aIsNum) return -1; // 숫자 먼저
  if (bIsNum) return 1;

  // 숫자가 아닌 값이 섞일 경우 문자열 정렬
  return aSlug.localeCompare(bSlug);
}

export default function DashboardClient() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });

  // Hooks는 조건문/early return 전에 항상 동일한 순서로 호출되어야 함
  const rows = data?.rows ?? [];
  const sortedRows = useMemo(() => {
    return rows.slice().sort(compareSite);
  }, [rows]);

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
        <div className="text-sm text-red-600">
          데이터를 불러오지 못했습니다:{" "}
          {String((error as Error)?.message ?? "")}
        </div>
      </main>
    );
  }

  const { stats, meta } = data;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <DashboardScrollTo offset={80} />

      <div className="mb-5">
        <h1 className="text-text-major dark:text-text-dark-primary text-xl font-extrabold tracking-tight">
          대시보드
        </h1>
        <div className="text-text-secondary dark:text-text-dark-primary/70 mt-1 text-xs">
          기준: 최근 24시간 (상태는 최근 1시간도 함께 표시)
        </div>
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          title="전체 사이트"
          value={stats.totalSites}
        />
        <StatCard
          title="최근 1h 수집됨"
          value={stats.active1h}
        />
        <StatCard
          title="최근 24h 미수집"
          value={stats.stale24h}
        />
        <StatCard
          title="최근 24h 총 레코드"
          value={stats.total24hRecords}
        />
      </section>

      {/* Mobile: cards */}
      <section className="md:hidden">
        {sortedRows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {sortedRows.map((r) => {
              const lastAtMs = r.lastAt ? Date.parse(r.lastAt) : null;
              const isActive1h = !!lastAtMs && lastAtMs >= meta.since1hMs;
              const isActive24h = !!lastAtMs && lastAtMs >= meta.since24hMs;

              return (
                <SiteCard
                  key={r.siteDb}
                  row={r}
                  status={isActive1h ? "ok" : isActive24h ? "warn" : "stale"}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Desktop: table */}
      <section className="dark:border-background-dark-secondary dark:bg-background-dark-card hidden overflow-hidden rounded-2xl border bg-white shadow-sm md:block">
        {sortedRows.length === 0 ? (
          <div className="py-12">
            <EmptyState />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="bg-background-tertiary text-text-major dark:bg-background-dark-secondary dark:text-text-dark-primary">
                <tr>
                  <Th>site</Th>
                  <Th>name</Th>
                  <Th>status</Th>
                  <Th>lastAt</Th>
                  <Th>lag</Th>
                  <Th>count1h</Th>
                  <Th>count24h</Th>
                  <Th className="text-right">detail</Th>
                </tr>
              </thead>

              <tbody>
                {sortedRows.map((r) => {
                  const lastAtMs = r.lastAt ? Date.parse(r.lastAt) : null;
                  const isActive1h = !!lastAtMs && lastAtMs >= meta.since1hMs;
                  const isActive24h = !!lastAtMs && lastAtMs >= meta.since24hMs;

                  return (
                    <tr
                      key={r.siteDb}
                      id={`site-d-${r.siteSlug}`}
                      className="dark:border-background-dark-secondary scroll-mt-[120px] border-b last:border-b-0"
                    >
                      <Td className="font-semibold">{r.siteSlug}</Td>

                      <Td className="text-text-secondary dark:text-text-dark-primary/80">
                        {r.name ?? "-"}
                      </Td>

                      <Td>
                        <StatusPill
                          variant={
                            isActive1h ? "ok" : isActive24h ? "warn" : "stale"
                          }
                        >
                          {isActive1h
                            ? "active(1h)"
                            : isActive24h
                              ? "active(24h)"
                              : "미수집(24h)"}
                        </StatusPill>
                      </Td>

                      <Td className="text-text-secondary dark:text-text-dark-primary/80">
                        {r.lastAt ? fmtDate(new Date(r.lastAt)) : "-"}
                      </Td>

                      <Td className="text-text-secondary dark:text-text-dark-primary/80">
                        {r.lagMin == null ? "-" : `${r.lagMin}m`}
                      </Td>

                      <Td>{r.count1h}</Td>
                      <Td>{r.count24h}</Td>

                      <Td className="text-right">
                        <Link
                          className="hover:bg-background-tertiary dark:border-background-dark-secondary dark:hover:bg-background-dark-secondary inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium"
                          href={`/sites/${r.siteSlug}`}
                        >
                          보기
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
  );
}

/* ---- 이하 UI 컴포넌트 ---- */

function EmptyState() {
  return (
    <div className="text-text-secondary dark:text-text-dark-primary/70 py-12 text-center text-sm">
      데이터가 없습니다.
    </div>
  );
}

function SiteCard({
  row,
  status,
}: {
  row: SiteRow;
  status: "ok" | "warn" | "stale";
}) {
  const statusLabel =
    status === "ok"
      ? "active(1h)"
      : status === "warn"
        ? "active(24h)"
        : "stale";

  return (
    <div
      id={`site-m-${row.siteSlug}`}
      className="dark:border-background-dark-secondary dark:bg-background-dark-card scroll-mt-[120px] rounded-2xl border bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-text-major dark:text-text-dark-primary text-base font-extrabold tracking-tight">
              {row.siteSlug}
            </div>
            <StatusPill variant={status}>{statusLabel}</StatusPill>
          </div>
          <div className="text-text-secondary dark:text-text-dark-primary/70 mt-1 truncate text-xs">
            {row.name ?? "-"}
          </div>
        </div>

        <Link
          className="hover:bg-background-tertiary dark:border-background-dark-secondary dark:hover:bg-background-dark-secondary inline-flex shrink-0 items-center rounded-lg border px-3 py-1.5 text-xs font-medium"
          href={`/sites/${row.siteSlug}`}
        >
          보기
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric
          label="lastAt"
          value={row.lastAt ? (fmtDate(new Date(row.lastAt)) ?? "-") : "-"}
        />
        <Metric
          label="lag"
          value={row.lagMin == null ? "-" : `${row.lagMin}m`}
        />
        <Metric
          label="count1h"
          value={String(row.count1h)}
        />
        <Metric
          label="count24h"
          value={String(row.count24h)}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="dark:border-background-dark-secondary rounded-xl border px-3 py-2">
      <div className="text-text-secondary dark:text-text-dark-primary/70 text-[11px]">
        {label}
      </div>
      <div className="text-text-major dark:text-text-dark-primary mt-0.5 text-sm font-semibold">
        {value}
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="dark:border-background-dark-secondary dark:bg-background-dark-card rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-text-secondary dark:text-text-dark-primary/70 mb-1 text-xs">
        {title}
      </div>
      <div className="text-text-major dark:text-text-dark-primary text-2xl font-extrabold tracking-tight">
        {value}
      </div>
    </div>
  );
}

function StatusPill({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "ok" | "warn" | "stale";
}) {
  const cls =
    variant === "ok"
      ? "bg-background-primary text-text-major dark:bg-background-dark-secondary dark:text-text-dark-primary"
      : variant === "warn"
        ? "bg-white text-text-secondary dark:bg-background-dark-card dark:text-text-dark-primary/80"
        : "bg-white text-text-secondary dark:bg-background-dark-card dark:text-text-dark-primary/70";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        "dark:border-background-dark-secondary",
        cls,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={[
        "px-4 py-3 text-left text-xs font-semibold whitespace-nowrap",
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
