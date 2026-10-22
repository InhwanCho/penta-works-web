"use client";

import CircleLoader from "@/components/icons/circle-loader";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";
import { errorText } from "./workspace-data";

type Profile = { siteId: string; hospitalId: number | null; name: string; address: string; contactName: string; contactPhone: string; notes: string; revision: number; userIds?: number[]; monitoringSiteId: string | null; monitoringConnected: boolean };
type Options = { members: { id: number; name: string; email: string }[]; monitoringSites: { siteId: string; name: string }[] };
export function HospitalProfile({ siteId }: { siteId: string }) {
  const { session, isAdmin } = useAuth();
  const query = useQuery({ queryKey: ["hospital-profile",session?.id,siteId], queryFn: () => apiFetch<Profile>(`/workspace/hospitals/${encodeURIComponent(siteId)}`), enabled: !!session });
  const [editing,setEditing] = useState(false);
  return <>
    {query.isPending ? <p className="work-hint mt-3"><CircleLoader size="xs" /></p> : query.error ? <button type="button" className="work-text-button" onClick={() => void query.refetch()}>병원 정보를 불러오지 못했습니다 · 다시 시도</button> : query.data && <div className="hospital-profile-summary">
      <dl>
        <div><dt>주소</dt><dd>{query.data.address || "미등록"}</dd></div>
        <div><dt>연락 담당자</dt><dd>{query.data.contactName || "미등록"}</dd></div>
        <div><dt>연락처</dt><dd>{query.data.contactPhone ? <a href={`tel:${query.data.contactPhone}`}>{query.data.contactPhone}</a> : "미등록"}</dd></div>
        {query.data.notes && <div><dt>메모</dt><dd className="work-prewrap">{query.data.notes}</dd></div>}
      </dl>
      <div className="hospital-panel-actions">
        <span className="hospital-connection-state">{query.data.monitoringConnected ? "모니터링 연결됨" : "서비스 관리 · 모니터링 미연결"}</span>
        {isAdmin && <button type="button" className="work-secondary hospital-section-action" onClick={() => setEditing(true)}>병원 정보 수정</button>}
      </div>
    </div>}
    {editing && <HospitalFormDialog siteId={siteId} onClose={() => setEditing(false)} />}
  </>;
}
export function HospitalRegistration() {
  const { isAdmin } = useAuth();const [open,setOpen] = useState(false);
  if(!isAdmin)return null;
  return <><button type="button" className="work-secondary hospital-register" onClick={() => setOpen(true)}>병원 등록</button>{open && <HospitalFormDialog onClose={() => setOpen(false)} />}</>;
}
function HospitalFormDialog({siteId,onClose}: {siteId?: string; onClose: () => void}) {
  const ref=useRef<HTMLDialogElement>(null);
  const { session } = useAuth();
  const options=useQuery({queryKey:["hospital-management-options",session?.id],queryFn:()=>apiFetch<Options>("/workspace/hospitals/options"), staleTime:0});
  const profile=useQuery({queryKey:["hospital-profile",session?.id,siteId],queryFn:()=>apiFetch<Profile>(`/workspace/hospitals/${encodeURIComponent(siteId!)}`),enabled:!!siteId});
  useEffect(()=>{const node=ref.current;const previous=document.body.style.overflow;document.body.style.overflow="hidden";node?.showModal();node?.focus({preventScroll:true});return()=>{node?.close();document.body.style.overflow=previous;};},[]);
  return <dialog ref={ref} tabIndex={-1} className="hospital-management-dialog" aria-labelledby="hospital-edit-title" data-ptr-ignore onCancel={e=>{e.preventDefault();onClose();}}>
    <header><h2 id="hospital-edit-title">{siteId ? "병원 정보 수정" : "병원 등록"}</h2><button type="button" aria-label="병원 관리 닫기" onClick={onClose}>×</button></header>
    {options.error || (siteId && profile.error) ? <div className="hospital-management-body"><p role="alert" className="work-error">{errorText(options.error || profile.error)}</p><button type="button" onClick={()=>{void options.refetch();if(siteId)void profile.refetch();}}>다시 시도</button></div> : options.isPending || (siteId && profile.isPending) ? <p className="hospital-management-body" role="status"><CircleLoader size="xs" /></p> : options.data && <HospitalForm key={siteId || "new"} profile={profile.data} options={options.data} onClose={onClose} />}
  </dialog>;
}
function HospitalForm({profile,options,onClose}:{profile?: Profile;options: Options;onClose:()=>void}) {
  const qc=useQueryClient(),router=useRouter();
  const [form,setForm]=useState({name:profile?.name || "",address:profile?.address || "",contactName:profile?.contactName || "",contactPhone:profile?.contactPhone || "",notes:profile?.notes || "",model:"",serialNumber:"",monitoringSiteId:profile?.monitoringSiteId || "",userIds:profile?.userIds || [],revision:profile?.revision ?? 0});
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const field=(key:"name"|"address"|"contactName"|"contactPhone"|"model"|"serialNumber",label:string,max:number)=><label>{label}<input className="work-input" required={key==="name"} maxLength={max} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>;
  async function save(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{
    const result=await apiFetch<Profile>(profile?`/workspace/hospitals/${encodeURIComponent(profile.siteId)}`:"/workspace/hospitals",{method:profile?"PUT":"POST",body:JSON.stringify(form)});
    await Promise.all(["hospital-profile","hospital-management-options","workspace-hospital-directory","workspace-sites","siteDetail","workspace-assets"].map(key=>qc.invalidateQueries({queryKey:[key]})));
    onClose();if(!profile)router.push(`/sites/${encodeURIComponent(result.siteId)}`);
  }catch(e){setError(errorText(e));}finally{setBusy(false);}}
  return <form onSubmit={save} className="hospital-management-body work-form"><fieldset disabled={busy} className="hospital-management-fields">
    {field("name","병원명 *",120)}{field("address","주소",255)}
    <div className="work-form-row">{field("contactName","병원 연락 담당자",80)}{field("contactPhone","연락처",30)}</div>
    <label>메모<textarea className="work-input" rows={3} maxLength={10000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
    {!profile && <div className="work-form-row">{field("model","MRI 모델 (선택)",200)}{field("serialNumber","MRI 시리얼 번호 (선택)",200)}</div>}
    <label>모니터링 연결{profile?.monitoringConnected ? <p className="work-hint">연결됨 · {profile.monitoringSiteId}</p> : <><select className="work-input" value={form.monitoringSiteId} onChange={e=>setForm({...form,monitoringSiteId:e.target.value})}><option value="">연결하지 않음 · 서비스 업무만 사용</option>{options.monitoringSites.map(s=><option key={s.siteId} value={s.siteId}>{s.name || s.siteId} · {s.siteId}</option>)}</select><span className="work-hint">수집 사이트가 준비되면 나중에 연결할 수 있습니다. 대시보드 표시 여부는 관리 설정에서 별도로 정합니다.</span></>}</label>
    <fieldset className="hospital-access-members"><legend>접근할 직원</legend><p className="work-hint">회사 관리자는 항상 접근할 수 있습니다.</p>{options.members.length ? options.members.map(m=><label className="work-check" key={m.id}><input type="checkbox" checked={form.userIds.includes(m.id)} onChange={e=>setForm({...form,userIds:e.target.checked?[...form.userIds,m.id]:form.userIds.filter(id=>id!==m.id)})}/><span>{m.name}<small>{m.email}</small></span></label>) : <p className="work-hint">등록된 일반 직원이 없습니다.</p>}</fieldset>
    {error && <p className="work-error" role="alert">{error}</p>}
    <div className="work-form-actions"><button type="button" className="work-secondary" onClick={onClose}>취소</button><button className="work-primary" disabled={busy}>{busy?<CircleLoader size="xs" />:"저장"}</button></div>
  </fieldset></form>;
}
