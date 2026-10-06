import type { SiteRow } from "@/hooks/use-dashboard-query";

export function collectionMissing(row: SiteRow) {
  return row.missedCollectionCount != null && row.missedCollectionCount >= (row.missingCollectionThreshold ?? 2);
}

export default function CollectionStatus({ row }: { row: SiteRow }) {
  if (row.lastAt == null) return <span className="mt-1 block text-[10px] font-bold text-slate-500">수집 기록 없음</span>;
  if (!row.missedCollectionCount) return null;
  return <span className={`mt-1 inline-flex whitespace-nowrap rounded-md px-1 py-0.5 text-[10px] font-extrabold ${collectionMissing(row) ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`} title={`${row.collectionIntervalMinutes ?? 10}분 주기 · ${row.missingCollectionThreshold ?? 2}회부터 알림 대상 · 마지막 수집 ${row.lagMin}분 전`}><span className="hidden sm:inline">수집&nbsp;</span>누락 {row.missedCollectionCount}회</span>;
}
