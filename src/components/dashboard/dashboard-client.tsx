"use client";

import DashboardScrollTo from "@/components/dashboard-scroll-to";
import ThreeDotLoader from "@/components/icons/three-dot-loader";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type React from "react";
import { useMemo } from "react";

type CtrlRange = {
  mrprel: number | null; // low psi
  mrpreh: number | null; // high psi
  mrlevl: number | null; // low %
  mrlevh: number | null; // high %
};
type SiteRow = {
  siteDb: string;
  siteSlug: string;
  name: string | null;
  lastAt: string | null; // ISO
  hePsi: number | null;
  hePct: number | null;
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
  ctrl: Record<string, CtrlRange>;
};

async function fetchDashboard(): Promise<DashboardResponse> {
  const res = await fetch("/api/dashboard", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json();
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

export default function DashboardClient() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });

  const rows = data?.rows ?? [];
  const sortedRows = useMemo(() => rows.slice().sort(compareSite), [rows]);

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

  const { meta, ctrl } = data;

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
                  range={ctrl[r.siteDb] ?? null}
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
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="bg-background-tertiary text-text-major dark:bg-background-dark-secondary dark:text-text-dark-primary">
                <tr>
                  <Th>site</Th>
                  <Th>병원명</Th>
                  <Th>status</Th>
                  <Th>lastAt</Th>
                  <Th>hePsi</Th>
                  <Th>he%</Th>
                  <Th className="text-right">detail</Th>
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
                      className="dark:border-background-dark-secondary scroll-mt-[120px] border-b last:border-b-0"
                    >
                      <Td className="text-text-major dark:text-text-dark-primary text-base font-extrabold tracking-tight">
                        {r.siteSlug}
                      </Td>

                      <Td className="text-text-major dark:text-text-dark-primary font-semibold">
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

                      <Td className="text-text-secondary dark:text-text-dark-primary/80 whitespace-nowrap tabular-nums">
                        <div className="leading-tight">
                          <div className="text-[12px] font-semibold whitespace-nowrap">
                            {fmtYmd(lastAtDate)}
                          </div>
                          <div className="mt-0.5 text-[11px] font-medium whitespace-nowrap opacity-80">
                            {fmtHms(lastAtDate)}
                          </div>
                        </div>
                      </Td>

                      {/* ✅ 범위 벗어나면 값만 빨간색 */}
                      <Td
                        className={[
                          "whitespace-nowrap tabular-nums",
                          hePsiAlert
                            ? "font-extrabold text-red-600"
                            : "text-text-secondary dark:text-text-dark-primary/80",
                        ].join(" ")}
                      >
                        {fmtNum(r.hePsi)}
                      </Td>

                      <Td
                        className={[
                          "whitespace-nowrap tabular-nums",
                          hePctAlert
                            ? "font-extrabold text-red-600"
                            : "text-text-secondary dark:text-text-dark-primary/80",
                        ].join(" ")}
                      >
                        {fmtNum(r.hePct, "%")}
                      </Td>

                      <Td className="text-right">
                        <Link
                          className={[
                            "inline-flex items-center rounded-lg px-3 py-2 text-xs font-extrabold",
                            "dark:border-background-dark-secondary border",
                            "bg-background-tertiary hover:bg-background-secondary",
                            "dark:bg-background-dark-secondary dark:hover:bg-background-dark-card",
                            "text-text-major dark:text-text-dark-primary",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                            "dark:focus-visible:ring-offset-background-dark-card",
                          ].join(" ")}
                          href={`/sites/${r.siteSlug}`}
                        >
                          상세
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
  range,
}: {
  row: SiteRow;
  status: "ok" | "warn" | "stale";
  range: CtrlRange | null;
}) {
  const statusLabel =
    status === "ok"
      ? "active(1h)"
      : status === "warn"
        ? "active(24h)"
        : "stale";

  const lastAtDate = parseIso(row.lastAt);

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

  return (
    <div
      id={`site-m-${row.siteSlug}`}
      className="dark:border-background-dark-secondary dark:bg-background-dark-card scroll-mt-[120px] rounded-2xl border bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-text-major dark:text-text-dark-primary text-lg font-extrabold tracking-tight">
              {row.siteSlug}
            </div>
            <StatusPill variant={status}>{statusLabel}</StatusPill>
          </div>

          <div
            className={[
              "mt-1",
              "text-text-major dark:text-text-dark-primary",
              "text-sm leading-snug font-semibold",
              "line-clamp-2 break-words",
            ].join(" ")}
            title={row.name ?? ""}
          >
            {row.name ?? "-"}
          </div>
        </div>

        <Link
          className={[
            "inline-flex shrink-0 items-center rounded-lg px-3 py-2 text-xs font-extrabold",
            "dark:border-background-dark-secondary border",
            "bg-background-tertiary hover:bg-background-secondary",
            "dark:bg-background-dark-secondary dark:hover:bg-background-dark-card",
            "text-text-major dark:text-text-dark-primary",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            "dark:focus-visible:ring-offset-background-dark-card",
          ].join(" ")}
          href={`/sites/${row.siteSlug}`}
        >
          상세
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <MetricLastAt iso={row.lastAt} />

        <Metric
          label="hePsi"
          value={fmtNum(row.hePsi)}
          valueTone={hePsiAlert ? "danger" : "normal"}
        />

        <Metric
          label="he%"
          value={fmtNum(row.hePct, "%")}
          valueTone={hePctAlert ? "danger" : "normal"}
        />
      </div>
    </div>
  );
}

function MetricLastAt({ iso }: { iso: string | null }) {
  const d = parseIso(iso);

  return (
    <div className="dark:border-background-dark-secondary rounded-xl border px-3 py-2">
      <div className="text-text-secondary dark:text-text-dark-primary/70 text-[11px]">
        lastAt
      </div>

      <div className="text-text-major dark:text-text-dark-primary mt-0.5 leading-tight tabular-nums">
        <div className="text-[12px] font-semibold whitespace-nowrap">
          {fmtYmd(d)}
        </div>
        <div className="mt-0.5 text-[11px] font-medium whitespace-nowrap opacity-80">
          {fmtHms(d)}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  valueTone = "normal",
}: {
  label: string;
  value: string;
  valueTone?: "normal" | "danger";
}) {
  const valueCls =
    valueTone === "danger"
      ? "text-red-600 font-extrabold"
      : "text-text-major dark:text-text-dark-primary font-semibold";

  return (
    <div className="dark:border-background-dark-secondary rounded-xl border px-3 py-2">
      <div className="text-text-secondary dark:text-text-dark-primary/70 text-[11px]">
        {label}
      </div>
      <div
        className={[
          "mt-0.5 text-sm whitespace-nowrap tabular-nums",
          valueCls,
        ].join(" ")}
      >
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
  // 색상은 이미 ok/warn/stale로 분기되고 있으니 여기서 더 강하게 바꿔도 됨
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
