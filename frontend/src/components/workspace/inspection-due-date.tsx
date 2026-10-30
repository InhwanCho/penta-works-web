"use client";
import { useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { errorText } from "./workspace-data";
export default function InspectionDueDate({siteId,type,date,overridden,automaticDate}:{siteId:string;type:string;date:string;overridden:boolean;automaticDate:string|null}) {
 const id=useId(),qc=useQueryClient();const [value,setValue]=useState(date),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>setValue(date),[date]);
 async function save(next:string,automatic=false){
  if(busy||(automatic&&!automaticDate)||(!automatic&&(!next||next===date)))return;
  setBusy(true);setError("");setValue(next);
  try{await apiFetch(`/workspace/planning/${encodeURIComponent(siteId)}/due-date`,{method:"PATCH",body:JSON.stringify({type,date:automatic?null:next,automatic})});await Promise.all([qc.invalidateQueries({queryKey:["workspace-planning"]}),qc.invalidateQueries({queryKey:["workspace-search"]}),qc.invalidateQueries({queryKey:["workspace-schedules"]})]);}
  catch(e){setValue(date);setError(errorText(e));}finally{setBusy(false);}
 }
 return <div className="inspection-due-date"><label htmlFor={id}>예정일</label><input id={id} type="date" aria-label={`${type} 예정일`} value={value} disabled={busy} onClick={e=>{try{e.currentTarget.showPicker?.();}catch{/* Native input remains available when showPicker is unsupported. */}}} onChange={e=>void save(e.target.value)} />{overridden&&automaticDate&&automaticDate!==date&&<button type="button" className="inspection-due-auto" disabled={busy} onClick={()=>void save(date,true)}>자동으로</button>}{busy&&<small role="status">변경 중…</small>}{error&&<p className="work-error" role="alert">{error}</p>}</div>;
}
