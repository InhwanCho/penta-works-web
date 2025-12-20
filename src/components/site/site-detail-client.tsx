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
  return Math.min(Math.max(Number.isFinite(raw) ? raw : 200, 50), 1000);
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

export default function SiteDetailClient({ slug }: { slug: string }) {
  const sp = useSearchParams();
  const takeRaw = Number(sp.get("take") ?? 200);
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
        <div className="text-sm text-red-600">
          데이터를 불러오지 못했습니다:{" "}
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
        actemp: toPointNumber(r.actemp),
        achumi: toPointNumber(r.achumi),
      };
    });

  const lastAtLabel = data.lastAt ? fmtDate(new Date(data.lastAt)) : "-";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <Link
          className="text-text-secondary hover:text-text-major dark:text-text-dark-primary/70 dark:hover:text-text-dark-primary flex items-center justify-center gap-x-2 text-sm font-medium"
          href="/"
        >
          <ArrowBackIconMini /> 대시보드
        </Link>

        <div className="flex items-center gap-2 text-xs">
          <TakeLink
            slug={slug}
            take={200}
            active={take === 200}
          />
          <TakeLink
            slug={slug}
            take={500}
            active={take === 500}
          />
          <TakeLink
            slug={slug}
            take={1000}
            active={take === 1000}
          />
        </div>
      </div>

      <div className="dark:border-background-dark-secondary dark:bg-background-dark-card mb-5 rounded-2xl border bg-white p-4 shadow-sm">
        <h1 className="text-text-major dark:text-text-dark-primary text-xl font-extrabold tracking-tight">
          사이트 {slug} {data.site.name ? `- ${data.site.name}` : ""}
        </h1>
        <div className="text-text-secondary dark:text-text-dark-primary/70 mt-1 text-xs">
          최신 수집: {lastAtLabel} / 표시 건수: {take}
        </div>
      </div>

      <div className="space-y-4">
        {points.length === 0 && (
          <div className="text-text-secondary dark:border-background-dark-secondary dark:bg-background-dark-card dark:text-text-dark-primary/70 rounded-2xl border bg-white p-4 text-sm">
            표시할 데이터가 없습니다.
          </div>
        )}

        <TimeSeriesLines
          title="He Pressure (psi)"
          points={points}
          series={[{ key: "hepres", name: "He Pressure (psi)" }]}
        />

        <TimeSeriesLines
          title="He Level (%)"
          points={points}
          series={[{ key: "heleve", name: "He Level (%)" }]}
        />

        <TimeSeriesLines
          title="Air Conditioners (Temp / Humi)"
          points={points}
          series={[
            { key: "actemp", name: "AC Temp" },
            { key: "achumi", name: "AC Humi" },
          ]}
        />
      </div>

      {/* 요청사항: '최근 레코드' 섹션(테이블) 제거 */}
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
        "rounded-lg border px-3 py-1.5",
        "dark:border-background-dark-secondary",
        active
          ? "bg-background-tertiary text-text-major dark:bg-background-dark-secondary dark:text-text-dark-primary"
          : "text-text-secondary hover:bg-background-tertiary dark:text-text-dark-primary/70 dark:hover:bg-background-dark-secondary",
      ].join(" ")}
    >
      {take}
    </Link>
  );
}
