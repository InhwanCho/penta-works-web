"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";
import { serviceLabels, type WorkRecord } from "./workspace-data";
import { parseDetails } from "./service-form-model";
export default function InspectionSourceRecord({siteId,type,onOpen}:{siteId:string;type:string;onOpen:(href:string)=>void}) {
 const {session}=useAuth();
 const query=useQuery({queryKey:["workspace-records","inspection-source",session?.id,siteId],queryFn:()=>apiFetch<WorkRecord[]>(`/workspace/records?siteId=${encodeURIComponent(siteId)}`),enabled:!!session});
 const record=query.data?.filter(row=>{
  const detail=parseDetails(row.detailsJson),kind=row.acrKind??detail.acrKind;
  return row.status==="COMPLETED"&&(type==="PM"?(row.serviceType==="PM"||(row.countsAsPm===undefined?detail.countsAsPm:!!row.countsAsPm)):row.serviceType==="ACR"&&(type.includes("정밀")?kind==="full":["doc","full"].includes(kind||"")));
 }).sort((a,b)=>b.workDate.localeCompare(a.workDate)||b.id-a.id)[0];
 if(query.isPending)return <p className="work-hint">기준 업무 불러오는 중…</p>;
 if(query.error)return <button type="button" className="inspection-source-record" onClick={()=>void query.refetch()}>기준 업무 다시 불러오기</button>;
 if(!record)return <p className="work-hint">연결된 완료 업무기록 없음</p>;
 const category=record.serviceType === "PM" ? "PM" : serviceLabels[record.serviceType||""]||record.serviceType||"업무";
 const description=`${record.workDate} · ${serviceLabels[record.serviceType||""]||record.serviceType||"업무"} · ${record.title}`;
 return <button type="button" className="inspection-source-record" title={description} aria-label={`${description} 업무기록 상세 보기`} onClick={()=>onOpen(`/work/${record.id}`)}><span className="inspection-source-date">{record.workDate}</span><span className="inspection-source-badge">{category}</span><span className="inspection-source-copy">{record.title}</span><span className="inspection-source-arrow" aria-hidden="true">›</span></button>;
}
