"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/provider/auth-provider";
export function useCoolingTypes() {
  return useQuery({queryKey:["site-cooling-types"],queryFn:()=>apiFetch<Record<string,boolean>>("/alerts/cooling-types"),staleTime:30_000});
}
export default function SiteCoolingControl({siteId,name}:{siteId:string;name:string}) {
  const {session}=useAuth();
  const types=useCoolingTypes();
  const client=useQueryClient();
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  if(session?.role!=="PLATFORM_ADMIN") return null;
  return <div className="min-w-0 lg:w-56 lg:shrink-0"><label className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200"><span className="whitespace-nowrap">냉각 방식</span><select aria-label={`${name} 냉각 방식`} disabled={busy||types.isPending||types.isError} value={types.data?.[siteId] ? "air":"water"} onChange={async event=>{
    const airCooled=event.target.value==="air";setBusy(true);setError("");
    try {await apiFetch(`/alerts/cooling-types/${encodeURIComponent(siteId)}`,{method:"PATCH",body:JSON.stringify({airCooled})});await Promise.all([client.invalidateQueries({queryKey:["site-cooling-types"]}),client.invalidateQueries({queryKey:["alert-events"]}),client.invalidateQueries({queryKey:["alert-thresholds"]})]);}
    catch(e){setError(e instanceof Error?e.message:"저장하지 못했습니다.");}finally{setBusy(false);}
  }} className="min-h-11 w-28 shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:bg-background-dark-secondary dark:text-slate-100"><option value="water">수냉식</option><option value="air">공냉식</option></select></label><p className="mt-1 text-xs leading-5 text-text-secondary">전체 담당자 · {types.data?.[siteId] ? "정지 감지 제외" : "정지 감지 가능"}</p>{(error||types.isError)&&<p role="alert" className="mt-2 text-sm text-red-700">{error||"냉각 방식을 불러오지 못했습니다."}</p>}</div>;
}
