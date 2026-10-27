"use client";
import { HospitalProfile, useHospitalProfile } from "@/components/workspace/hospital-profile";
import HospitalSection from "./hospital-section";
import HospitalDetailTabs from "./hospital-detail-tabs";
import HospitalPlanning from "@/components/workspace/hospital-planning";
import HospitalEquipmentPanel from "./hospital-equipment-panel";
import HospitalWork, { useHospitalHistory } from "@/components/workspace/hospital-work";

import { useHospitalAssets } from "@/components/workspace/hospital-assets";
import { usePlanning } from "@/components/workspace/workspace-data";
import { useOfficeAssetsQuery } from "@/hooks/use-office-assets-query";
import { useAuth } from "@/components/provider/auth-provider";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, type SiteAlertSettings } from "@/lib/api";
import type { TimeSeriesPoint } from "@/components/charts/time-series-lines";
import { ArrowBackIconMini } from "@/components/icons/arrow-back-icon";
import CircleLoader from "@/components/icons/circle-loader";
import PageLoader from "@/components/common/page-loader";
import { scrollPageToTop } from "@/components/common/route-scroll-reset";
import SiteAlertSummary from "@/components/site/site-alert-summary";
import { clampTake, useSiteDetailQuery } from "@/hooks/use-site-detail-query";
import { fmtDate, fmtTime } from "@/lib/format";
import { formatMetricMeasurement, isUnmeasuredMetricValue, METRICS, type MetricDef, type MetricKey } from "@/lib/metrics";
import dynamic from "next/dynamic";
import Link from "@/components/common/app-link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { companyMetrics } from "@/lib/company-metrics";

const TimeSeriesLines = dynamic(
  () =>
    import("@/components/charts/time-series-lines").then(
      (m) => m.TimeSeriesLines,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-64 items-center justify-center"><CircleLoader size="s" inline /></div>
    ),
  },
);

const QUICK_PERIODS = [{label:"1주",months:0},{label:"3달",months:3},{label:"6달",months:6},{label:"1년",months:12}];
function quickPeriodStart(end: Date, months: number) {
  const start = new Date(end.getTime() + 9*60*60*1000);
  if (months) {
    const day = start.getUTCDate();
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth()-months);
    const lastDay = new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
    start.setUTCDate(Math.min(day,lastDay));
  } else start.setUTCDate(start.getUTCDate()-7);
  start.setTime(start.getTime()-9*60*60*1000);
  return start;
}

type ViewMode = "single" | "grid" | "list";
const MODES: { key: ViewMode; label: string }[] = [
  { key: "single", label: "하나씩" },
  { key: "grid", label: "모아 보기" },
  { key: "list", label: "세로 보기" },
];

function metricTitle(metric: MetricDef) {
  return `${metric.label ?? metric.code}${metric.unit ? ` (${metric.unit})` : ""}`;
}

function toPointNumber(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) && !isUnmeasuredMetricValue(v) ? v : null;
}

