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
  async function save(airCooled:boolean) {
    setBusy(true);setError("");
    try {await apiFetch(`/alerts/cooling-types/${encodeURIComponent(siteId)}`,{method:"PATCH",body:JSON.stringify({airCooled})});await Promise.all([client.invalidateQueries({queryKey:["site-cooling-types"]}),client.invalidateQueries({queryKey:["alert-events"]}),client.invalidateQueries({queryKey:["alert-thresholds"]})]);}
    catch(e){setError(e instanceof Error?e.message:"저장하지 못했습니다.");}finally{setBusy(false);}
  }
  return <div className="min-w-0 lg:w-56 lg:shrink-0">
    <fieldset disabled={busy||types.isPending||types.isError} aria-label={`${name} 냉각 방식`}>
      <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">냉각 방식</legend>
      <div className="flex gap-4">{[{value:false,label:"수냉식"},{value:true,label:"공냉식"}].map(option=><label key={option.label} className="flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-semibold"><input type="radio" name={`cooling-${siteId}`} checked={!types.isPending && !types.isError && Boolean(types.data?.[siteId])===option.value} onChange={()=>save(option.value)} className="h-4 w-4 accent-sky-700"/>{option.label}</label>)}</div>
    </fieldset>
    <p className="text-xs leading-5 text-text-secondary">전체 담당자 · {types.data?.[siteId] ? "정지 감지 제외" : "정지 감지 가능"}</p>
    {(error||types.isError)&&<p role="alert" className="mt-2 text-sm text-red-700">{error||"냉각 방식을 불러오지 못했습니다."}</p>}
  </div>;
}
