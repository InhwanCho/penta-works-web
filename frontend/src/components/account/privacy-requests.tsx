"use client";

import CircleLoader from "@/components/icons/circle-loader";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";

type Request = {id:string;userId:number;name:string;email:string;accountStatus:string;kind:string;content:string;status:string;response:string|null;identityVerified:boolean;createdAt:string};
const kinds: Record<string,string> = {ACCESS:"열람",CORRECT:"정정",DELETE_ACCOUNT:"계정 삭제",ERASURE:"기록·사진 삭제",STOP:"처리정지"};
const statuses: Record<string,string> = {RECEIVED:"접수",REVIEWING:"확인 중",COMPLETED:"처리 완료",REJECTED:"처리 불가"};
const field="mt-2 w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-base dark:border-slate-600 dark:bg-slate-900";
const button="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold disabled:opacity-40 dark:border-slate-600";
export default function PrivacyRequests(){
 const {session}=useAuth();const qc=useQueryClient();const canManage=session?.role==="PLATFORM_ADMIN"||session?.role==="SUPER_ADMIN";
 const [manage,setManage]=useState(false),[kind,setKind]=useState("DELETE_ACCOUNT"),[content,setContent]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const query=useQuery({queryKey:["privacy-requests",session?.id,manage],queryFn:()=>apiFetch<Request[]>(`/privacy/requests${manage?"/manage":""}`),enabled:!!session});
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage("");try{await apiFetch("/privacy/requests",{method:"POST",body:JSON.stringify({kind,content})});setContent("");setMessage("요청을 접수했습니다. 아래에서 처리 결과를 확인할 수 있습니다.");await qc.invalidateQueries({queryKey:["privacy-requests"]});}catch(e){setMessage(e instanceof Error?e.message:"접수하지 못했습니다.");}finally{setBusy(false);}}
 return <main className="work-page"><h1 className="text-xl font-bold">개인정보 요청</h1><p className="mt-2 text-sm leading-6 text-text-secondary">본인의 정보에 관한 요청을 접수하고 처리 결과를 확인하세요. 신분증이나 비밀번호는 입력하지 마세요. 로그인이 어려우면 ihcho@pentaworks.net으로 문의해주세요.</p>
 {canManage&&<div className="my-4 flex gap-2">{[false,true].map(value=><button key={String(value)} type="button" aria-pressed={manage===value} onClick={()=>setManage(value)} className={`${button} ${manage===value?"bg-sky-700 text-white":""}`}>{value?"회사 요청 관리":"내 요청"}</button>)}</div>}
 {!manage&&<form onSubmit={submit} className="work-panel mt-4 space-y-4"><fieldset><legend className="font-bold">요청 종류</legend><div className="mt-2 flex flex-wrap gap-2">{Object.entries(kinds).map(([value,label])=><label key={value} className={`${button} flex cursor-pointer items-center gap-2 ${kind===value?"border-sky-600 bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100":""}`}><input type="radio" name="privacy-kind" value={value} checked={kind===value} onChange={()=>setKind(value)} />{label}</label>)}</div></fieldset>
 <label className="block font-bold">요청 내용<textarea required maxLength={3000} rows={3} value={content} onChange={e=>setContent(e.target.value)} className={field} placeholder="어떤 정보를 어떻게 처리할지 적어주세요." /></label>
 <p className="text-sm leading-6 text-text-secondary">접수만으로 계정이나 기록이 삭제되지 않습니다. 담당자가 본인·회사 권한과 삭제 범위를 확인한 뒤 처리합니다. 계정 삭제와 회사 업무기록 삭제는 별도입니다.</p><button disabled={busy} className={`${button} bg-sky-700 text-white`}>{busy?<CircleLoader size="xs" inline />:"요청 접수"}</button></form>}
 {message&&<p role="status" className="my-3 text-sm">{message}</p>}
 <section className="mt-5"><h2 className="font-bold">{manage?"회사에서 접수한 요청":"내 요청 내역"}</h2>{query.isPending?<p className="py-3 text-sm"><CircleLoader size="xs" /></p>:query.isError?<button className={button} onClick={()=>query.refetch()}>불러오지 못했습니다 · 다시 시도</button>:!query.data?.length?<p className="py-3 text-sm text-text-secondary">접수된 요청이 없습니다.</p>:query.data.map(request=><RequestCard key={request.id} request={request} manage={manage} />)}</section></main>;
}
function RequestCard({request:r,manage}:{request:Request;manage:boolean}){
 const qc=useQueryClient();const [status,setStatus]=useState("REVIEWING"),[response,setResponse]=useState(r.response||""),[verified,setVerified]=useState(!!r.identityVerified),[email,setEmail]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const terminal=r.status==="COMPLETED"||r.status==="REJECTED";
 async function save(deleting=false){
  if(deleting&&!window.confirm("이 계정의 식별정보를 익명화하고 로그인·알림·Google 연결을 중지할까요? 회사 업무기록과 감사기록은 유지됩니다. 처리 후 요청자에게 결과를 별도로 안내해주세요."))return;
  setBusy(true);setMessage("");try{await apiFetch(`/privacy/requests/${r.id}${deleting?"/delete-account":""}`,{method:deleting?"POST":"PATCH",body:JSON.stringify(deleting?{confirmationEmail:email,identityVerified:verified}:{status,response,identityVerified:verified})});await qc.invalidateQueries({queryKey:["privacy-requests"]});setMessage("저장했습니다.");}catch(e){setMessage(e instanceof Error?e.message:"처리하지 못했습니다.");}finally{setBusy(false);}
 }
 return <article className="work-panel mt-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{kinds[r.kind]||r.kind}</strong><span className="text-sm">{statuses[r.status]||r.status}</span></div><p className="mt-1 text-xs text-text-secondary">{new Date(r.createdAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}{manage?` · ${r.name} · ${r.email}`:""}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{r.content}</p>{r.response&&<p className="mt-3 whitespace-pre-wrap border-t pt-3 text-sm leading-6"><strong>처리 안내</strong><br/>{r.response}</p>}
 {manage&&!terminal&&<details className="mt-3"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold">요청 검토·처리</summary><div className="space-y-3 border-t pt-3"><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)} />본인과 요청 권한·처리 범위를 확인했습니다.</label>
 <fieldset><legend className="text-sm font-bold">처리 상태</legend><div className="mt-2 flex flex-wrap gap-3">{["REVIEWING","COMPLETED","REJECTED"].map(value=><label key={value} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={`privacy-status-${r.id}`} checked={status===value} onChange={()=>setStatus(value)}/>{statuses[value]}</label>)}</div></fieldset>
 <label className="block text-sm font-bold">요청자에게 보여줄 처리 내용<textarea maxLength={3000} rows={3} value={response} onChange={e=>setResponse(e.target.value)} className={field}/></label><p className="text-xs leading-5 text-text-secondary">완료 상태 저장은 실제 데이터를 삭제하지 않습니다. 처리한 항목과 보존 사유를 적어주세요.</p><button type="button" disabled={busy||!response.trim()||(status==="COMPLETED"&&!verified)} onClick={()=>save()} className={button}>처리 내용 저장</button>
 {r.kind==="DELETE_ACCOUNT"&&r.accountStatus!=="DELETED"&&<div className="border-t pt-3"><strong className="text-sm">계정 삭제 실행</strong><p className="mt-2 text-sm leading-6">계정 식별정보만 익명화합니다. 기록 본문·사진·감사 이력에 남은 개인정보는 별도로 검토하세요. 삭제 후에는 요청자가 로그인할 수 없으므로 결과를 별도로 안내해야 합니다.</p><label className="mt-2 block text-sm">삭제할 계정 이메일<input type="email" value={email} onChange={e=>setEmail(e.target.value)} className={field}/></label><button type="button" disabled={busy||!verified||email.trim().toLowerCase()!==r.email.toLowerCase()} onClick={()=>save(true)} className={`${button} mt-3 text-red-700 dark:text-red-300`}>계정 삭제 실행</button></div>}
 </div></details>}{message&&<p role="status" className="mt-2 text-sm">{message}</p>}</article>;
}
