"use client";

import type { SiteRow } from "@/hooks/use-dashboard-query";

export default function DashboardHiddenSites({ rows, saving, error, onShow }: {
  rows: SiteRow[]; saving: boolean; error: boolean; onShow: (siteId: string) => void;
}) {
  if (rows.length === 0) return null;
  const openAlerts = rows.reduce((total, row) => total + row.openAlertCount, 0);
  return <details className="mt-1 shrink-0 rounded-lg border border-amber-200/70 bg-amber-50 text-xs dark:border-amber-700/40 dark:bg-background-dark-card">
    <summary className="flex min-h-9 cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-amber-800 dark:text-amber-200">
      <span className="font-bold">숨긴 병원 {rows.length}개 · 알림 중지 중</span>
      {openAlerts > 0 && <span className="font-bold text-rose-600 dark:text-rose-300">진행 중 알림 {openAlerts}건</span>}
      <span className="ml-auto underline underline-offset-2">목록 보기</span>
    </summary>
    <div className="border-t border-amber-200/60 px-3 pb-2 dark:border-amber-700/30">
      <p className="py-2 text-slate-500 dark:text-slate-300">다시 표시하면 기존 알림 설정으로 수신을 재개합니다.</p>
      <ul className="max-h-[22dvh] overflow-y-auto overscroll-contain">
        {rows.map(row => <li key={row.siteDb} className="flex min-h-11 items-center gap-2 border-t border-amber-200/40 dark:border-amber-700/20">
          <span className="min-w-0 flex-1 break-words text-slate-700 dark:text-slate-200">{row.name ?? row.siteDb}{row.alertStatus !== "NORMAL" && <span className="ml-1 font-bold text-rose-600 dark:text-rose-300">· {row.alertStatus === "NO_DATA" ? "수신 중단" : "기준 이탈"}</span>}</span>
          <button type="button" disabled={saving} aria-label={`${row.name ?? row.siteDb} 다시 표시`} onClick={() => onShow(row.siteDb)} className="min-h-11 shrink-0 px-2 font-bold text-sky-700 underline disabled:opacity-50 dark:text-sky-300">다시 표시</button>
        </li>)}
      </ul>
      {saving && <p role="status" className="py-1 text-slate-500">저장 중…</p>}
      {error && <p role="alert" className="py-1 text-rose-600">저장하지 못했습니다. 다시 시도해주세요.</p>}
    </div>
  </details>;
}
