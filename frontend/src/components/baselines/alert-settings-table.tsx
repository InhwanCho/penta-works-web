"use client";

import type { MetricKey } from "@/lib/metrics";
import type { SiteAlertSettings } from "@/lib/api";
import { DEFAULT_COLUMN_ORDER } from "@/lib/company-metrics";
import { useMemo, useState, type ReactNode } from "react";

export type AlertSettingsPane = "metrics" | "missing" | "schedule";
function label(key: string, name?: string | null) {
  if(key==="hepres" && (!name || name==="He Pressure"))return "헬륨 압력";
  if(key==="heleve" && (!name || name==="He Level"))return "헬륨 잔량";
  return name || key;
}
function number(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "—" : value.toLocaleString("ko-KR",{maximumFractionDigits:2});
}

/** Shared by dashboard and personal alert management. Each cell edits the same personal policy. */
export default function AlertSettingsTable({ entries, metrics, onOpen, onToggle, busySite, canEdit=true, actions }: {
  entries: SiteAlertSettings[];
  metrics?: {key: MetricKey; label?: string | null}[];
  onOpen: (site: SiteAlertSettings, metricKey?: string, pane?: AlertSettingsPane) => void;
  onToggle?: (site: SiteAlertSettings) => void;
  busySite?: string | null;
  canEdit?: boolean;
  actions?: (site: SiteAlertSettings) => ReactNode;
}) {
  const [metricKey,setMetricKey]=useState("all");
  const [mobileSiteId,setMobileSiteId]=useState("");
  const mobileSite=entries.find(site=>site.siteid===mobileSiteId) ?? entries[0];
  const available=useMemo(()=> {
    if(metrics)return metrics;
    const columns=new Map(entries.flatMap(site=>site.thresholds.map(t=>[t.key,{key:t.key,label:t.label}] as const)));
    return [...columns.values()].sort((a,b)=>DEFAULT_COLUMN_ORDER.indexOf(a.key)-DEFAULT_COLUMN_ORDER.indexOf(b.key));
  },[entries,metrics]);
  const shown=available.filter(m=>metricKey==="all" || m.key===metricKey);
  const cell="min-h-12 w-full rounded-lg px-3 py-2 text-base font-bold transition hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-sky-600 dark:hover:bg-sky-950/40";
  return <section aria-label="병원별 내 알림값 설정" className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/15 dark:bg-background-dark-card">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-white/10">
      <div><h2 className="text-lg font-extrabold">내 병원별 알림값</h2><p className="mt-1 text-base leading-7 text-text-secondary">측정항목이나 설정 버튼을 눌러 변경하세요.</p></div>
      <label className="text-base font-bold">측정항목<select value={metricKey} onChange={e=>setMetricKey(e.target.value)} className="ml-2 min-h-12 max-w-full rounded-lg border border-slate-300 bg-white px-3 text-base dark:border-white/20 dark:bg-background-dark-primary"><option value="all">전체 항목</option>{available.map(m=><option key={m.key} value={m.key}>{label(m.key,m.label)}</option>)}</select></label>
    </div>
    <div className="space-y-4 p-3 lg:hidden">
      <label className="block text-base font-bold">설정할 병원<select aria-label="설정할 병원" value={mobileSite?.siteid ?? ""} onChange={event=>setMobileSiteId(event.target.value)} className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-white/20 dark:bg-background-dark-primary">{entries.map(site=><option key={site.siteid} value={site.siteid}>{site.name ?? site.siteid}</option>)}</select></label>
      {(mobileSite?[mobileSite]:[]).map(site => {
        const hospital=site.name ?? site.siteid;
        const metricButton=(m: typeof shown[number]) => {
          const t=site.thresholds.find(t=>t.key===m.key);
          if(!t)return null;
          return <button key={m.key} type="button" aria-label={`${hospital} ${label(t.key,t.label)} 알림값 설정`} onClick={()=>onOpen(site,m.key)} className="min-h-12 w-full rounded-xl border border-slate-200 p-3 text-left text-base dark:border-white/15">
            <span className="block font-bold">{label(t.key,t.label)}</span>
            <span className="mt-2 block font-bold text-sky-800 dark:text-sky-200">{t.active?`${number(t.effectiveMin)} – ${number(t.effectiveMax)} ${t.unit}`:'수치 알림 꺼짐'}</span>
            <span className="mt-1 block text-base text-text-secondary">{t.missingActive?`항목 누락 ${t.missingThreshold ?? 3}회 연속 시 알림`:'항목 누락 알림 꺼짐'}</span>
          </button>;
        };
        return <article key={site.siteid} className="rounded-xl border border-slate-200 p-3 dark:border-white/15">
          <h3 className="break-words text-xl font-extrabold">{hospital}</h3>
          <button type="button" disabled={busySite===site.siteid || !canEdit || !site.dashboardVisible} aria-label={onToggle?`${hospital} 내 알림 ${site.alertsEnabled?'끄기':'켜기'}`:`${hospital} 내 알림 설정`} onClick={()=>onToggle?onToggle(site):onOpen(site)} className={`mt-3 min-h-12 rounded-xl border px-4 text-base font-bold disabled:opacity-40 ${site.alertsEnabled && site.dashboardVisible ? "border-emerald-300 text-emerald-800 dark:border-emerald-800 dark:text-emerald-200" : "border-slate-300 text-slate-600 dark:border-white/20 dark:text-slate-300"}`}>{!site.dashboardVisible?'숨긴 병원':site.alertsEnabled?'내 알림 켜짐':'내 알림 꺼짐'}</button>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{shown.slice(0,2).map(metricButton)}</div>
          {shown.length>2 && <details className="mt-3"><summary className="min-h-12 cursor-pointer py-3 text-base font-bold text-sky-800 dark:text-sky-200">다른 측정항목 {shown.length-2}개 보기</summary><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{shown.slice(2).map(metricButton)}</div></details>}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" aria-label={`${hospital} 수집 중단 설정`} onClick={()=>onOpen(site,undefined,'missing')} className="min-h-12 rounded-xl border p-3 text-left text-base dark:border-white/15"><span className="block font-bold">데이터 누락</span><span className="mt-1 block">{site.noDataActive?`전체 수집: ${site.collectionIntervalMinutes}분 주기 · ${site.missingCollectionThreshold}회 누락`:'전체 수집 중단 알림 꺼짐'}</span></button>
            <button type="button" aria-label={`${hospital} 시간·휴일 설정`} onClick={()=>onOpen(site,undefined,'schedule')} className="min-h-12 rounded-xl border p-3 text-left text-base dark:border-white/15"><span className="block font-bold">시간·휴일</span><span className="mt-1 block">{site.quietStart && site.quietEnd?`${site.quietStart.slice(0,5)} ~ ${site.quietEnd.slice(0,5)} 쉬기`:'시간 제한 없음'}{site.suppressWeekends?' · 주말 쉬기':''}{site.holidayDates.length>0?` · 지정 날짜 ${site.holidayDates.length}일`:''}</span></button>
            <button type="button" aria-label={`${hospital} 반복 알림 설정`} onClick={()=>onOpen(site,'__repeat__','schedule')} className="min-h-12 rounded-xl border p-3 text-left text-base dark:border-white/15"><span className="block font-bold">반복 알림</span><span className="mt-1 block">{site.repeatMinutes?`${site.repeatMinutes}분마다`:'처음 한 번'}</span></button>
            <button type="button" aria-label={`${hospital} 콜드칠러 설정`} onClick={()=>onOpen(site,'__cold_chiller__')} className="min-h-12 rounded-xl border p-3 text-left text-base dark:border-white/15"><span className="block font-bold">콜드칠러 정지</span><span className="mt-1 block">{site.coldChillerActive?'알림 켜짐':'알림 꺼짐'}</span></button>
          </div>
          <button type="button" aria-label={`${hospital} 전체 알림 설정`} onClick={()=>onOpen(site)} className="mt-3 min-h-12 w-full rounded-xl bg-sky-700 p-3 text-base font-bold text-white">전체 설정</button>
          {actions?.(site)}
        </article>;
      })}
    </div>
    <div tabIndex={0} role="region" aria-label="알림값 표 · 좌우로 스크롤" className="hidden max-h-[70dvh] overflow-auto lg:block focus-visible:outline-2 focus-visible:outline-sky-600">
      <table className="w-full border-collapse text-base"><caption className="sr-only">병원별 수치 범위, 항목 누락 횟수와 발송 설정. 각 칸을 눌러 변경합니다.</caption>
        <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800"><tr><th scope="col" className="sticky left-0 z-30 min-w-40 bg-slate-100 p-3 text-left dark:bg-slate-800">병원명</th>{shown.map(m=><th scope="col" key={m.key} className="min-w-44 p-3">{label(m.key,m.label)}</th>)}{["병원 전체 수집 중단","콜드칠러 정지","시간·휴일","반복 알림","병원 설정"].map(label=><th scope="col" key={label} className="min-w-40 p-3">{label}</th>)}</tr></thead>
        <tbody>{entries.map(site=> {
          const hospital=site.name ?? site.siteid;
          return <tr key={site.siteid} className="border-t border-slate-200 align-top dark:border-white/10">
            <th scope="row" className="sticky left-0 z-10 w-40 min-w-40 bg-white p-3 text-left dark:bg-background-dark-card"><span className="block text-base font-extrabold">{hospital}</span><button type="button" disabled={busySite===site.siteid || !canEdit || !site.dashboardVisible} aria-label={onToggle?`${hospital} 내 알림 ${site.alertsEnabled?'끄기':'켜기'}`:`${hospital} 내 알림 설정`} onClick={()=>onToggle?onToggle(site):onOpen(site)} className={`mt-2 min-h-12 rounded-lg border px-3 text-base font-bold disabled:opacity-40 ${site.alertsEnabled && site.dashboardVisible?'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300':'border-slate-200 text-slate-500 dark:border-white/15 dark:text-slate-400'}`}>{!site.dashboardVisible?'숨긴 병원':site.alertsEnabled?'내 알림 켜짐':'내 알림 꺼짐'}</button></th>
            {shown.map(m=>{const t=site.thresholds.find(t=>t.key===m.key);return <td key={m.key} className="p-2 text-center">{t?<button type="button" aria-label={`${hospital} ${label(t.key,t.label)} 알림값 설정`} onClick={()=>onOpen(site,m.key)} className={cell}><span className={`block whitespace-nowrap ${t.active?'text-sky-800 dark:text-sky-200':'text-slate-500 dark:text-slate-400'}`}>{t.active?`${number(t.effectiveMin)} – ${number(t.effectiveMax)}`:'수치 알림 꺼짐'}</span>{t.active && <span className="mt-1 block text-sm font-normal text-text-secondary">{t.unit}{t.averageApplied?' · 24시간 평균':''}</span>}<span className={`mt-2 block whitespace-nowrap text-sm ${t.missingActive?'text-amber-800 dark:text-amber-200':'text-slate-500 dark:text-slate-400'}`}>{t.missingActive?`항목 누락 ${t.missingThreshold ?? 3}회`:'항목 누락 꺼짐'}</span><span className="mt-2 block text-sm font-normal text-sky-700 dark:text-sky-300">눌러서 설정</span></button>:<span className="block p-3 text-text-secondary">—</span>}</td>})}
            <td className="p-2 text-center"><button type="button" aria-label={`${hospital} 수집 중단 설정`} onClick={()=>onOpen(site,undefined,'missing')} className={cell}>{site.noDataActive?<><span className="block">{site.collectionIntervalMinutes}분 주기</span><span className="mt-1 block">{site.missingCollectionThreshold}회 연속 누락</span></>:'꺼짐'}</button></td>
            <td className="p-2 text-center"><button type="button" aria-label={`${hospital} 콜드칠러 설정`} onClick={()=>onOpen(site,'__cold_chiller__')} className={cell}>{site.coldChillerActive?'IN = OUT':'꺼짐'}</button></td>
            <td className="p-2 text-center"><button type="button" aria-label={`${hospital} 시간·휴일 설정`} onClick={()=>onOpen(site,undefined,'schedule')} className={cell}><span className="block whitespace-nowrap">{site.quietStart && site.quietEnd?`${site.quietStart.slice(0,5)} ~ ${site.quietEnd.slice(0,5)}`:'시간 제한 없음'}</span>{site.suppressWeekends && <span className="mt-1 block">토·일 제외</span>}{site.holidayDates.length>0 && <span className="mt-1 block">지정 날짜 {site.holidayDates.length}일</span>}</button></td>
            <td className="p-2 text-center"><button type="button" aria-label={`${hospital} 반복 알림 설정`} onClick={()=>onOpen(site,'__repeat__','schedule')} className={cell}>{site.repeatMinutes?`${site.repeatMinutes}분마다`:'처음 한 번'}</button></td>
            <td className="p-2 text-center"><button type="button" aria-label={`${hospital} 전체 알림 설정`} onClick={()=>onOpen(site)} className={cell}>전체 설정</button>{actions?.(site)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </section>;
}
