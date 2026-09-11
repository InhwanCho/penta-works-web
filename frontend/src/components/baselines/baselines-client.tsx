"use client";

import { ArrowBackIconMini } from "@/components/icons/arrow-back-icon";
import type { PsiThreshold } from "@/lib/api";
import Link from "next/link";
import { useMemo, useState } from "react";

function fmtBound(v: number | null) {
  return v == null ? "-" : String(v);
}

export default function BaselinesClient({
  entries,
  loadFailed = false,
}: {
  entries: PsiThreshold[];
  loadFailed?: boolean;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return entries;

    return entries.filter((e) =>
      (e.name ?? "").toLowerCase().includes(query),
    );
  }, [q, entries]);

  const activeCount = useMemo(
    () => entries.filter((e) => e.active).length,
    [entries],
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <div className="mb-2 sm:mb-3">
        <Link
          href="/"
          className="text-text-secondary hover:bg-background-tertiary hover:text-text-major dark:text-text-dark-primary/70 dark:hover:bg-background-dark-secondary dark:hover:text-text-dark-primary inline-flex min-h-10 items-center justify-center gap-x-1.5 rounded-lg px-2 text-sm font-bold transition-colors"
        >
          <ArrowBackIconMini className="h-4 w-4" /> 대시보드
        </Link>
      </div>

      <header className="mb-3 sm:mb-4">
        <h1 className="text-text-major dark:text-text-dark-primary text-2xl font-extrabold tracking-tight">
          병원별 기준값
        </h1>
        <p className="text-text-secondary dark:text-text-dark-primary/70 mt-1 text-sm font-medium">
          hePsi 알림 허용범위입니다. 범위를 벗어나면 알림이 발송됩니다.
        </p>
      </header>

      {loadFailed && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50/60 p-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
        >
          기준값을 불러오지 못했습니다. DB 연결을 확인한 뒤 새로고침해 주세요.
        </div>
      )}

      {/* 통계 + 검색 */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:gap-3">
        <div className="relative">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="병원명으로 검색"
            className="dark:border-background-dark-secondary dark:bg-background-dark-card placeholder:text-text-secondary/70 focus:border-text-major/40 dark:placeholder:text-text-dark-primary/40 dark:focus:border-text-dark-primary/40 w-full rounded-md border bg-white px-3.5 py-2.5 text-sm transition outline-none"
            inputMode="search"
            autoComplete="off"
          />
        </div>
        <StatChip
          label="등록"
          value={entries.length}
        />
        <StatChip
          label="알림 사용중"
          value={activeCount}
          accent
        />
      </div>

      {/* Mobile: 카드 리스트 */}
      <section className="md:hidden">
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2">
            {filtered.map((e) => (
              <li
                key={e.siteid}
                className="dark:border-background-dark-secondary dark:bg-background-dark-card rounded-xl border bg-white p-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center">
                    <span className="text-text-major dark:text-text-dark-primary truncate text-[15px] font-semibold">
                      {e.name ?? "-"}
                    </span>
                  </div>
                  <ActiveBadge active={e.active} />
                </div>
                <div className="bg-border/60 dark:bg-background-dark-secondary/60 my-3 h-px" />
                <div className="flex items-end justify-between text-xs">
                  <div className="flex flex-col">
                    <span className="text-text-secondary dark:text-text-dark-primary/70 text-sm font-medium">
                      최소
                    </span>
                    <span className="text-text-major dark:text-text-dark-primary/90 mt-0.5 text-sm font-semibold tabular-nums">
                      {fmtBound(e.min)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-text-secondary dark:text-text-dark-primary/70 text-sm font-medium">
                      최대
                    </span>
                    <span className="text-text-major dark:text-text-dark-primary/90 mt-0.5 text-sm font-semibold tabular-nums">
                      {fmtBound(e.max)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Desktop: 테이블 */}
      <section className="dark:border-background-dark-secondary dark:bg-background-dark-card hidden overflow-hidden rounded-lg border bg-white shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)] md:block">
        {filtered.length === 0 ? (
          <div className="py-12">
            <EmptyState />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-background-primary/60 text-text-secondary dark:border-background-dark-secondary dark:bg-background-dark-secondary/40 dark:text-text-dark-primary/70 border-b">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase"
                  >
                    병원명
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide uppercase"
                  >
                    최소
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide uppercase"
                  >
                    최대
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase"
                  >
                    알림
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.siteid}
                    className="dark:border-background-dark-secondary hover:bg-background-primary/40 dark:hover:bg-background-dark-secondary/30 border-b transition-colors last:border-b-0"
                  >
                    <td className="text-text-major dark:text-text-dark-primary px-4 py-3 font-medium">
                      {e.name ?? "-"}
                    </td>
                    <td className="text-text-major dark:text-text-dark-primary px-4 py-3 text-right font-semibold tabular-nums">
                      {fmtBound(e.min)}
                    </td>
                    <td className="text-text-major dark:text-text-dark-primary px-4 py-3 text-right font-semibold tabular-nums">
                      {fmtBound(e.max)}
                    </td>
                    <td className="px-4 py-3">
                      <ActiveBadge active={e.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="dark:border-background-dark-secondary dark:bg-background-dark-card inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 shadow-[0_1px_2px_0_rgb(0_0_0_/_0.03)]">
      <span className="text-text-secondary dark:text-text-dark-primary/60 text-xs font-medium">
        {label}
      </span>
      <span
        className={[
          "text-sm font-semibold tabular-nums",
          accent
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-text-major dark:text-text-dark-primary",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-sm font-bold",
        active
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-slate-400",
        ].join(" ")}
      />
      {active ? "사용중" : "미사용"}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="text-text-secondary dark:text-text-dark-primary/60 py-10 text-center text-sm">
      결과가 없습니다.
    </div>
  );
}
