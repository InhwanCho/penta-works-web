"use client";

import {
  TimeSeriesLines,
  type TimeSeriesPoint,
} from "@/components/charts/time-series-lines";
import { ArrowBackIconMini } from "@/components/icons/arrow-back-icon";
import ThreeDotLoader from "@/components/icons/three-dot-loader";
import { fmtDate, fmtTime } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type ApiRow = {
  index: number;
  date: string | null; // ISO
  hepres: number | null;
  heleve: number | null;
  actemp: number | null;
  achumi: number | null;
};

type ApiResponse = {
  slug: string;
  site: { siteDb: string; name: string | null };
  take: number;
  lastAt: string | null;
  rows: ApiRow[];
};

function clampTake(raw: number) {
  return Math.min(Math.max(Number.isFinite(raw) ? raw : 50, 10), 100);
}

async function fetchSiteDetail(
  slug: string,
  take: number,
): Promise<ApiResponse> {
  const res = await fetch(
    `/api/sites/${encodeURIComponent(slug)}?take=${take}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json();
}

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

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["siteDetail", slug, take],
    queryFn: () => fetchSiteDetail(slug, take),
    staleTime: 10_000,
  });

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
    <main className="mx-auto w-full max-w-6xl px-4 py-5 lg:px-8 lg:py-8">
      <div className="mb-4">
        <Link
          className="text-text-secondary hover:bg-background-tertiary hover:text-text-major dark:text-text-dark-primary/70 dark:hover:bg-background-dark-secondary dark:hover:text-text-dark-primary inline-flex h-9 items-center justify-center gap-x-1.5 rounded-md px-2 text-sm font-medium transition-colors"
          href="/"
        >
          <ArrowBackIconMini className="h-4 w-4" /> 대시보드
        </Link>
      </div>

      <div className="dark:border-background-dark-secondary dark:bg-background-dark-card mb-5 rounded-lg border bg-white p-5 shadow-[0_1px_2px_0_rgb(0_0_0_/_0.03)]">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-text-secondary dark:text-text-dark-primary/70 text-sm font-semibold tabular-nums">
            {slug}
          </span>
          <span className="text-border-strong dark:text-background-dark-secondary">·</span>
          <h1 className="text-text-major dark:text-text-dark-primary text-xl font-semibold tracking-tight lg:text-2xl">
            {data.site.name || "-"}
          </h1>
        </div>
        <div className="text-text-secondary dark:text-text-dark-primary/60 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>
            최신 수집
            <span className="ml-1 font-medium tabular-nums text-text-major dark:text-text-dark-primary/80">
              {lastAtLabel}
            </span>
          </span>
        </div>
      </div>

      {/* Take 탭(shadcn Tabs 스타일) */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-text-secondary dark:text-text-dark-primary/60 text-xs font-medium">
          표시 건수
        </span>
        <div className="inline-flex h-9 items-center rounded-md bg-background-tertiary p-1 text-sm dark:bg-background-dark-secondary/60">
          <TakeLink slug={slug} take={10} active={take === 10} />
          <TakeLink slug={slug} take={20} active={take === 20} />
          <TakeLink slug={slug} take={50} active={take === 50} />
          <TakeLink slug={slug} take={100} active={take === 100} />
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
        "inline-flex h-7 min-w-[40px] items-center justify-center rounded px-3 text-xs font-semibold tabular-nums transition-all",
        active
          ? "bg-white text-text-major shadow-sm dark:bg-background-dark-card dark:text-text-dark-primary"
          : "text-text-secondary hover:text-text-major dark:text-text-dark-primary/60 dark:hover:text-text-dark-primary",
      ].join(" ")}
    >
      {take}
    </Link>
  );
}
