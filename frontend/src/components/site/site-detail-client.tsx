"use client";

import {
  TimeSeriesLines,
  type TimeSeriesPoint,
} from "@/components/charts/time-series-lines";
import { ArrowBackIconMini } from "@/components/icons/arrow-back-icon";
import ThreeDotLoader from "@/components/icons/three-dot-loader";
import { clampTake, useSiteDetailQuery } from "@/hooks/use-site-detail-query";
import { fmtDate, fmtTime } from "@/lib/format";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function toPointNumber(v: number | null): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function NoTouchChart({ children }: { children: React.ReactNode }) {
  return (
    <div className="touch-pan-y">
      <div className="pointer-events-none">{children}</div>
    </div>
  );
}

export default function SiteDetailClient({ slug }: { slug: string }) {
  const sp = useSearchParams();
  const takeRaw = Number(sp.get("take") ?? 50);
  const take = clampTake(takeRaw);

  const { data, isLoading, isError, error } = useSiteDetailQuery(slug, take);

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
          {String((error as Error)?.message ?? "")}
        </div>
      </main>
    );
  }

  const rowsDesc = data.rows; // desc
  const points: TimeSeriesPoint[] = rowsDesc
    .slice()
    .reverse()
    .map((r) => {
      const d = r.date ? new Date(r.date) : null;
      return {
        t: d ? fmtTime(d) : "-",
        hepres: toPointNumber(r.hepres),
        heleve: toPointNumber(r.heleve),
      };
    });

  const lastAtLabel = data.lastAt ? fmtDate(new Date(data.lastAt)) : "-";

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <div className="mb-2 sm:mb-3">
        <Link
          className="text-text-secondary hover:bg-background-tertiary hover:text-text-major dark:text-text-dark-primary/70 dark:hover:bg-background-dark-secondary dark:hover:text-text-dark-primary inline-flex min-h-10 items-center justify-center gap-x-1.5 rounded-lg px-2 text-sm font-bold transition-colors"
          href="/"
        >
          <ArrowBackIconMini className="h-4 w-4" /> 대시보드
        </Link>
      </div>

      <div className="dark:border-background-dark-secondary dark:bg-background-dark-card mb-3 rounded-xl border bg-white p-3 shadow-sm sm:mb-4 sm:p-4">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-text-secondary dark:text-text-dark-primary/70 text-sm font-semibold tabular-nums">
            {slug}
          </span>
          <span className="text-border-strong dark:text-background-dark-secondary">
            ·
          </span>
          <h1 className="text-text-major dark:text-text-dark-primary text-2xl font-extrabold tracking-tight">
            {data.site.name || "-"}
          </h1>
        </div>
        <div className="text-text-secondary dark:text-text-dark-primary/60 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>
            최신 수집
            <span className="text-text-major dark:text-text-dark-primary/80 ml-1 font-medium tabular-nums">
              {lastAtLabel}
            </span>
          </span>
        </div>
      </div>

      {/* Take 탭(shadcn Tabs 스타일) */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-text-secondary dark:text-text-dark-primary/70 text-[0.8125rem] font-bold">
          표시 건수
        </span>
        <div className="bg-background-tertiary dark:bg-background-dark-secondary/60 inline-flex min-h-10 items-center rounded-lg p-1 text-sm">
          <TakeLink
            slug={slug}
            take={10}
            active={take === 10}
          />
          <TakeLink
            slug={slug}
            take={20}
            active={take === 20}
          />
          <TakeLink
            slug={slug}
            take={50}
            active={take === 50}
          />
          <TakeLink
            slug={slug}
            take={100}
            active={take === 100}
          />
        </div>
      </div>

      <div className="space-y-3">
        {points.length === 0 && (
          <div className="text-text-secondary dark:border-background-dark-secondary dark:bg-background-dark-card dark:text-text-dark-primary/60 rounded-lg border bg-white p-5 text-sm">
            표시할 데이터가 없습니다.
          </div>
        )}

        <NoTouchChart>
          <TimeSeriesLines
            title="He Pressure (psi)"
            points={points}
            series={[{ key: "hepres", name: "He Pressure (psi)" }]}
          />
        </NoTouchChart>

        <NoTouchChart>
          <TimeSeriesLines
            title="He Level (%)"
            points={points}
            series={[{ key: "heleve", name: "He Level (%)" }]}
          />
        </NoTouchChart>
      </div>
    </main>
  );
}

function TakeLink({
  slug,
  take,
  active,
}: {
  slug: string;
  take: number;
  active: boolean;
}) {
  return (
    <Link
      href={`/sites/${encodeURIComponent(slug)}?take=${take}`}
      className={[
        "inline-flex min-h-8 min-w-[40px] items-center justify-center rounded-md px-2.5 text-[0.8125rem] font-bold tabular-nums transition-all sm:px-3",
        active
          ? "text-text-major dark:bg-background-dark-card dark:text-text-dark-primary bg-white shadow-sm"
          : "text-text-secondary hover:text-text-major dark:text-text-dark-primary/60 dark:hover:text-text-dark-primary",
      ].join(" ")}
    >
      {take}
    </Link>
  );
}
