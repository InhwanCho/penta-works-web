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
  return <details className="rounded-xl border p-3">
    <summary className="cursor-pointer font-bold">표시할 병원 ({rows.length - hiddenCount}/{rows.length})</summary>
    <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">내 대시보드에서만 숨깁니다. 숨긴 병원의 알림은 기존 설정대로 발송됩니다.</p>
    <input type="search" aria-label="표시할 병원 검색" placeholder="병원 검색" value={search} onChange={event => setSearch(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border bg-transparent px-3" />
    <fieldset disabled={disabled} className="mt-2 max-h-52 overflow-y-auto overscroll-contain disabled:opacity-60">
      <legend className="sr-only">내 대시보드에 표시할 병원</legend>
      {matches.map(row => <label key={row.siteDb} className="flex min-h-11 cursor-pointer items-center gap-2 py-1">
        <input type="checkbox" checked={!hidden.has(row.siteDb)} onChange={event => onChange(row.siteDb, !event.target.checked)} />
        <span className="min-w-0 break-words">{row.name ?? row.siteDb}</span>
      </label>)}
      {matches.length === 0 && <p className="py-3 text-xs">검색 결과가 없습니다.</p>}
    </fieldset>
    <button type="button" disabled={disabled || hiddenCount === 0} onClick={onRestore} className="mt-2 min-h-11 text-sky-700 underline disabled:opacity-50 dark:text-sky-300">전체 병원 표시</button>
  </details>;
}
