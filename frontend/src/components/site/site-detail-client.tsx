"use client";

import type { TimeSeriesPoint } from "@/components/charts/time-series-lines";
import { ArrowBackIconMini } from "@/components/icons/arrow-back-icon";
import ThreeDotLoader from "@/components/icons/three-dot-loader";
import OfficeAssetsPanel from "@/components/site/office-assets-panel";
import { clampTake, useSiteDetailQuery } from "@/hooks/use-site-detail-query";
import { fmtDate, fmtTime } from "@/lib/format";
import { METRICS, type MetricDef, type MetricKey } from "@/lib/metrics";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const TimeSeriesLines = dynamic(
  () =>
    import("@/components/charts/time-series-lines").then(
      (m) => m.TimeSeriesLines,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="p-8 text-center text-sm">차트 불러오는 중…</div>
    ),
  },
);

type ViewMode = "single" | "grid" | "list";
const MODES: { key: ViewMode; label: string }[] = [
  { key: "single", label: "집중 보기" },
  { key: "grid", label: "모아 보기" },
  { key: "list", label: "세로 보기" },
];

function metricTitle(metric: MetricDef) {
  return `${metric.label ?? metric.code}${metric.unit ? ` (${metric.unit})` : ""}`;
}

function toPointNumber(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export default function SiteDetailClient({ slug }: { slug: string }) {
  const sp = useSearchParams();
  const takeRaw = Number(sp.get("take") ?? 50);
  const take = clampTake(takeRaw);
  const [selected, setSelected] = useState<MetricKey[]>(["hepres", "heleve"]);
  const [mode, setMode] = useState<ViewMode>("grid");
  const [focused, setFocused] = useState<MetricKey>("hepres");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("detail-chart-preferences") ?? "null",
      );
      if (saved) {
        const keys = Array.isArray(saved.selected)
          ? [
              ...new Set<MetricKey>(
                saved.selected.filter((key: MetricKey) =>
                  METRICS.some((m) => m.key === key),
                ),
              ),
            ].slice(0, 4)
          : [];
        if (keys.length) {
          setSelected(keys);
          setFocused(keys.includes(saved.focused) ? saved.focused : keys[0]);
        }
        if (MODES.some((item) => item.key === saved.mode)) setMode(saved.mode);
      }
    } catch {
      /* 저장소를 사용할 수 없으면 기본 설정을 사용합니다. */
    }
    setPreferencesReady(true);
  }, []);
  useEffect(() => {
    if (!preferencesReady) return;
    try {
      localStorage.setItem(
        "detail-chart-preferences",
        JSON.stringify({ selected, focused, mode }),
      );
    } catch {
      /* 저장 실패가 차트 조작을 막지 않도록 합니다. */
    }
  }, [selected, focused, mode, preferencesReady]);
  const visibleKeys = mode === "single" ? [focused] : selected;
  const visibleMetrics = visibleKeys.flatMap((key) =>
    METRICS.filter((m) => m.key === key),
  );

  const toggleMetric = (key: MetricKey) => {
    if (selected.includes(key)) {
      const next = selected.filter((item) => item !== key);
      if (!next.length) return;
      setSelected(next);
      if (focused === key) setFocused(next[0]);
    } else if (selected.length < 4) {
      setSelected([...selected, key]);
      setFocused(key);
    }
  };

  const { data, isLoading, isError, refetch, isFetching } = useSiteDetailQuery(
    slug,
    take,
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
          데이터를 불러오지 못했습니다. 연결 상태를 확인해 주세요.
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="ml-2 min-h-11 rounded-lg border px-3"
          >
            다시 시도
          </button>
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
        ...Object.fromEntries(
          visibleKeys.map((key) => [key, toPointNumber(r[key])]),
        ),
      };
    });

  const lastAtLabel = data.lastAt ? fmtDate(new Date(data.lastAt)) : "-";

  return (
    <main className="mobile-safe-inline mx-auto w-full max-w-7xl overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <div className="mb-2 sm:mb-3">
        <Link
          className="text-text-secondary hover:bg-background-tertiary hover:text-text-major dark:text-text-dark-primary/70 dark:hover:bg-background-dark-secondary dark:hover:text-text-dark-primary inline-flex min-h-10 items-center justify-center gap-x-1.5 rounded-lg px-2 text-sm font-bold transition-colors"
          href={`/?scrollTo=${encodeURIComponent(slug)}`}
        >
          <ArrowBackIconMini className="h-4 w-4" /> 대시보드
        </Link>
      </div>

      <div className="dark:border-background-dark-secondary dark:bg-background-dark-card mb-3 rounded-xl border bg-white p-3 shadow-sm sm:mb-4 sm:p-4">
        <div className="min-w-0">
          <h1 className="text-text-major dark:text-text-dark-primary text-2xl font-extrabold tracking-tight break-words">
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

      <OfficeAssetsPanel siteId={data.site.siteDb} />

      <fieldset className="dark:border-background-dark-secondary dark:bg-background-dark-card mb-3 min-w-0 rounded-xl border bg-white p-3 shadow-sm">
        <legend className="text-text-major dark:text-text-dark-primary px-1 text-sm font-extrabold">
          표시 건수
        </legend>
        <p className="text-text-secondary dark:text-text-dark-primary/70 mb-2 text-xs">
          최신 데이터를 몇 건까지 볼지 선택하세요.
        </p>
        <div className="bg-background-tertiary dark:bg-background-dark-secondary/60 grid min-h-11 w-full grid-cols-4 rounded-lg p-1">
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
      </fieldset>

      <section
        className="dark:bg-background-dark-card mb-3 min-w-0 rounded-xl border bg-white p-3"
        aria-label="차트 표시 설정"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label="보기 모드"
          >
            {MODES.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={mode === item.key}
                onClick={() => setMode(item.key)}
                className={`min-h-10 rounded-lg px-3 text-sm font-bold ${mode === item.key ? "bg-brand-primary text-white" : "bg-background-primary dark:bg-background-dark-secondary"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(!pickerOpen)}
            aria-expanded={pickerOpen}
            aria-controls="metric-picker"
            className="border-border dark:border-background-dark-secondary dark:bg-background-dark-secondary bg-background-primary inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-bold shadow-sm"
          >
            <span>
              항목 선택{" "}
              <span className="text-brand-primary dark:text-brand-dark-primary">
                {selected.length}/4
              </span>
            </span>
            <span className="text-text-secondary dark:text-text-dark-primary/70 text-xs font-semibold">
              {pickerOpen ? "닫기" : "열기"}
            </span>
            <span
              aria-hidden="true"
              className={`text-base leading-none transition-transform ${pickerOpen ? "rotate-180" : ""}`}
            >
              ▾
            </span>
          </button>
        </div>
        {pickerOpen && (
          <div
            id="metric-picker"
            className="mt-3 border-t pt-3"
          >
            <div className="mb-2 flex flex-wrap gap-2">
              {(
                [
                  ["헬륨", ["hepres", "heleve"]],
                  ["온도", ["actemp", "gctemp", "cctemp"]],
                  ["냉각", ["gctemp", "gcflow", "cctemp", "ccflow"]],
                ] as [string, MetricKey[]][]
              ).map(([label, keys]) => (
                <button
                  key={label}
                  type="button"
                  className="min-h-11 rounded-lg border px-3 text-sm"
                  onClick={() => {
                    setSelected(keys);
                    setFocused(keys[0]);
                  }}
                >
                  {label} 묶음
                </button>
              ))}
            </div>
            <p className="text-text-secondary dark:text-text-dark-primary/70 mb-2 text-sm">
              {selected.length === 4
                ? "4개 선택 완료 · 다른 항목을 추가하려면 선택한 항목 하나를 해제하세요."
                : "최소 1개, 최대 4개 항목을 선택하세요."}
            </p>
            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {METRICS.map((metric) => {
                const active = selected.includes(metric.key);
                return (
                  <button
                    key={metric.key}
                    type="button"
                    aria-pressed={active}
                    disabled={
                      active ? selected.length === 1 : selected.length === 4
                    }
                    onClick={() => toggleMetric(metric.key)}
                    className={`min-h-11 min-w-0 rounded-lg border px-3 py-2 text-left text-sm break-words disabled:opacity-50 ${active ? "border-brand-primary bg-brand-primary text-white" : "dark:bg-background-dark-secondary"}`}
                  >
                    {active ? "✓ " : "+ "}
                    {metricTitle(metric)}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="bg-brand-primary mt-3 min-h-11 w-full rounded-lg px-3 text-sm font-bold text-white"
            >
              선택 완료 · 차트 보기
            </button>
          </div>
        )}
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="집중해서 볼 항목"
        >
          {selected.map((key) => {
            const metric = METRICS.find((item) => item.key === key)!;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setFocused(key);
                  setMode("single");
                }}
                aria-pressed={mode === "single" && focused === key}
                className={`min-h-11 max-w-full rounded-md border px-3 py-1 text-sm break-words ${mode === "single" && focused === key ? "bg-brand-primary font-bold text-white" : ""}`}
              >
                {metricTitle(metric)}
              </button>
            );
          })}
        </div>
        <p className="text-text-secondary dark:text-text-dark-primary/70 mt-2 text-xs">
          {mode === "single"
            ? "항목 이름을 누르면 해당 차트에 집중할 수 있습니다."
            : mode === "grid"
              ? "선택한 항목을 작은 차트로 나란히 봅니다. 각 차트의 단위와 눈금은 독립적입니다."
              : "선택한 항목을 큰 차트로 위에서 아래로 봅니다."}
        </p>
      </section>

      <div
        className={
          mode === "grid"
            ? "grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2"
            : "grid min-w-0 grid-cols-1 gap-3"
        }
      >
        {points.length === 0 && (
          <div className="text-text-secondary dark:border-background-dark-secondary dark:bg-background-dark-card dark:text-text-dark-primary/60 rounded-lg border bg-white p-5 text-sm">
            표시할 데이터가 없습니다.
          </div>
        )}

        {points.length > 0 &&
          visibleMetrics.map((metric) => (
            <div
              key={metric.key}
              className="min-w-0 touch-pan-y"
            >
              <div className="text-text-secondary dark:text-text-dark-primary/70 mb-1 flex flex-wrap items-baseline justify-between gap-1 px-1 text-xs">
                <span>
                  최신 값{" "}
                  <strong className="text-sm tabular-nums">
                    {toPointNumber(rowsDesc[0]?.[metric.key])?.toLocaleString(
                      "ko-KR",
                      { maximumFractionDigits: 3 },
                    ) ?? "—"}{" "}
                    {metric.unit}
                  </strong>
                </span>
                {mode !== "single" && (
                  <button
                    type="button"
                    className="min-h-11 px-2 underline underline-offset-2"
                    aria-label={`${metricTitle(metric)} 크게 보기`}
                    onClick={() => {
                      setFocused(metric.key);
                      setMode("single");
                    }}
                  >
                    크게 보기
                  </button>
                )}
              </div>
              {points.some((point) => point[metric.key] != null) ? (
                <TimeSeriesLines
                  title={metricTitle(metric)}
                  points={points}
                  series={[{ key: metric.key, name: metricTitle(metric) }]}
                  height={mode === "grid" ? 190 : 280}
                  interactive={false}
                />
              ) : (
                <div className="dark:bg-background-dark-card rounded-lg border bg-white p-4 text-sm">
                  <h2 className="font-bold">{metricTitle(metric)}</h2>
                  <p className="mt-2">선택한 기간에 수집된 값이 없습니다.</p>
                </div>
              )}
            </div>
          ))}
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
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={[
        "inline-flex min-h-11 min-w-0 items-center justify-center rounded-md px-1 text-sm font-extrabold tabular-nums transition-all sm:px-3",
        active
          ? "text-text-major dark:bg-background-dark-card dark:text-text-dark-primary bg-white shadow-sm"
          : "text-text-secondary hover:text-text-major dark:text-text-dark-primary/60 dark:hover:text-text-dark-primary",
      ].join(" ")}
    >
      {take}건
    </Link>
  );
}