function localDateTime(value: string | null, fallback: Date) {
  const date = value ? new Date(value) : fallback;
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {timeZone:"Asia/Seoul", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23"}).format(date).replace(" ","T");
}

export default function SiteDetailClient({ slug }: { slug: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const from = sp.get("from");
  const to = sp.get("to");
  const periodActive = !!(from && to);
  const activePeriod = from && to ? QUICK_PERIODS.find(period => Math.abs(quickPeriodStart(new Date(to), period.months).getTime() - new Date(from).getTime()) < 1000)?.label : undefined;
  const [periodStart, setPeriodStart] = useState(() => localDateTime(from, new Date(Date.now() - 86400000)));
  const [periodEnd, setPeriodEnd] = useState(() => localDateTime(to, new Date()));
  const [periodError, setPeriodError] = useState("");
  useEffect(() => {
    if (from && to) {
      setPeriodStart(localDateTime(from, new Date()));
      setPeriodEnd(localDateTime(to, new Date()));
    }
    setPeriodError("");
  }, [from, to]);
  const takeRaw = Number(sp.get("take") ?? 50);
  const take = clampTake(takeRaw);
  const { data, isLoading, isError, error, refetch, isFetching } = useSiteDetailQuery(
    slug,
    take,
    from,
    to,
  );
  const { session } = useAuth();
  const detailSiteId = data?.site.siteDb ?? "";
  const profile = useHospitalProfile(detailSiteId);
  const assets = useHospitalAssets(detailSiteId);
  const officeAssets = useOfficeAssetsQuery(detailSiteId, !!session);
  const planning = usePlanning();
  const history = useHospitalHistory(detailSiteId);
  const alertSettings = useQuery({queryKey:["alert-thresholds"], queryFn:()=>apiFetch<SiteAlertSettings[]>("/alerts/thresholds"), staleTime:60_000, enabled: !!session && !!data && data.monitoringConnected !== false});
  const detailLoading = !!data && (profile.isPending || assets.isPending || officeAssets.isPending || planning.isPending || history.isPending || (data.monitoringConnected !== false && alertSettings.isPending));
  const openedSite = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (isLoading || detailLoading || !data || openedSite.current === slug) return;
    openedSite.current = slug;
    // Next can preserve scroll while the loading placeholder is replaced by the page.
    // Reset only on entering a hospital, not on chart filters, refetches or anchor links.
    if (!window.location.hash) scrollPageToTop();
  }, [slug, isLoading, detailLoading, data]);
  const metrics = useMemo(() => companyMetrics(data?.metricConfig), [data?.metricConfig]);
  const [selected, setSelected] = useState<MetricKey[]>(["hepres", "heleve"]);
  const [mode, setMode] = useState<ViewMode>("single");
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
  const selection = useMemo(() => {
    const available = selected.filter((key) => metrics.some((metric) => metric.key === key));
    return available.length ? available : metrics.slice(0, 2).map((metric) => metric.key);
  }, [metrics, selected]);
  const currentFocus = selection.includes(focused) ? focused : selection[0];
  const visibleKeys = mode === "single" ? [currentFocus] : selection;
  const visibleMetrics = visibleKeys.flatMap((key) =>
    metrics.filter((m) => m.key === key),
  );

  useEffect(() => {
    if (!data || !metrics.length) return;
    if (selected.length !== selection.length || selected.some((key, index) => key !== selection[index])) {
      setSelected(selection);
    }
    if (focused !== currentFocus) setFocused(currentFocus);
  }, [currentFocus, data, focused, metrics.length, selected, selection]);

  const toggleMetric = (key: MetricKey) => {
    if (selection.includes(key)) {
      const next = selection.filter((item) => item !== key);
      if (!next.length) return;
      setSelected(next);
      if (focused === key) setFocused(next[0]);
    } else if (selection.length < 4) {
      setSelected([...selection, key]);
      setFocused(key);
    }
  };



  if (isLoading || detailLoading) {
    return (
      <PageLoader as="main" />
    );
  }

  if (isError || !data) {
    return (
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 lg:px-6">
        <div className="rounded-lg border border-red-200 bg-red-50/60 p-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error instanceof Error ? error.message : "데이터를 불러오지 못했습니다. 다시 시도해주세요."}
          <Link href={`/sites/${encodeURIComponent(slug)}?take=50`} className="ml-2 inline-flex min-h-11 items-center underline">최신 50건 보기</Link>
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

  const monitoringConnected = data.monitoringConnected ?? true;
  const monitoringSiteId = data.monitoringSiteId || data.site.siteDb;
  const rowsDesc = data.rows; // desc
  const totalCount = data.totalCount ?? data.rows.length;
  const chartPeriodLabel = periodActive ? `${fmtDate(from).slice(0,16)} ~ ${fmtDate(to).slice(0,16)} · ${rowsDesc.length}건` : undefined;
  const points: TimeSeriesPoint[] = rowsDesc
    .slice()
    .reverse()
    .map((r) => {
      const d = r.date ? new Date(r.date) : null;
      return {
        t: d ? fmtTime(d) : "-",
        at: d ? fmtDate(d) : "-",
        ...Object.fromEntries(
          visibleKeys.map((key) => [key, toPointNumber(r[key])]),
        ),
      };
    });

  const lastAtLabel = data.lastAt ? fmtDate(new Date(data.lastAt)) : "-";

  return (
    <main className="site-detail-page mobile-safe-inline mx-auto w-full max-w-7xl overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <div className="hospital-dashboard-back mb-2 sm:mb-3">
        <Link
          className="text-text-secondary hover:bg-background-tertiary hover:text-text-major dark:text-text-dark-primary/70 dark:hover:bg-background-dark-secondary dark:hover:text-text-dark-primary inline-flex min-h-10 items-center justify-center gap-x-1.5 rounded-lg px-2 text-sm font-bold transition-colors"
          href={monitoringConnected ? `/?scrollTo=${encodeURIComponent(slug)}` : "/hospitals"}
        >
          <ArrowBackIconMini className="h-4 w-4" /> {monitoringConnected ? "대시보드" : "병원 목록"}
        </Link>
      </div>

      <div className="hospital-detail-card">
        <div className="min-w-0">
          <h1 className="text-text-major dark:text-text-dark-primary text-2xl font-extrabold tracking-tight break-words">
            {data.site.name || "-"}
          </h1>
        </div>
      </div>

      <HospitalDetailTabs key={slug} monitoringConnected={monitoringConnected} management={<>
      <HospitalSection key={`${slug}-info`} title="병원 정보" anchor="hospital-info" allScreens defaultOpen>
        <div className="hospital-detail-card">
        {monitoringConnected && <div className="text-text-secondary dark:text-text-dark-primary/60 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>
            최신 수집
            <span className="text-text-major dark:text-text-dark-primary/80 ml-1 font-medium tabular-nums">
              {lastAtLabel}
            </span>
          </span>
        </div>}
        <HospitalProfile siteId={data.site.siteDb} />
        </div>
      </HospitalSection>

      {monitoringConnected && <HospitalSection key={`${slug}-alerts`} title="내 알림 기준" anchor="hospital-alert-summary" allScreens>
        <SiteAlertSummary siteId={monitoringSiteId} names={Object.fromEntries(metrics.map(metric=>[metric.key,metric.label ?? metric.code]))} />
      </HospitalSection>}

      <HospitalSection key={`${slug}-equipment`} title="장비·부품" anchor="hospital-equipment" allScreens>
        <HospitalEquipmentPanel siteId={data.site.siteDb} returnPath={`/sites/${encodeURIComponent(slug)}`} />
      </HospitalSection>
      <HospitalSection key={`${slug}-plan`} title="점검 주기·지정일" anchor="inspection-plan" allScreens>
        <HospitalPlanning siteId={data.site.siteDb} />
      </HospitalSection>
      <HospitalSection key={`${slug}-history`} title="병원 정비이력" anchor="hospital-history" allScreens>
        <HospitalWork siteId={data.site.siteDb} />
      </HospitalSection>
      </>}>

      {monitoringConnected && <section className="hospital-detail-card site-chart-workspace" aria-label="측정값 그래프">
      <header className="site-chart-heading">
        <h2>측정값 그래프</h2>
        <p>{periodActive ? `${fmtDate(from).slice(0,16)} ~ ${fmtDate(to).slice(0,16)}` : "최근 측정 기록"} · {rowsDesc.length.toLocaleString()}개 측정값 표시</p>
        {rowsDesc.length > 0 && !periodActive && <small>{fmtDate(rowsDesc[rowsDesc.length - 1].date)} ~ {fmtDate(rowsDesc[0].date)}</small>}
      </header>
      <details className="site-chart-query">
        <summary><span>조회 조건 변경</span><span>{periodActive ? "기간 지정" : "최신 기록"} · {take}개</span></summary>
      <fieldset className="site-chart-query-body">
        <legend className="sr-only">그래프 조회 조건</legend>
        <p className="site-chart-field-label">그래프에 표시할 측정값 개수</p>
        <div className="site-query-grid grid min-h-11 w-full grid-cols-4 gap-2">
          <TakeLink
            slug={slug}
            from={from}
            to={to}
            take={10}
            active={take === 10}
          />
          <TakeLink
            slug={slug}
            from={from}
            to={to}
            take={20}
            active={take === 20}
          />
          <TakeLink
            slug={slug}
            from={from}
            to={to}
            take={50}
            active={take === 50}
          />
          <TakeLink
            slug={slug}
            from={from}
            to={to}
            take={100}
            active={take === 100}
          />
        </div>
        <p className="site-chart-field-label mt-4">조회 기간</p>
        <div role="group" aria-label="빠른 기간 조회" className="site-query-grid mt-3 grid grid-cols-4 gap-2">
          {QUICK_PERIODS.map(period=><button key={period.label} type="button" aria-pressed={activePeriod === period.label} disabled={isFetching} onClick={()=>{
            const end = new Date();
            const start = quickPeriodStart(end, period.months);
            setPeriodError("");
            router.push(`/sites/${encodeURIComponent(slug)}?${new URLSearchParams({from:start.toISOString(),to:end.toISOString(),take:String(take)})}`,{scroll:false});
          }} className={`min-h-11 whitespace-nowrap rounded-lg border px-2 text-sm font-bold disabled:opacity-50 ${activePeriod === period.label ? "border-brand-primary bg-brand-primary text-white" : "border-slate-300 bg-white text-sky-800 dark:border-slate-600 dark:bg-background-dark-secondary dark:text-sky-200"}`}>{period.label}</button>)}
        </div>
        <form className="site-period-form mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end" onSubmit={event => {
          event.preventDefault();
          // Read the actual inputs: native date pickers can update their value before React state.
          const inputs = new FormData(event.currentTarget);
          const start = new Date(`${inputs.get("periodStart")}+09:00`);
          const end = new Date(`${inputs.get("periodEnd")}+09:00`);
          if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
            setPeriodError("종료 일시를 시작 일시보다 늦게 입력해주세요."); return;
          }
          // Include the entire selected end minute.
          end.setTime(end.getTime() + 59_999);
          setPeriodError("");
          const nextFrom = start.toISOString(), nextTo = end.toISOString();
          if (from === nextFrom && to === nextTo) void refetch();
          else router.push(`/sites/${encodeURIComponent(slug)}?${new URLSearchParams({from:nextFrom, to:nextTo, take:String(take)})}`, {scroll:false});
        }}>
          <label className="text-xs font-bold">시작 일시<input type="datetime-local" name="periodStart" required value={periodStart} onInput={event => setPeriodStart(event.currentTarget.value)} onChange={event => setPeriodStart(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border bg-transparent px-2 dark:border-white/15 dark:text-white" /></label>
          <label className="text-xs font-bold">종료 일시<input type="datetime-local" name="periodEnd" required value={periodEnd} onInput={event => setPeriodEnd(event.currentTarget.value)} onChange={event => setPeriodEnd(event.target.value)} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border bg-transparent px-2 dark:border-white/15 dark:text-white" /></label>
          <button type="submit" disabled={isFetching} className="min-h-11 whitespace-nowrap rounded-lg bg-sky-700 px-4 text-sm font-bold text-white disabled:opacity-50">{isFetching ? <CircleLoader size="xs" inline /> : "기간 조회"}</button>
        </form>
        {periodError && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-300">{periodError}</p>}
        {periodActive && <div className="mt-3 space-y-2 text-xs">
          <p>조회 기간: {fmtDate(from)} ~ {fmtDate(to)} · 전체 {totalCount.toLocaleString()}건</p>
          <p>{data.rows.length ? `현재 차트: ${fmtDate(data.rows[data.rows.length-1].date)} ~ ${fmtDate(data.rows[0].date)} · ${data.rows.length.toLocaleString()}건` : "해당 기간에 수집된 기록이 없습니다."}</p>
          <Link href={`/sites/${encodeURIComponent(slug)}?take=${take}`} scroll={false} className="inline-flex min-h-11 items-center rounded-lg border px-3 font-bold dark:border-white/15">기간 해제 · 최신 {take}건</Link>
        </div>}
        <p className="text-text-secondary mt-2 text-[11px]">한국 시간 기준입니다. 기간을 지정하면 해당 기간에서 선택한 개수만큼 고르게 추려 모든 그래프에 동일하게 적용합니다.</p>
      </fieldset>
      </details>

      <div className="site-chart-toolbar" aria-label="그래프 보기 설정">
        <p className="site-chart-field-label">그래프 배치</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="site-chart-modes"
            role="group"
            aria-label="보기 모드"
          >
            {MODES.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={mode === item.key}
                onClick={() => setMode(item.key)}
                className={mode === item.key ? "is-active" : ""}
              >
                <span className={`chart-layout-icon chart-layout-${item.key}`} aria-hidden="true"><i /><i /><i /><i /></span>
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
              측정항목{" "}
              <span className="text-brand-primary dark:text-brand-dark-primary">
                {selection.length}/4
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
                  ["온도", ["actemp", "gctemp", "cctemp", "ccflow"]],
                  ["냉각", ["gctemp", "gcflow", "cctemp", "ccflow"]],
                ] as [string, MetricKey[]][]
              ).filter(([, keys]) => keys.some((key) => metrics.some((metric) => metric.key === key))).map(([label, keys]) => (
                <button
                  key={label}
                  type="button"
                  className="min-h-11 rounded-lg border px-3 text-sm"
                  onClick={() => {
                    const visible = keys.filter((key) => metrics.some((metric) => metric.key === key));
                    setSelected(visible);
                    setFocused(visible[0]);
                  }}
                >
                  {label} 묶음
                </button>
              ))}
            </div>
            <p className="text-text-secondary dark:text-text-dark-primary/70 mb-2 text-sm">
              {selection.length === 4
                ? "4개 선택 완료 · 다른 항목을 추가하려면 선택한 항목 하나를 해제하세요."
                : "최소 1개, 최대 4개 항목을 선택하세요."}
            </p>
            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {metrics.map((metric) => {
                const active = selection.includes(metric.key);
                return (
                  <button
                    key={metric.key}
                    type="button"
                    aria-pressed={active}
                    disabled={
                      active ? selection.length === 1 : selection.length === 4
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
        <p className="site-chart-mode-hint">{mode === "single" ? "아래에서 선택한 항목 하나를 큰 그래프로 봅니다." : mode === "grid" ? "선택한 항목을 작은 그래프로 나란히 봅니다." : "선택한 항목을 큰 그래프로 위에서 아래로 봅니다."}</p>
        {mode === "single" && <div
          className="site-chart-focus-items"
          role="group"
          aria-label="크게 볼 측정항목"
        >
          {selection.map((key) => {
            const metric = metrics.find((item) => item.key === key)!;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setFocused(key);
                  setMode("single");
                }}
                aria-pressed={mode === "single" && currentFocus === key}
                className={`min-h-11 max-w-full rounded-md border px-3 py-1 text-sm break-words ${mode === "single" && currentFocus === key ? "bg-brand-primary font-bold text-white" : ""}`}
              >
                {metricTitle(metric)}
              </button>
            );
          })}
        </div>}
      </div>

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
              {points.some((point) => point[metric.key] != null) ? (
                <TimeSeriesLines
                  title={metricTitle(metric)}
                  headerExtra={<div className="site-chart-reading"><span>{periodActive ? "기간 마지막 값" : "최신 값"} <strong>{formatMetricMeasurement(rowsDesc[0]?.[metric.key], metric.unit)}</strong></span>{mode !== "single" && <button type="button" aria-label={`${metricTitle(metric)} 크게 보기`} onClick={() => { setFocused(metric.key); setMode("single"); }}>크게 보기</button>}</div>}
                  points={points}
                  series={[{ key: metric.key, name: metricTitle(metric) }]}
                  height={mode === "grid" ? 190 : 280}
                  interactive={false}
                />
              ) : (
                <div className="dark:bg-background-dark-card rounded-lg border bg-white p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{metricTitle(metric)}</h2>{chartPeriodLabel && <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-bold text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">기간 조회</span>}</div>
                  {chartPeriodLabel && <p className="text-text-secondary mt-2 text-xs leading-5">{chartPeriodLabel}</p>}
                  <p className="mt-2">선택한 기간에 측정된 값이 없습니다.</p>
                </div>
              )}
            </div>
          ))}
      </div>
      </section>}
      </HospitalDetailTabs>
    </main>
  );
}

function TakeLink({
  from, to,
  slug,
  take,
  active,
}: {
  slug: string;
  from?: string | null;
  to?: string | null;
  take: number;
  active: boolean;
}) {
  return (
    <Link
      href={`/sites/${encodeURIComponent(slug)}?${new URLSearchParams(from && to ? {from,to,take:String(take)} : {take:String(take)})}`}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={[
        "site-take-button inline-flex min-h-11 min-w-0 items-center justify-center rounded-lg border px-2 text-sm font-extrabold tabular-nums transition-colors",
        active
          ? "border-brand-primary bg-brand-primary text-white"
          : "border-slate-300 bg-white text-text-secondary hover:text-text-major dark:border-slate-600 dark:bg-background-dark-secondary dark:text-text-dark-primary/60 dark:hover:text-text-dark-primary",
      ].join(" ")}
    >
      {take}건
    </Link>
  );
}
