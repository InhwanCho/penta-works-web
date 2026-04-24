"use client";

import { ArrowBackIconMini } from "@/components/icons/arrow-back-icon";
import type { BaselineEntry } from "@/lib/baseline-map";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function BaselinesClient({
  entries,
  tolerancePct,
}: {
  entries: BaselineEntry[];
  tolerancePct: number;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((e) => e.name.toLowerCase().includes(query));
  }, [q, entries]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5 lg:px-8 lg:py-8">
      <div className="mb-4">
        <Link
          href="/"
          className="text-text-secondary hover:bg-background-tertiary hover:text-text-major dark:text-text-dark-primary/70 dark:hover:bg-background-dark-secondary dark:hover:text-text-dark-primary inline-flex h-9 items-center justify-center gap-x-1.5 rounded-md px-2 text-sm font-medium transition-colors"
        >
          <ArrowBackIconMini className="h-4 w-4" /> 대시보드
        </Link>
      </div>

      <header className="mb-5 lg:mb-6">
        <h1 className="text-text-major dark:text-text-dark-primary text-xl font-semibold tracking-tight lg:text-2xl">
          병원별 기준값
        </h1>
        <p className="text-text-secondary dark:text-text-dark-primary/60 mt-1 text-sm">
          hePsi 모니터링 기준값과 허용범위 ±{tolerancePct}%. 범위를 벗어나면
          슬랙 알림이 발송됩니다.
        </p>
      </header>

      {/* 통계 + 검색 */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:gap-3">
        <div className="relative">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="병원명으로 검색"
            className="dark:border-background-dark-secondary dark:bg-background-dark-card bg-white w-full rounded-md border px-3.5 py-2.5 text-sm outline-none transition placeholder:text-text-secondary/70 focus:border-text-major/40 dark:placeholder:text-text-dark-primary/40 dark:focus:border-text-dark-primary/40"
            inputMode="search"
            autoComplete="off"
          />
        </div>
        <StatChip label="등록" value={entries.length} />
        <StatChip label="허용범위" value={`±${tolerancePct}%`} accent />
      </div>

      {/* Mobile: 카드 리스트 */}
      <section className="md:hidden">
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2">
            {filtered.map((e) => (
              <li
                key={e.name}
                className="dark:border-background-dark-secondary dark:bg-background-dark-card rounded-lg border bg-white p-4 shadow-[0_1px_2px_0_rgb(0_0_0_/_0.03)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-text-major dark:text-text-dark-primary truncate text-[15px] font-semibold">
                    {e.name}
                  </div>
                  <div className="text-text-major dark:text-text-dark-primary shrink-0 text-xl font-semibold tabular-nums">
                    {e.baseline}
                  </div>
                </div>
                <div className="my-3 h-px bg-border/60 dark:bg-background-dark-secondary/60" />
                <div className="flex items-center justify-between text-xs">
                  <div className="flex flex-col">
                    <span className="text-text-secondary dark:text-text-dark-primary/60 text-[11px] font-medium">
                      최소
                    </span>
                    <span className="text-text-major dark:text-text-dark-primary/90 mt-0.5 text-sm font-semibold tabular-nums">
                      {e.min}
                    </span>
                  </div>
                  <div className="flex-1 px-3">
                    <RangeBar />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-text-secondary dark:text-text-dark-primary/60 text-[11px] font-medium">
                      최대
                    </span>
                    <span className="text-text-major dark:text-text-dark-primary/90 mt-0.5 text-sm font-semibold tabular-nums">
                      {e.max}
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
              <thead className="border-b bg-background-primary/60 text-text-secondary dark:border-background-dark-secondary dark:bg-background-dark-secondary/40 dark:text-text-dark-primary/70">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                    병원명
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                    기준값
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                    최소
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                    최대
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.name}
                    className="dark:border-background-dark-secondary border-b last:border-b-0 transition-colors hover:bg-background-primary/40 dark:hover:bg-background-dark-secondary/30"
                  >
                    <td className="text-text-major dark:text-text-dark-primary px-4 py-3 font-medium">
                      {e.name}
                    </td>
                    <td className="text-text-major dark:text-text-dark-primary px-4 py-3 text-right font-semibold tabular-nums">
                      {e.baseline}
                    </td>
                    <td className="text-text-secondary dark:text-text-dark-primary/70 px-4 py-3 text-right tabular-nums">
                      {e.min}
                    </td>
                    <td className="text-text-secondary dark:text-text-dark-primary/70 px-4 py-3 text-right tabular-nums">
                      {e.max}
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

function RangeBar() {
  return (
    <div className="relative h-1.5 w-full rounded-full bg-border/60 dark:bg-background-dark-secondary/60">
      <div className="absolute inset-y-0 left-1/4 right-1/4 rounded-full bg-emerald-500/70 dark:bg-emerald-400/70" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-text-secondary dark:text-text-dark-primary/60 py-10 text-center text-sm">
      결과가 없습니다.
    </div>
  );
}
