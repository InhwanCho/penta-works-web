"use client";

import { averagePeriodMessage, averageUnavailableMessage } from "@/lib/alert-range";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, type SiteAlertSettings } from "@/lib/api";

export type MetricSelection = { siteId: string; hospital: string; metricKey: string; label: string };

export default function DashboardMetricInfo({ selection, onClose, onEdit }: { selection: MetricSelection; onClose: () => void; onEdit: () => void }) {
  const settings = useQuery({
    queryKey: ["alert-thresholds"],
    queryFn: () => apiFetch<SiteAlertSettings[]>("/alerts/thresholds"),
    staleTime: 60_000,
  });
  useEffect(() => {
    if (settings.isPending) return;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [selection, onClose, settings.isPending]);
  const site = settings.data?.find(item => item.siteid === selection.siteId);
  const threshold = site?.thresholds.find(item => item.key === selection.metricKey);
  const format = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("ko-KR", {maximumFractionDigits: 2});
  return <div role="status" aria-live="polite" className="fixed right-3 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-3 z-[60] mx-auto max-w-xl rounded-xl bg-slate-900/95 px-4 py-3 text-sm text-white shadow-lg dark:bg-slate-800">
    <button type="button" aria-label="항목 정보 닫기" onClick={onClose} className="float-right ml-3 min-h-8 min-w-8 rounded-lg text-lg">×</button>
    <p className="font-bold">{selection.hospital} · {selection.label}</p>
    <p className="mt-1">{settings.isPending ? "알림 범위를 불러오는 중…" : settings.isError ? "알림 범위를 불러오지 못했습니다." : !threshold ? "알림 범위 설정 없음" : `내 알림 범위: ${format(threshold.effectiveMin)} – ${format(threshold.effectiveMax)} ${threshold.unit ?? ""}`}</p>
    {threshold && <p className="mt-1 text-xs text-slate-300">{!site?.alertsEnabled ? "내 병원 알림 꺼짐" : !threshold.active ? "이 항목 알림 꺼짐" : "이 항목 알림 켜짐"} · {threshold.averageApplied ? threshold.historicalAverage ? "과거 24시간 평균 적용" : "24시간 평균 적용" : threshold.useAverage ? "평균 대기 · 대체 범위 적용" : "수동 범위 적용"}</p>}
    {threshold?.useAverage && threshold.historicalAverage && <p className="mt-2 text-xs leading-5 text-amber-200">최근 평균을 사용할 수 없어 마지막 정상 평균을 사용합니다.<br />{averagePeriodMessage(threshold)}</p>}
    {threshold?.useAverage && !threshold.averageApplied && <p className="mt-2 text-xs leading-5 text-amber-200">{averageUnavailableMessage(threshold)} 조건 충족 전까지 대체 범위를 사용합니다.</p>}
    {threshold && <button type="button" onClick={onEdit} className="mt-3 min-h-11 rounded-lg bg-white px-4 text-sm font-bold text-sky-900">이 알림 수정하기</button>}
  </div>;
}
