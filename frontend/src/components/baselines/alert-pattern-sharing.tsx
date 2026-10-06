"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, type SiteAlertSettings } from "@/lib/api";

type SharedPattern = {id: number;siteId: string;siteName: string;senderName: string;recipientName: string;settings: SiteAlertSettings;createdAt: string;appliedAt: string | null};
const button = "min-h-11 rounded-lg border border-sky-200 px-3 text-sm font-bold text-sky-800 disabled:opacity-40 dark:border-sky-900 dark:text-sky-200";

export function SharePatternButton({entry}: {entry: SiteAlertSettings}) {
  const [open,setOpen]=useState(false);
  const [recipient,setRecipient]=useState("");
  const [message,setMessage]=useState("");
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;document.body.style.overflow="hidden";
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};document.addEventListener("keydown",close);
    return()=>{document.body.style.overflow=previous;document.removeEventListener("keydown",close);};
  },[open]);
  const targets=useQuery({queryKey:["alert-pattern-targets",entry.siteid],queryFn:()=>apiFetch<{id:number;name:string}[]>(`/alerts/patterns/targets?siteId=${encodeURIComponent(entry.siteid)}`),enabled:open});
  const share=useMutation({mutationFn:()=>apiFetch(`/alerts/patterns/${encodeURIComponent(entry.siteid)}/share`,{method:"POST",body:JSON.stringify({recipientId:Number(recipient)})}),onSuccess:()=>setMessage("패턴을 공유했습니다. 상대방이 확인 후 자신의 설정에 적용할 수 있습니다.")});
  return <>
    <button type="button" onClick={()=>{setOpen(true);setMessage("");share.reset();}} className={button}>패턴 공유</button>
    {open&&createPortal(<div role="dialog" aria-modal="true" aria-label={`${entry.name} 알림 패턴 공유`} className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-background-dark-card">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">{entry.name} · 패턴 공유</h2><button type="button" aria-label="패턴 공유 닫기" onClick={()=>setOpen(false)} className="h-11 w-11">×</button></div>
      <p className="mt-2 text-sm leading-6 text-text-secondary">저장된 알림 기준, 반복 주기, 조용한 시간·지정 휴일을 공유합니다. 수신 번호와 알림 이력은 포함되지 않습니다.</p>
      <p className="mt-2 text-xs leading-5 text-text-secondary">같은 회사에서 이 병원에 접근할 수 있는 담당자에게 보낼 수 있습니다. 상대방의 설정은 직접 적용하기 전까지 바뀌지 않습니다.</p>
      <label className="mt-4 block text-sm font-bold">받을 담당자<select value={recipient} onChange={e=>setRecipient(e.target.value)} disabled={share.isPending||targets.isPending||!!message} className="mt-2 min-h-11 w-full rounded-lg border bg-transparent px-3 dark:border-white/10"><option value="">담당자 선택</option>{targets.data?.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      {targets.isPending&&<p role="status" className="mt-3 text-sm">담당자를 불러오는 중…</p>}
      {targets.isError&&<button type="button" onClick={()=>targets.refetch()} className={button}>담당자 다시 불러오기</button>}
      {targets.data?.length===0&&<p className="mt-3 text-sm">공유 가능한 다른 담당자가 없습니다.</p>}
      {share.isError&&<p role="alert" className="mt-3 text-sm text-rose-600">{share.error.message}</p>}
      {message?<p role="status" className="mt-3 text-sm font-bold text-emerald-700">{message}</p>:<button type="button" disabled={!recipient||share.isPending} onClick={()=>share.mutate()} className={`mt-4 w-full ${button}`}>{share.isPending?"공유 중…":"저장된 패턴 보내기"}</button>}
    </div></div>,document.body)}
  </>;
}

