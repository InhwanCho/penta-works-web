"use client";

import { useContext, useEffect, useId, useState } from "react";
import CustomModal from "@/components/common/custom-modal";
import { ModalContext } from "@/components/provider/modal-provider";
import Link from "@/components/common/app-link";
import type { AlertSettingsPane } from "./alert-settings-table";
import CompanyAlertSettings from "./company-alert-settings";

export default function SiteAlertSettingsButton({ siteId }: { siteId: string }) {
  const [open,setOpen]=useState(false);
  return <><button type="button" onClick={()=>setOpen(true)} className="work-secondary hospital-section-action">알림 설정</button>{open && <SiteAlertSettingsDialog siteId={siteId} onClose={()=>setOpen(false)}/>}</>;
}

export function SiteAlertSettingsDialog({ page=false,siteId,onClose,onlyMetricKey,initialMetricKey }: {
  page?: boolean; siteId: string; initialMetricKey?: string; initialPane?: AlertSettingsPane; onlyMetricKey?: string; onClose:()=>void;
}) {
  const id = useId();
  const modal = useContext(ModalContext);
  const open = modal?.open;
  const close = modal?.close;
  useEffect(() => {
    if (page) return;
    open?.(id);
    return () => close?.(id);
  }, [page, id, open, close]);
  const content = <div className="mx-auto max-w-4xl p-3">
    <div className="mx-auto max-w-4xl"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-bold">알림 설정</h2><button autoFocus type="button" onClick={onClose} className="min-h-10 rounded-lg border px-5 font-bold">닫기</button></div>
    <CompanyAlertSettings siteId={siteId} metricKey={onlyMetricKey ?? initialMetricKey}/><Link href="/baselines?view=settings" className="mt-3 flex min-h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 active:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">전체 병원 알림 설정 보기</Link></div>
  </div>;
  return page ? content : <CustomModal id={id} onRequestClose={onClose} showCloseButton={false}>
    <div className="max-h-[80dvh] overflow-y-auto overflow-x-hidden">{content}</div>
  </CustomModal>;
}
