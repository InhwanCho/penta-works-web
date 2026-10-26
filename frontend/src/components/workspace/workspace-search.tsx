"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "@/components/common/app-link";
import CircleLoader from "@/components/icons/circle-loader";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";
import { errorText, scheduleCategory, scheduleTimeLabel, type WorkRecord, type WorkSchedule } from "./workspace-data";

type Scope = "all" | "records" | "schedules";
const pageSize = 10;

export default function WorkspaceSearch({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { session } = useAuth();
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [recordPage, setRecordPage] = useState(1);
  const [schedulePage, setSchedulePage] = useState(1);
  const showRecords = scope !== "schedules";
  const showSchedules = scope !== "records";
  const records = useQuery({
    queryKey: ["workspace-search", "records", session?.id, term, recordPage],
    queryFn: () => apiFetch<{ records: WorkRecord[]; total: number }>(`/workspace/records/search?${new URLSearchParams({ query: term, page: String(recordPage), size: String(pageSize) })}`),
    enabled: !!session && !!term && showRecords,
  });
  const schedules = useQuery({
    queryKey: ["workspace-search", "schedules", session?.id, term, schedulePage],
    queryFn: () => apiFetch<{ schedules: WorkSchedule[]; total: number }>(`/workspace/schedules/search?${new URLSearchParams({ query: term, page: String(schedulePage), size: String(pageSize) })}`),
    enabled: !!session && !!term && showSchedules,
  });
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    element.focus({ preventScroll: true });
    return () => { element.close(); document.body.style.overflow = previous; };
  }, []);
  function search(event: FormEvent) {
    event.preventDefault();
    const next = input.trim();
    setRecordPage(1); setSchedulePage(1); setTerm(next);
    if (next && next === term) {
      if (showRecords) void records.refetch();
      if (showSchedules) void schedules.refetch();
    }
  }
  const pending = !!term && ((showRecords && records.isPending) || (showSchedules && schedules.isPending));
  return <dialog ref={dialog} className="work-day-dialog workspace-search-dialog" aria-labelledby="workspace-search-title" tabIndex={-1} data-ptr-ignore
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <header><h2 id="workspace-search-title">업무기록·일정 검색</h2><button type="button" className="day-close" aria-label="검색 닫기" onClick={onClose}>×</button></header>
    <div className="workspace-search-body">
      <form className="workspace-search-form" onSubmit={search} role="search">
        <input type="search" aria-label="업무기록·일정 검색어" placeholder="병원명 · 제목 · 내용 검색" value={input} maxLength={200} onChange={event => setInput(event.target.value)} />
        <button type="submit" className="work-primary" disabled={!input.trim()}>검색</button>
      </form>
      <div className="workspace-search-scopes" aria-label="검색 대상">
        {([["all", "전체"], ["records", "업무기록"], ["schedules", "일정"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)}>{label}</button>)}
      </div>
      <p className="workspace-search-hint">{term ? `‘${term}’ 검색 결과 · 전체 기간` : "과거 업무기록과 앞으로의 일정을 함께 검색합니다."}</p>
      {pending ? <div className="workspace-search-loading"><CircleLoader size="m" inline /></div> : term && <div className="workspace-search-results">
        {showRecords && <section><h3>업무기록 {records.data?.total ?? 0}건</h3>
          {records.error ? <SearchError error={records.error} retry={() => void records.refetch()} /> : <>
            {records.data?.records.map(record => <Link key={record.id} href={`/work/${record.id}`} className="workspace-search-result"><div><strong>{record.title}</strong>{record.body && <p>{record.body}</p>}<small>{record.siteName || "일반 업무"} · {record.workDate}</small></div><span aria-hidden="true">›</span></Link>)}
            {records.data?.total === 0 && <p className="workspace-search-empty">검색된 업무기록이 없습니다.</p>}
            <SearchPages page={recordPage} total={records.data?.total ?? 0} label="업무기록" change={setRecordPage} />
          </>}
        </section>}
        {showSchedules && <section><h3>일정 {schedules.data?.total ?? 0}건</h3>
          {schedules.error ? <SearchError error={schedules.error} retry={() => void schedules.refetch()} /> : <>
            {schedules.data?.schedules.map(schedule => <Link key={schedule.id} href={`/schedule?date=${schedule.startAt.slice(0,10)}#schedule-${schedule.id}`} className="workspace-search-result"><div><strong>{schedule.title}</strong>{schedule.body && schedule.body !== schedule.title && <p>{schedule.body}</p>}<small>{schedule.siteName || scheduleCategory(schedule)} · {scheduleTimeLabel(schedule.startAt, schedule.endAt)}</small><small>{schedule.startAt.slice(0,10)}{schedule.endAt.slice(0,10) !== schedule.startAt.slice(0,10) ? ` ~ ${schedule.endAt.slice(0,10)}` : ""}</small></div><span aria-hidden="true">›</span></Link>)}
            {schedules.data?.total === 0 && <p className="workspace-search-empty">검색된 일정이 없습니다.</p>}
            <SearchPages page={schedulePage} total={schedules.data?.total ?? 0} label="일정" change={setSchedulePage} />
          </>}
        </section>}
      </div>}
    </div>
  </dialog>;
}
function SearchPages({ page, total, label, change }: { page: number; total: number; label: string; change: (page: number) => void }) {
  if (total <= pageSize) return null;
  const pages = Math.ceil(total / pageSize);
  return <nav className="workspace-search-pages" aria-label={`${label} 검색 페이지`}><button type="button" disabled={page <= 1} onClick={() => change(page - 1)}>이전</button><span>{page} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => change(page + 1)}>다음</button></nav>;
}
function SearchError({ error, retry }: { error: unknown; retry: () => void }) {
  return <div role="alert" className="work-error"><p>{errorText(error)}</p><button type="button" className="work-text-button" onClick={retry}>다시 시도</button></div>;
}