export default function AlertPatternInbox() {
  const client=useQueryClient();
  const [preview,setPreview]=useState<SharedPattern|null>(null);
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    if(!preview)return;
    const previous=document.body.style.overflow;document.body.style.overflow="hidden";
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setPreview(null);};document.addEventListener("keydown",close);
    return()=>{document.body.style.overflow=previous;document.removeEventListener("keydown",close);};
  },[preview]);
  const inbox=useQuery({queryKey:["alert-pattern-inbox"],queryFn:()=>apiFetch<SharedPattern[]>("/alerts/patterns/shared"),refetchInterval:60000});
  const apply=useMutation({mutationFn:(id:number)=>apiFetch<SiteAlertSettings>(`/alerts/patterns/shared/${id}/apply`,{method:"POST"}),onSuccess:async(saved)=>{
    client.setQueryData<SiteAlertSettings[]>(["alert-thresholds"],(current=[])=>current.map(s=>s.siteid===saved.siteid?saved:s));
    await Promise.all([client.invalidateQueries({queryKey:["alert-pattern-inbox"]}),client.invalidateQueries({queryKey:["dashboard"]}),client.invalidateQueries({queryKey:["alert-events"]})]);
    setNotice(`${saved.name}의 내 알림 패턴에 적용했습니다.`);setPreview(null);
  }});
  return <section className="space-y-3">
    <h2 className="text-lg font-bold">받은 알림 패턴</h2><p className="text-sm text-text-secondary">내용을 확인한 뒤 내 설정으로 복사하세요. 공유 이후 원본이 변경돼도 내 설정은 유지됩니다.</p>
    {notice&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {inbox.isPending?<p role="status">불러오는 중…</p>:inbox.isError?<button type="button" onClick={()=>inbox.refetch()} className={button}>공유 패턴 다시 불러오기</button>:inbox.data?.length===0?<p className="rounded-xl border border-dashed p-5 text-sm">받은 패턴이 없습니다.</p>:inbox.data?.map(item=><article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 dark:border-white/10 dark:bg-background-dark-card"><div><h3 className="font-bold">{item.siteName}</h3><p className="mt-1 text-sm">{item.senderName}님이 공유 · {new Date(item.createdAt).toLocaleString("ko-KR")}</p>{item.appliedAt&&<p className="mt-1 text-xs text-emerald-700">적용 완료 · {new Date(item.appliedAt).toLocaleString("ko-KR")}</p>}</div><button type="button" className={button} onClick={()=>{setPreview(item);apply.reset();}}>패턴 확인</button></article>)}
    {preview&&createPortal(<div role="dialog" aria-modal="true" aria-label="공유 알림 패턴 확인" className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-3"><div className="flex max-h-[90dvh] w-full max-w-xl flex-col rounded-xl bg-white shadow-xl dark:bg-background-dark-card"><div className="flex items-center justify-between border-b p-4 dark:border-white/10"><div><h2 className="font-bold">{preview.siteName} · {preview.senderName}님의 패턴</h2><p className="mt-1 text-xs text-text-secondary">공유 당시 저장된 설정입니다.</p></div><button type="button" aria-label="공유 패턴 닫기" onClick={()=>setPreview(null)} className="h-11 w-11">×</button></div>
      <div className="overflow-y-auto p-4"><PatternSummary settings={preview.settings}/><p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">적용하면 이 병원의 내 알림 기준과 발송 제외 설정을 덮어씁니다. 수신 번호와 다른 담당자의 설정은 유지됩니다.</p>{apply.isError&&<p role="alert" className="mt-3 text-rose-600">{apply.error.message}</p>}</div>
      <div className="flex justify-end gap-3 border-t p-4 dark:border-white/10"><button type="button" className={button} onClick={()=>setPreview(null)}>닫기</button><button type="button" disabled={apply.isPending} onClick={()=>apply.mutate(preview.id)} className="min-h-11 rounded-lg bg-sky-700 px-4 text-sm font-bold text-white disabled:opacity-50">{apply.isPending?"적용 중…":"내 설정으로 적용"}</button></div>
    </div></div>,document.body)}
  </section>;
}

function PatternSummary({settings:s}: {settings:SiteAlertSettings}) {
  const format=(v:number|null)=>v==null?"—":v.toLocaleString("ko-KR",{maximumFractionDigits:2});
  return <div className="space-y-3 text-sm">
    <p className="font-bold">내 알림 {s.alertsEnabled?"사용":"중지"} · 콜드칠러 정지 의심 {s.coldChillerActive?"사용":"중지"}</p>
    <p>이상 {s.triggerAfterMinutes}분 지속 후 알림 · 반복 {s.repeatMinutes===0?"사용 안 함":`${s.repeatMinutes}분`}</p>
    <p>수집 누락: {s.noDataActive?`${s.collectionIntervalMinutes}분 주기 · ${s.missingCollectionThreshold}회 연속 누락`:"사용 안 함"}</p>
    <p>조용한 시간: {s.quietStart?`${s.quietStart.slice(0,5)} – ${s.quietEnd?.slice(0,5)}`:"사용 안 함"} · 주말 제외: {s.suppressWeekends?"사용":"사용 안 함"}</p>
    <p>지정 휴일: {s.holidayDates.length?s.holidayDates.join(", "):"없음"}</p>
    <ul className="divide-y rounded-lg border px-3 dark:border-white/10">{s.thresholds.map(t=><li className="py-3 dark:border-white/10" key={t.key}><p className="font-bold">{t.label} · {t.active?"사용":"사용 안 함"}</p><p className="mt-1 text-xs text-text-secondary">{t.useAverage?`24시간 평균 ±${format(t.tolerancePercent)}% · 대체 범위` : "수동 범위"} {format(t.min)} – {format(t.max)} {t.unit}</p></li>)}</ul>
  </div>;
}
