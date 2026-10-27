"use client";
import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";
import { usePlanning, errorText, type WorkSchedule } from "./workspace-data";
import { moveScheduleDate } from "./schedule-form";

export default function PmDateEditor({ siteId, date, schedule }: { siteId: string; date: string; schedule?: WorkSchedule }) {
  const { session, isAdmin } = useAuth();
  const planning = usePlanning();
  const qc = useQueryClient();
  const editorId = useId();
  const [editing,setEditing] = useState(false), [value,setValue] = useState(date), [busy,setBusy] = useState(false), [error,setError] = useState("");
  if (schedule ? schedule.authorId !== session?.id && !isAdmin : !isAdmin) return null;
  async function save() {
    setBusy(true);setError("");
    try {
      if (schedule) {
        await apiFetch(`/workspace/schedules/${schedule.id}`,{method:"PUT",body:JSON.stringify({...schedule,...moveScheduleDate(schedule,value)})});
      } else {
        const fresh = await planning.refetch();
        if (fresh.error || !fresh.data) throw fresh.error || new Error("점검 기준을 불러오지 못했습니다.");
        const plan=fresh.data.plans.find(item=>item.siteId===siteId);
        if (plan?.lastPmDate && value <= plan.lastPmDate) throw new Error(`최근 PM 날짜(${plan.lastPmDate}) 이후로 선택해주세요.`);
        await apiFetch(`/workspace/planning/${encodeURIComponent(siteId)}`,{method:"PUT",body:JSON.stringify({pmIntervalMonths:plan?.pmIntervalMonths || 2,pmOverride:value,acrFullOverride:plan?.acrFullOverride || null,acrDocOverride:plan?.acrDocOverride || null})});
      }
      await Promise.all([qc.invalidateQueries({queryKey:["workspace-planning"]}),qc.invalidateQueries({queryKey:["workspace-schedules"]}),qc.invalidateQueries({queryKey:["workspace-search"]})]);
      setEditing(false);
    } catch(error) { setError(errorText(error)); } finally { setBusy(false); }
  }
  return <div className="pm-quick-date">
    {!editing && <button type="button" className="pm-date-trigger" aria-expanded={false} aria-controls={editorId} onClick={()=>{setValue(date);setError("");setEditing(true);}}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-11 4h4" /></svg>
      <span className="pm-date-copy"><small>PM {schedule ? "일정 날짜" : "예정일"}</small><strong>{date}</strong></span>
      <span className="pm-date-action">날짜 변경<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5" /></svg></span>
    </button>}
    <div id={editorId} className="pm-date-fields" hidden={!editing}>
      <label>PM {schedule ? "일정 날짜" : "예정일"}<input type="date" className="work-input" value={value} disabled={busy} required onChange={event=>setValue(event.target.value)} /></label>
      <div className="pm-quick-date-actions"><button className="work-secondary" type="button" disabled={busy} onClick={()=>{setEditing(false);setError("");}}>취소</button><button type="button" className="work-primary" disabled={busy || !value || value===date} onClick={()=>void save()}>{busy ? "저장 중" : "날짜 저장"}</button></div>
      {error && <p className="work-error" role="alert">{error}</p>}
    </div>
  </div>;
}
