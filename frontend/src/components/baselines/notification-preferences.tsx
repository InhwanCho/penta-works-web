"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";

export type NotificationPreferences = {repeatMinutes:number; quietStart:string|null; quietEnd:string|null; suppressWeekends:boolean; holidayDates:string[]};
type PreferenceView = {preferences:NotificationPreferences|null; needsSelection:boolean; previousSettings:{siteId:string;name:string|null;preferences:NotificationPreferences}[]};
const key = ["notification-preferences"];
const defaults:NotificationPreferences = {repeatMinutes:0,quietStart:null,quietEnd:null,suppressWeekends:false,holidayDates:[]};
const field = "mt-2 min-h-12 min-w-0 w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-slate-600 dark:bg-background-dark-primary";
const panel = "rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-600 dark:bg-background-dark-secondary";
function usePreferences() {
  return useQuery({queryKey:key,queryFn:()=>apiFetch<PreferenceView>("/alerts/notification-preferences"),staleTime:60_000});
}
export function preferenceSummary(p:NotificationPreferences) {
  return [p.quietStart?`매일 ${p.quietStart.slice(0,5)}~${p.quietEnd?.slice(0,5)} 쉬기`:"시간 제한 없음",p.suppressWeekends?"주말 쉬기":"주말도 받기",p.holidayDates.length?`쉬는 날짜 ${p.holidayDates.length}일`:null,p.repeatMinutes?`미확인 알림 ${p.repeatMinutes}분마다`:"처음 한 번만"].filter(Boolean).join(" · ");
}
export function NotificationPreferencesSummary() {
  const query=usePreferences();
  const path=usePathname();
  return <section aria-label="내 알림 수신 설정" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white p-3 sm:p-4 dark:border-slate-600 dark:bg-background-dark-card">
    <div className="min-w-0 flex-1"><h2 className="text-base font-extrabold">내 알림 수신 설정</h2><p className="mt-1 break-words text-sm leading-6 text-text-secondary">{query.isPending?"불러오는 중…":query.isError?"수신 설정을 불러오지 못했습니다.":query.data?.needsSelection?"병원별 기존 설정이 다릅니다. 공통 설정을 선택해주세요.":preferenceSummary(query.data?.preferences??defaults)}</p><p className="mt-1 text-xs leading-5 text-text-secondary">내가 받는 모든 병원의 알림에 적용됩니다.</p></div>
    <Link href={`/notification-settings?from=${path==="/"?"dashboard":"baselines"}`} className="inline-flex min-h-11 items-center rounded-lg border border-sky-300 px-3 text-sm font-bold text-sky-800 dark:border-sky-700 dark:text-sky-200">설정 변경</Link>
  </section>;
}
export default function NotificationPreferencesPage() {
  const query=usePreferences();
  const [back,setBack]=useState("/baselines");
  useEffect(()=>{if(new URLSearchParams(window.location.search).get("from")==="dashboard")setBack("/?view=alerts");},[]);
  return <main className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-6"><Link href={back} className="inline-flex min-h-11 items-center text-base font-bold text-sky-800 dark:text-sky-200">← {back==="/baselines"?"알림 관리":"대시보드 알림값"}</Link><h1 className="my-3 text-2xl font-extrabold">내 알림 수신 설정</h1><p className="mb-4 text-base leading-7 text-text-secondary">내 계정에 한 번 설정하면, 현재와 앞으로 추가되는 모든 병원에 적용됩니다. 다른 담당자의 설정에는 영향을 주지 않습니다.</p>
    {query.isPending?<p role="status">불러오는 중…</p>:query.isError?<button className={field} onClick={()=>query.refetch()}>수신 설정 다시 불러오기</button>:query.data&&<PreferenceEditor view={query.data}/>}
  </main>;
}
function PreferenceEditor({view}:{view:PreferenceView}) {
  const client=useQueryClient();
  const [value,setValue]=useState(view.preferences??defaults);
  const [quiet,setQuiet]=useState(!!view.preferences?.quietStart);
  const [start,setStart]=useState(view.preferences?.quietStart?.slice(0,5)??"18:00");
  const [end,setEnd]=useState(view.preferences?.quietEnd?.slice(0,5)??"09:00");
  const [repeat,setRepeat]=useState((view.preferences?.repeatMinutes??0)>0);
  const [minutes,setMinutes]=useState(view.preferences?.repeatMinutes||30);
  const [date,setDate]=useState("");
  const dateInput=useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [choice,setChoice]=useState("");
  const patch=(p:Partial<NotificationPreferences>)=>setValue(v=>({...v,...p}));
  function choose(id:string) {
    setChoice(id);setError("");
    const p=id==="new"?defaults:view.previousSettings.find(s=>s.siteId===id)?.preferences;
    if(!p)return;
    setValue(p);setQuiet(!!p.quietStart);setStart(p.quietStart?.slice(0,5)??"18:00");setEnd(p.quietEnd?.slice(0,5)??"09:00");setRepeat(p.repeatMinutes>0);setMinutes(p.repeatMinutes||30);
  }
  async function save(event:FormEvent) {
    event.preventDefault();setError("");setNotice("");
    if(view.needsSelection&&!choice){setError("공통으로 사용할 기존 설정 또는 새로 설정하기를 선택해주세요.");return;}
    const fields=new FormData(event.currentTarget as HTMLFormElement);
    const quietStart=String(fields.get("quietStart")??start),quietEnd=String(fields.get("quietEnd")??end);
    if(quiet&&(!quietStart||!quietEnd||quietStart===quietEnd)){setError("쉬는 시간의 시작과 종료를 서로 다르게 입력해주세요.");return;}
    if(repeat&&(!Number.isInteger(minutes)||minutes<5||minutes>10080)){setError("반복 간격은 5분에서 10080분 사이의 정수로 입력해주세요.");return;}
    setBusy(true);
    try {
      const saved=await apiFetch<PreferenceView>("/alerts/notification-preferences",{method:"PATCH",body:JSON.stringify({...value,quietStart:quiet?quietStart:null,quietEnd:quiet?quietEnd:null,repeatMinutes:repeat?minutes:0})});
      client.setQueryData(key,saved);
      await client.invalidateQueries({queryKey:["alert-thresholds"]});
      setNotice("저장했습니다. 내가 받는 모든 병원의 알림에 적용됩니다.");
    }catch(e){setError(e instanceof Error?e.message:"저장하지 못했습니다.");}
    finally{setBusy(false);}
  }
  return <form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="min-w-0 space-y-4">
    {view.needsSelection&&<section className={panel}><h2 className="text-lg font-bold">기존 설정을 공통 설정으로 이전</h2><p className="mt-2 text-base leading-7">저장하기 전까지는 기존 병원별 설정이 유지됩니다. 사용할 설정을 선택한 뒤 아래 내용을 확인하세요.</p><label className="mt-3 block font-bold">가져올 설정<select className={field} value={choice} onChange={e=>choose(e.target.value)}><option value="">선택해주세요</option><option value="new">새로 설정하기</option>{view.previousSettings.map(s=><option key={s.siteId} value={s.siteId}>{s.name??s.siteId}</option>)}</select></label>{choice&&choice!=="new"&&<p className="mt-3 break-words text-sm leading-6">{preferenceSummary(view.previousSettings.find(s=>s.siteId===choice)!.preferences)}</p>}</section>}
    <section className={panel}><h2 className="text-lg font-bold">알림 받지 않는 시간</h2><label className="flex min-h-12 items-center gap-3 text-base"><input type="checkbox" checked={quiet} onChange={e=>setQuiet(e.target.checked)} className="h-5 w-5"/>매일 같은 시간에 쉬기</label>{quiet&&<div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="min-w-0 font-bold">쉬기 시작<input type="time" name="quietStart" className={field} value={start} onChange={e=>setStart(e.target.value)} required/></label><label className="min-w-0 font-bold">다시 받기 시작<input type="time" name="quietEnd" className={field} value={end} onChange={e=>setEnd(e.target.value)} required/></label></div>}<p className="mt-2 text-sm leading-6 text-text-secondary">예: 18:00부터 다음 날 09:00까지 · 한국 시간 기준</p></section>
    <section className={panel}><h2 className="text-lg font-bold">주말·알림 쉬는 날짜</h2><label className="flex min-h-12 items-center gap-3 text-base"><input type="checkbox" checked={value.suppressWeekends} onChange={e=>patch({suppressWeekends:e.target.checked})} className="h-5 w-5"/>토요일·일요일 쉬기</label><p className="text-sm leading-6 text-text-secondary">공휴일·휴가 등 하루 종일 쉬는 날짜를 직접 추가하세요.</p><div className="mt-3 flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 font-bold">쉬는 날짜<input type="date" ref={dateInput} className={field} value={date} onChange={e=>setDate(e.target.value)}/></label><button type="button" className="min-h-12 rounded-xl border border-sky-300 px-4 text-base font-bold dark:border-sky-700" onClick={()=>{const chosen=dateInput.current?.value??date;setNotice("");if(!/^\d{4}-\d{2}-\d{2}$/.test(chosen)||!dateInput.current?.validity.valid){setError("추가할 날짜를 선택해주세요.");return;}if(value.holidayDates.length>=100){setError("쉬는 날짜는 최대 100일입니다.");return;}patch({holidayDates:[...new Set([...value.holidayDates,chosen])].sort()});setDate("");setError("");}}>추가</button></div><ul className="mt-3 space-y-1">{value.holidayDates.map(d=><li key={d} className="flex flex-wrap items-center justify-between gap-2"><span>{d}</span><button type="button" aria-label={`${d} 삭제`} className="min-h-11 px-3 font-bold text-rose-700 dark:text-rose-300" onClick={()=>patch({holidayDates:value.holidayDates.filter(v=>v!==d)})}>삭제</button></li>)}</ul></section>
    <section className={panel}><h2 className="text-lg font-bold">미확인 알림 반복</h2><label className="mt-3 block font-bold">받는 방식<select className={field} value={repeat?"repeat":"once"} onChange={e=>setRepeat(e.target.value==="repeat")}><option value="once">처음 한 번만</option><option value="repeat">미확인 상태면 반복</option></select></label>{repeat&&<label className="mt-3 block font-bold">반복 간격 (분)<input type="number" min={5} max={10080} step={1} className={field} value={minutes} onChange={e=>setMinutes(Number(e.target.value))} required/></label>}<p className="mt-3 text-sm leading-6 text-text-secondary">확인했거나 정상화되면 반복이 끝납니다. 새 문제의 최초 알림은 기존 문제의 반복 간격을 기다리지 않습니다.</p></section>
    <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-7 text-sky-900 dark:border-sky-800 dark:bg-background-dark-secondary dark:text-sky-200">쉬는 시간에도 대시보드의 이상 표시와 앱 내 알림 기록은 유지됩니다. 카톡·문자 발송만 쉬고, 다시 받는 시간이 되면 미확인 상태로 계속 발생 중인 문제만 발송 대상이 됩니다.</p>
    {error&&<p role="alert" className="text-base font-bold text-rose-700 dark:text-rose-300">{error}</p>}{notice&&<p role="status" className="text-base font-bold text-emerald-700 dark:text-emerald-300">{notice}</p>}
    <button type="submit" className="min-h-12 w-full rounded-xl bg-sky-700 px-4 text-base font-bold text-white disabled:opacity-50">{busy?"저장 중…":"모든 병원에 적용"}</button>
  </fieldset></form>;
}
