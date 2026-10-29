"use client";
import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "@/components/common/app-link";
import ActionMenu from "@/components/common/action-menu";
import PageLoader from "@/components/common/page-loader";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";
import { meetingHeadings, meetingHtml, meetingText, splitMeeting, joinMeeting, meetingReportPeriod, type MeetingSections } from "@/lib/meeting-content";
import { errorText, dayString } from "./workspace-data";
import { useMeetingAccess, type Meeting } from "./meetings-data";
import WorkspaceDrawer from "./workspace-drawer";

export default function MeetingsPage() {
  const { session,isLoading,isAdmin }=useAuth();
  const access=useMeetingAccess();
  const query=useQuery({queryKey:["workspace-meetings",session?.id],queryFn:()=>apiFetch<Meeting[]>("/workspace/meetings"),enabled:!!access.data?.allowed});
  const qc=useQueryClient();
  const [search,setSearch]=useState(""), [selected,setSelected]=useState<number|null>(null), [editing,setEditing]=useState<Meeting|"new"|null>(null), [error,setError]=useState("");
  const rows=useMemo(()=>(query.data||[]).map(row=>({...row,plain:meetingText(row.contentMarkdown)})),[query.data]);
  const filtered=rows.filter(row=>`${row.title} ${row.plain} ${row.authorName}`.toLowerCase().includes(search.trim().toLowerCase()));
  const current=rows.find(row=>row.id===selected);
  if(isLoading||session&&access.isPending)return <PageLoader as="main" />;
  if(!session)return <main className="work-page"><Link href="/login?next=/meetings">로그인 후 회의록을 이용하세요.</Link></main>;
  if(access.error)return <main className="work-page"><p className="work-error">{errorText(access.error)}</p><button className="work-secondary" onClick={()=>void access.refetch()}>다시 시도</button></main>;
  if(!access.data?.allowed)return <main className="work-page"><h1>사내 회의록</h1><p className="work-hint">펜타웍스 소속 계정만 이용할 수 있습니다.</p></main>;
  async function remove(row:Meeting) {
    if(!window.confirm(`‘${row.title}’ 회의록을 삭제할까요?`))return;
    try {await apiFetch(`/workspace/meetings/${row.id}?revision=${row.revision}`,{method:"DELETE"});setSelected(null);await qc.invalidateQueries({queryKey:["workspace-meetings"]});}
    catch(e){setError(errorText(e));}
  }
  return <main className="work-page meetings-page">
    <header className="work-heading"><div><h1>회의록</h1></div><button type="button" className="work-secondary hospital-register" aria-label="회의록 작성" onClick={()=>setEditing("new")}>＋ 작성</button></header>
    <label className="meeting-search">회의록 검색<input type="search" className="work-input" placeholder="제목·내용·작성자 검색" value={search} onChange={event=>setSearch(event.target.value)} /></label>
    {error&&<p role="alert" className="work-error">{error}</p>}
    {query.isPending?<PageLoader />:query.error?<div className="work-panel"><p className="work-error">{errorText(query.error)}</p><button className="work-secondary" onClick={()=>void query.refetch()}>다시 시도</button></div>:<div className="meeting-list">
      {filtered.map(row=><button type="button" className="meeting-card" key={row.id} onClick={()=>{setSelected(row.id);setError("");}} aria-haspopup="dialog">
        <div className="meeting-card-main"><h2>{row.title}</h2><p className="meeting-preview">{meetingText(splitMeeting(row.contentMarkdown)[0])||"지난주 진행 내용이 없습니다."}</p></div><span className="meeting-card-arrow" aria-hidden="true">›</span>
      </button>)}
      {!filtered.length&&<div className="work-panel meeting-empty">{rows.length?"검색에 맞는 회의록이 없습니다.":"첫 회의록을 작성해주세요."}</div>}
    </div>}
    {current&&!editing&&<WorkspaceDrawer title={current.title} onClose={()=>setSelected(null)} className="meeting-detail-drawer">
      <div className="meeting-detail">
        {error&&<p role="alert" className="work-error">{error}</p>}
        <div className="meeting-detail-toolbar"><p>{current.meetingAt.replace("T"," ")} · 작성 {current.authorName}</p><ActionMenu label="회의록 메뉴" items={[{label:"수정",onSelect:()=>setEditing(current)},...(isAdmin||current.authorId===session.id?[{label:"삭제",danger:true,onSelect:()=>void remove(current)}]:[])]} /></div>
        <p className="meeting-period">지난주 보고 · {meetingReportPeriod(current.meetingAt)}</p>
        <article className="meeting-content" dangerouslySetInnerHTML={{__html:meetingHtml(current.contentMarkdown)}} />
        <p className="work-hint meeting-updated">최근 수정 {current.updatedByName} · {current.updatedAt}</p>
      </div>
    </WorkspaceDrawer>}
    {editing&&<WorkspaceDrawer title={editing==="new"?"회의록 작성":"회의록 수정"} onClose={()=>setEditing(null)} className="meeting-detail-drawer">
      <MeetingForm key={editing==="new"?"new":`${editing.id}-${editing.revision}`} row={editing==="new"?undefined:editing} onCancel={()=>setEditing(null)} onSaved={async id=>{await qc.invalidateQueries({queryKey:["workspace-meetings"]});setSelected(id);setEditing(null);}} />
    </WorkspaceDrawer>}
  </main>;
}

