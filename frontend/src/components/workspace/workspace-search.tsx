"use client";

import Pagination from "@/components/common/pagination";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import WorkspaceDrawer from "./workspace-drawer";
import Link from "@/components/common/app-link";
import CircleLoader from "@/components/icons/circle-loader";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";
import { errorText, scheduleCategory, scheduleTimeLabel, type WorkRecord, type WorkSchedule } from "./workspace-data";

const pageSize = 10;

export default function WorkspaceSearch({ onClose, onOpenDetail }: { onClose: () => void; onOpenDetail?: (href: string) => void }) {
  const { session } = useAuth();
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const [recordPage, setRecordPage] = useState(1);
  const [schedulePage, setSchedulePage] = useState(1);
  const records = useQuery({
    queryKey: ["workspace-search", "records", session?.id, term, recordPage],
    queryFn: () => apiFetch<{ records: WorkRecord[]; total: number }>(`/workspace/records/search?${new URLSearchParams({ query: term, page: String(recordPage), size: String(pageSize) })}`),
    enabled: !!session && !!term,
  });
  const schedules = useQuery({
    queryKey: ["workspace-search", "schedules", session?.id, term, schedulePage],
    queryFn: () => apiFetch<{ schedules: WorkSchedule[]; total: number }>(`/workspace/schedules/search?${new URLSearchParams({ query: term, page: String(schedulePage), size: String(pageSize) })}`),
    enabled: !!session && !!term,
  });
  function search(event: FormEvent) {
    event.preventDefault();
    const next = input.trim();
    setRecordPage(1); setSchedulePage(1); setTerm(next);
    if (next && next === term) {
      void records.refetch();
      void schedules.refetch();
    }
  }
  const pending = !!term && (records.isPending || schedules.isPending);
  return <WorkspaceDrawer title="업무기록·일정 검색" onClose={onClose} onOpenDetail={onOpenDetail} className="workspace-search-dialog">
    <div className="workspace-search-body">
      <form className="workspace-search-form" onSubmit={search} role="search">
        <input type="search" aria-label="업무기록·일정 검색어" placeholder="병원명 · 제목 · 내용 검색" value={input} maxLength={200} onChange={event => setInput(event.target.value)} />
        <button type="submit" className="work-primary" disabled={!input.trim()}>검색</button>
      </form>
      <p className="workspace-search-hint">{term ? `‘${term}’ 검색 결과 · 전체 기간` : "과거 업무기록과 앞으로의 일정을 함께 검색합니다."}</p>
      {pending ? <div className="workspace-search-loading"><CircleLoader size="m" inline /></div> : term && <div className="workspace-search-results">
        <section><h3>업무기록 {records.data?.total ?? 0}건</h3>
          {records.error ? <SearchError error={records.error} retry={() => void records.refetch()} /> : <>
            {records.data?.records.map(record => <Link key={record.id} href={`/work/${record.id}`} className="workspace-search-result"><div><strong>{record.title}</strong>{record.body && <p>{record.body}</p>}<small>{record.siteName || "일반 업무"} · {record.workDate}</small></div><span aria-hidden="true">›</span></Link>)}
            {records.data?.total === 0 && <p className="workspace-search-empty">검색된 업무기록이 없습니다.</p>}
            <SearchPages page={recordPage} total={records.data?.total ?? 0} label="업무기록" change={setRecordPage} />
          </>}
        </section>
        <section><h3>일정 {schedules.data?.total ?? 0}건</h3>
          {schedules.error ? <SearchError error={schedules.error} retry={() => void schedules.refetch()} /> : <>
            {schedules.data?.schedules.map(schedule => <Link key={schedule.id} href={`/schedule?date=${schedule.startAt.slice(0,10)}#schedule-${schedule.id}`} className="workspace-search-result"><div><strong>{schedule.title}</strong>{schedule.body && schedule.body !== schedule.title && <p>{schedule.body}</p>}<small>{schedule.siteName || scheduleCategory(schedule)} · {scheduleTimeLabel(schedule.startAt, schedule.endAt)}</small><small>{schedule.startAt.slice(0,10)}{schedule.endAt.slice(0,10) !== schedule.startAt.slice(0,10) ? ` ~ ${schedule.endAt.slice(0,10)}` : ""}</small></div><span aria-hidden="true">›</span></Link>)}
            {schedules.data?.total === 0 && <p className="workspace-search-empty">검색된 일정이 없습니다.</p>}
            <SearchPages page={schedulePage} total={schedules.data?.total ?? 0} label="일정" change={setSchedulePage} />
          </>}
        </section>
      </div>}
    </div>
  </WorkspaceDrawer>;
}
function SearchPages({ page, total, label, change }: { page: number; total: number; label: string; change: (page: number) => void }) {
  if (total <= pageSize) return null;
  return <Pagination page={page} total={total} pageSize={pageSize} onPageChange={change} label={`${label} 검색 페이지`} />;
}
function SearchError({ error, retry }: { error: unknown; retry: () => void }) {
  return <div role="alert" className="work-error"><p>{errorText(error)}</p><button type="button" className="work-text-button" onClick={retry}>다시 시도</button></div>;
}
