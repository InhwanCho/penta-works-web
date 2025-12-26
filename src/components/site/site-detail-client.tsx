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
  // ✅ 10, 20, 50, 100 범위로 제한
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

// ✅ 모바일에서 차트가 터치를 먹지 않게 하는 래퍼
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
        // ✅ 온습도 그래프 제거하므로 굳이 포인트에 안 넣어도 됨(남겨도 무방)
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

        {/* ✅ 10, 20, 50, 100 으로 변경 */}
        <div className="flex items-center gap-2 text-xs">
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

        {/* ✅ (1) 드래그/확대 등 터치 인터랙션 제거(스크롤 우선) */}
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

        {/* ✅ (3) 온습도 그래프 제거 */}
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
