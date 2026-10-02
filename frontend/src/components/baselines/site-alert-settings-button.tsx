"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch, type SiteAlertSettings } from "@/lib/api";
import dynamic from "next/dynamic";

const SiteThresholdEditor = dynamic(() => import("./baselines-client").then(module => module.SiteThresholdEditor), {
  loading: () => <div role="status" className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 text-white">설정 화면을 여는 중…</div>,
});

/** All entry points share the editor, authorization and query cache. */
export default function SiteAlertSettingsButton({ siteId }: { siteId: string }) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: ["alert-thresholds"],
    queryFn: () => apiFetch<SiteAlertSettings[]>("/alerts/thresholds"),
    enabled: open,
    staleTime: 60_000,
    refetchInterval: open ? 60_000 : false,
  });
  const entry = settings.data?.find(site => site.siteid === siteId);
  async function save(value: SiteAlertSettings) {
    const saved = await apiFetch<SiteAlertSettings>(`/alerts/thresholds/${encodeURIComponent(siteId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        thresholds: value.thresholds.map(({key,min,max,active,useAverage,tolerancePercent}) =>
          ({key,min,max,active,useAverage,tolerancePercent})),
        noDataMinutes: value.noDataMinutes,
        noDataActive: value.noDataActive,
        alertsEnabled: value.alertsEnabled,
        triggerAfterMinutes: value.triggerAfterMinutes,
        repeatMinutes: value.repeatMinutes,
        quietStart: value.quietStart,
        quietEnd: value.quietEnd,
        suppressWeekends: value.suppressWeekends,
        holidayDates: value.holidayDates,
        coldChillerActive: value.coldChillerActive,
        collectionIntervalMinutes: value.collectionIntervalMinutes,
        missingCollectionThreshold: value.missingCollectionThreshold,
      }),
    });
    client.setQueryData<SiteAlertSettings[]>(["alert-thresholds"], (current = []) =>
      current.map(site => site.siteid === saved.siteid ? saved : site));
    await Promise.all([
      client.invalidateQueries({queryKey:["dashboard"]}),
      client.invalidateQueries({queryKey:["siteDetail"]}),
      client.invalidateQueries({queryKey:["alert-events"]}),
    ]);
    return saved;
  }
  return <>
    <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-lg border border-sky-200 px-3 py-2 text-xs font-bold text-sky-800 dark:border-sky-800 dark:text-sky-200">알림값 설정</button>
    {open && createPortal(<>
      {entry && !settings.isError && <SiteThresholdEditor entry={entry} canEdit={isAdmin} onClose={() => setOpen(false)} onSave={save} />}
      {(!entry || settings.isError) && <div role="dialog" aria-modal="true" aria-label="알림값 설정 불러오기" className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4"><div className="w-full max-w-sm rounded-xl bg-white p-5 dark:bg-background-dark-card"><p role="status">{settings.isPending ? "알림 설정을 불러오는 중…" : settings.isError ? "알림 설정을 불러오지 못했습니다." : "이 사업장의 알림 설정에 접근할 수 없습니다."}</p><div className="mt-4 flex gap-3">{settings.isError && <button type="button" onClick={() => settings.refetch()} className="min-h-11 font-bold">다시 시도</button>}<button type="button" onClick={() => setOpen(false)} className="min-h-11 font-bold">닫기</button></div></div></div>}
    </>, document.body)}
  </>;
}
