"use client";

import { useState } from "react";
import type { SiteRow } from "@/hooks/use-dashboard-query";

export default function DashboardSiteFilter({ rows, hiddenSites, disabled, onChange, onRestore }: {
  rows: SiteRow[]; hiddenSites: string[]; disabled: boolean;
  onChange: (siteId: string, hidden: boolean) => void; onRestore: () => void;
}) {
  const [search, setSearch] = useState("");
  const hidden = new Set(hiddenSites);
  const hiddenCount = rows.filter(row => hidden.has(row.siteDb)).length;
  const matches = rows.filter(row => `${row.name ?? ""} ${row.siteDb}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <details className="dashboard-filter-section rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-800 dark:border-slate-600 dark:bg-background-dark-secondary dark:text-text-dark-primary">
    <summary className="cursor-pointer font-bold">표시할 병원 ({rows.length - hiddenCount}/{rows.length})</summary>
    <p className="mt-2 text-xs text-slate-600 dark:text-slate-200">숨기면 이 병원의 알림도 중지됩니다. 다시 표시하면 기존 알림 설정으로 수신을 재개합니다. 검색·상태 필터는 알림에 영향을 주지 않습니다.</p>
    <input type="search" aria-label="표시할 병원 검색" placeholder="병원 검색" value={search} onChange={event => setSearch(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 placeholder:text-slate-500 dark:border-slate-500 dark:bg-background-dark-primary dark:text-text-dark-primary" />
    <fieldset disabled={disabled} className="mt-2 max-h-52 overflow-y-auto overscroll-contain disabled:opacity-60">
      <legend className="sr-only">내 대시보드에 표시할 병원</legend>
      {matches.map(row => <label key={row.siteDb} className="flex min-h-11 cursor-pointer items-center gap-2 py-1">
        <input type="checkbox" checked={!hidden.has(row.siteDb)} onChange={event => onChange(row.siteDb, !event.target.checked)} />
        <span className="min-w-0 break-words">{row.name ?? row.siteDb}</span>
      </label>)}
      {matches.length === 0 && <p className="py-3 text-xs">검색 결과가 없습니다.</p>}
    </fieldset>
    <button type="button" disabled={disabled || hiddenCount === 0} onClick={onRestore} className="work-secondary mt-2 disabled:opacity-50">전체 병원 표시</button>
  </details>;
}
