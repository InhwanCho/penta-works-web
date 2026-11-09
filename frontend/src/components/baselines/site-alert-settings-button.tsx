"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "@/components/common/app-link";
import type { AlertSettingsPane } from "./alert-settings-table";
import CompanyAlertSettings from "./company-alert-settings";

export default function SiteAlertSettingsButton({ siteId }: { siteId: string }) {
  const [open,setOpen]=useState(false);
  return <><button type="button" onClick={()=>setOpen(true)} className="work-secondary hospital-section-action">알림 설정</button>{open && <SiteAlertSettingsDialog siteId={siteId} onClose={()=>setOpen(false)}/>}</>;
}

export function SiteAlertSettingsDialog({ page=false,siteId,onClose }: {
  page?: boolean; siteId: string; initialMetricKey?: string; initialPane?: AlertSettingsPane; onlyMetricKey?: string; onClose:()=>void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (page) return;
    const node=dialog.current;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    node?.showModal();
    return ()=>{node?.close();document.body.style.overflow=previous;};
  },[page]);
  const content = <div className="mx-auto max-w-4xl p-3">
    <div className="mx-auto max-w-4xl"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">알림 설정</h2><button autoFocus type="button" onClick={onClose} className="min-h-12 rounded-lg border px-5 font-bold">닫기</button></div>
    <CompanyAlertSettings siteId={siteId}/><Link href="/baselines?view=settings" className="my-4 inline-flex min-h-12 items-center underline">전체 병원 알림 설정 보기</Link></div>
  </div>;
  return page ? content : createPortal(<dialog ref={dialog} onCancel={onClose} aria-label="회사 공통 알림 설정"
    className="fixed inset-0 m-auto max-h-[95dvh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-0 text-slate-900 backdrop:bg-black/50 dark:bg-slate-950 dark:text-white">{content}</dialog>,document.body);
}
