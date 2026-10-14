"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, type SiteAlertSettings } from "@/lib/api";

export default function SiteAlertSummary({siteId, names}: {siteId:string; names:Record<string,string>}) {
  const settings = useQuery({queryKey:["alert-thresholds"], queryFn:()=>apiFetch<SiteAlertSettings[]>("/alerts/thresholds"), staleTime:60_000, refetchInterval:60_000});
  const site = settings.data?.find(item=>item.siteid===siteId);
  const number = (value:number) => Number(value.toFixed(2));
  return <section aria-label="내 알림 기준" className="mb-3 rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-background-dark-card">
    <h2 className="font-bold">내 알림 기준</h2>
    {settings.isPending ? <p className="mt-2 text-text-secondary">불러오는 중…</p> : settings.isError ? <button type="button" onClick={()=>settings.refetch()} className="min-h-11 text-sky-700">기준을 불러오지 못했습니다 · 다시 시도</button> : !site ? <p className="mt-2 text-text-secondary">이 병원의 알림 기준을 확인할 수 없습니다.</p> : !site.alertsEnabled ? <p className="mt-2 text-text-secondary">이 병원의 내 알림이 꺼져 있습니다.</p> : <>
      <dl className="mt-2 space-y-2">{site.thresholds.filter(item=>item.active || item.missingActive).map(item=><div key={item.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><dt className="font-semibold">{names[item.key] ?? item.label}</dt><dd className="text-text-secondary">{item.active && <span>{number(item.effectiveMin)}–{number(item.effectiveMax)}{item.unit ? ` ${item.unit}` : ""}{item.useAverage ? item.averageApplied ? " · 평균 기준" : " · 대체 범위" : ""}</span>}{item.active && item.missingActive && " · "}{item.missingActive && `항목 누락 ${item.missingThreshold ?? 3}회`}</dd></div>)}</dl>
      <p className="mt-2 text-text-secondary">{[site.noDataActive ? `수집 중단 ${site.noDataMinutes}분` : null, site.coldChillerActive ? "콜드칠러 온도 차이 ≤ 0.1°C" : null].filter(Boolean).join(" · ")}</p>
      {!site.thresholds.some(item=>item.active || item.missingActive) && !site.noDataActive && !site.coldChillerActive && <p className="mt-2 text-text-secondary">켜진 알림 항목이 없습니다.</p>}
      <p className="mt-2 text-xs text-text-secondary">수치 2회 연속 이탈{site.triggerAfterMinutes ? ` · ${site.triggerAfterMinutes}분 지속 후` : " 시"} 알림 · 내 계정 기준</p>
    </>}
  </section>;
}
