"use client";

import Link from "@/components/common/app-link";
import CircleLoader from "@/components/icons/circle-loader";



import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, type SiteAlertSettings } from "@/lib/api";

export type MetricSelection = { siteId: string; hospital: string; metricKey: string; label: string };

export default function DashboardMetricInfo({ selection, onClose, onEdit }: { selection: MetricSelection; onClose: () => void; onEdit: () => void }) {
  const settings = useQuery({
    queryKey: ["alert-thresholds"],
    queryFn: () => apiFetch<SiteAlertSettings[]>("/alerts/thresholds"),
    staleTime: 60_000,
  });
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    // Count from the click, even if the query is slow or offline. Query results
    // and background refetches must not extend the deadline.
    const timer = setTimeout(() => closeRef.current(), 3000);
    return () => clearTimeout(timer);
  }, [selection]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const site = settings.data?.find(item => item.siteid === selection.siteId);
  const threshold = site?.thresholds.find(item => item.key === selection.metricKey);
  const format = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("ko-KR", {maximumFractionDigits: 2});
  return <div role="dialog" aria-label={`${selection.hospital} ${selection.label} 알림 정보`} className="fixed right-3 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-3 z-[60] mx-auto max-w-xl rounded-xl bg-slate-900/95 px-4 py-3 text-sm text-white shadow-lg dark:bg-slate-800">
    <button type="button" aria-label="항목 정보 닫기" onClick={onClose} className="float-right ml-3 min-h-11 min-w-11 rounded-lg text-lg">×</button>
    <p className="font-bold">{selection.hospital} · {selection.label}</p>
    <p className="mt-1">{settings.isPending ? <CircleLoader size="xs" /> : settings.isError ? "알림 기준을 불러오지 못했습니다." : !threshold ? "설정 없음" : `회사 공통 · ${selection.metricKey === "hepres" ? "7일" : "24시간"} 평균 ${format(threshold.averageValue)} ${threshold.unit ?? ""}`}</p>
    {threshold && <p className="mt-1 text-sm text-slate-300">{!site?.alertsEnabled ? "이 병원은 회사 전체 알림이 꺼져 있습니다." : `평균에서 ±${threshold.tolerancePercent}% 벗어나면 노란색 주의 표시`}</p>}
    {threshold && !threshold.averageApplied && <p className="mt-2 text-sm text-amber-200">평균을 계산할 측정값이 부족합니다. 고정 수치 기준과 누락 횟수는 계속 확인합니다.</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      {threshold && <button type="button" onClick={onEdit} className="min-h-11 rounded-lg bg-white px-4 text-sm font-bold text-sky-900">알림 기준 보기</button>}
      <Link
        href={`/sites/${encodeURIComponent(selection.siteId)}?${new URLSearchParams({ metric: selection.metricKey })}#measurement-chart`}
        scroll={false}
        onNavigate={onClose}
        className="inline-flex min-h-11 items-center rounded-lg border border-white/40 px-4 text-sm font-bold text-white"
      >자세히</Link>
    </div>
  </div>;
}