function MeetingForm({row,onSaved,onCancel}:{row?:Meeting;onSaved:(id:number)=>Promise<void>;onCancel:()=>void}) {
  const originals=useMemo(()=>splitMeeting(row?.contentMarkdown||""),[row?.contentMarkdown]);
  const [title,setTitle]=useState(row?.title||""),[date,setDate]=useState(row?.meetingAt||`${dayString()}T10:00`);
  const [sections,setSections]=useState<MeetingSections>(()=>originals.map(meetingText) as MeetingSections);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const meaningful=sections.some(value=>meetingText(value).trim());
  async function submit(event:FormEvent) {
    event.preventDefault();if(!meaningful)return;setBusy(true);setError("");
    try {
      const resolvedTitle=title.trim()||`${Number(date.slice(5,7))}월 ${Number(date.slice(8,10))}일 주간 회의록`;
      const input={title:resolvedTitle,meetingAt:date,participantNames:row?.participantNames||"",contentMarkdown:joinMeeting(sections,originals),revision:row?.revision};
      const result=await apiFetch<{id:number}|undefined>(`/workspace/meetings${row?`/${row.id}`:""}`,{method:row?"PUT":"POST",body:JSON.stringify(input)});
      await onSaved(row?.id||result!.id);
    } catch(e){setError(errorText(e));}finally{setBusy(false);}
  }
  return <form className="work-form meeting-form" onSubmit={submit}>
    <label>제목<input className="work-input" maxLength={200} value={title} placeholder="비우면 회의 날짜로 제목을 만듭니다" disabled={busy} onChange={event=>setTitle(event.target.value)} /></label>
    <label>회의 일시<input className="work-input" type="datetime-local" required value={date} disabled={busy} onChange={event=>setDate(event.target.value)} /></label>
    <p className="work-hint">지난주 보고 · {meetingReportPeriod(date)}</p>
    {meetingHeadings.map((heading,i)=><label key={heading}>{heading}<textarea className="work-input" rows={i===0?7:4} value={sections[i]} disabled={busy} placeholder={["방문·점검·수리 내용과 결과","계속 진행 중인 작업, 병원별 이슈","이번 주 방문·PM·수리 계획"][i]} onChange={event=>setSections(value=>value.map((text,index)=>index===i?event.target.value:text) as MeetingSections)} /></label>)}
    {error&&<p className="work-error" role="alert">{error}</p>}
    <div className="work-form-actions"><button type="button" className="work-secondary" disabled={busy} onClick={onCancel}>취소</button><button type="submit" className="work-primary" disabled={busy||!meaningful}>{busy?"저장 중…":"저장"}</button></div>
  </form>;
}
