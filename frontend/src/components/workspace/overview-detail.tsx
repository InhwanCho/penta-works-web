"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "@/components/common/app-link";
import CircleLoader from "@/components/icons/circle-loader";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";
import PmDateEditor from "./pm-date-editor";
import WorkspaceDrawer from "./workspace-drawer";
import HospitalSection from "@/components/site/hospital-section";
import { ReadRecord } from "./work-editor";
import HospitalPlanning from "./hospital-planning";
import HospitalWork from "./hospital-work";
import { HospitalProfile, useHospitalProfile } from "./hospital-profile";
import { ErrorState, Empty } from "./workspace-pages";
import { dateLabel, scheduleCategory, scheduleTimeLabel, type Hospital, type WorkRecord, type WorkSchedule } from "./workspace-data";

export default function OverviewDetail({ href, onClose }: { href: string; onClose: () => void }) {
  const [history, setHistory] = useState<string[]>([]);
  const current = history.at(-1) || href;
  const url = new URL(current, "https://workspace.local");
  const recordId = url.pathname.match(/^\/work\/(\d+)$/)?.[1];
  const requestedSiteId = url.pathname.match(/^\/sites\/([^/]+)$/)?.[1];
  const date = url.searchParams.get("date") || "";
  const scheduleId = url.hash.match(/^#schedule-(\d+)$/)?.[1];
  const { session, isAdmin } = useAuth();
  const sites = useQuery({
    queryKey: ["workspace-sites", session?.id],
    queryFn: () => apiFetch<Hospital[]>("/workspace/hospitals"),
    enabled: !!session && !!requestedSiteId,
  });
  const siteId = sites.data?.find(site => site.siteDb === requestedSiteId || (/^\d+$/.test(site.siteDb) && /^\d+$/.test(requestedSiteId || "") && Number(site.siteDb) === Number(requestedSiteId)))?.siteDb || requestedSiteId;
  const profile = useHospitalProfile(siteId || "");
  const record = useQuery({
    queryKey: ["workspace-records", "detail", session?.id, recordId],
    queryFn: () => apiFetch<WorkRecord>(`/workspace/records/${recordId}`),
    enabled: !!session && !!recordId,
  });
  const schedules = useQuery({
    queryKey: ["workspace-schedules", session?.id, date, date],
    queryFn: () => apiFetch<WorkSchedule[]>(`/workspace/schedules?${new URLSearchParams({ from: date, to: date })}`),
    enabled: !!session && url.pathname === "/schedule" && !!date,
  });
  const rows = (schedules.data || []).filter(row => !scheduleId || String(row.id) === scheduleId);
  return <WorkspaceDrawer title={recordId ? "업무기록 상세" : siteId ? profile.data?.name || "병원 · 점검 상세" : "일정 상세"} onClose={onClose}
    onBack={history.length ? () => setHistory(value => value.slice(0, -1)) : undefined}
    onOpenDetail={next => setHistory(value => [...value, next])} scrollKey={current} className="overview-detail-drawer">
    <div className="overview-detail-body" key={current}>
      {recordId ? record.isPending ? <CircleLoader size="m" /> : record.error ? <ErrorState error={record.error} retry={() => void record.refetch()} /> : record.data && <>
        <p className="work-hint">{record.data.workDate} · {record.data.authorName}</p>
        <ReadRecord record={record.data} />
        <Link href={`/work/${recordId}?view=page`} className="work-secondary">업무기록 페이지 열기</Link>
      </> : siteId ? <>
        <HospitalSection key={`${siteId}-info`} title="병원 정보" anchor="hospital-info" allScreens defaultOpen>
          <div className="hospital-detail-card"><HospitalProfile siteId={siteId} /></div>
        </HospitalSection>
        <HospitalSection key={`${siteId}-plan`} title="점검 주기·지정일" anchor="inspection-plan" allScreens defaultOpen={url.hash === "#inspection-plan"}>
          <HospitalPlanning siteId={siteId} />
        </HospitalSection>
        <HospitalSection key={`${siteId}-history`} title="병원 정비이력" anchor="hospital-history" allScreens>
          <HospitalWork siteId={siteId} />
        </HospitalSection>
      </> : schedules.isPending ? <CircleLoader size="m" /> : schedules.error ? <ErrorState error={schedules.error} retry={() => void schedules.refetch()} /> : rows.length ? rows.map(row => <section className="work-panel overview-schedule-detail" key={row.id}>
        <div className="overview-detail-meta"><span className="work-badge">{scheduleCategory(row)}</span><small>{row.authorName}</small></div>
        <h2>{row.title}</h2>
        {row.siteId && <Link className="overview-detail-site" href={`/sites/${row.siteId}`}>{row.siteName} →</Link>}
        <dl className="overview-detail-facts"><div><dt>날짜</dt><dd>{dateLabel(row.startAt.slice(0, 10))}</dd></div><div><dt>시간</dt><dd>{scheduleTimeLabel(row.startAt, row.endAt)}</dd></div></dl>
        {row.body && <div className="overview-detail-description"><h3>일정 내용</h3><p className="work-prewrap">{row.body}</p></div>}
        {row.serviceType === "PM" && row.siteId && <PmDateEditor siteId={row.siteId} date={row.startAt.slice(0,10)} schedule={row} />}
        <div className="work-form-actions">
          {(row.authorId === session?.id || isAdmin) && <Link className="work-secondary" href={`/schedule?date=${date}&edit=${row.id}`}>일정 수정</Link>}
          <Link className="work-secondary hospital-register" href={`/work/new?schedule=${row.id}`}>업무기록 작성</Link>
        </div>
      </section>) : <Empty>일정을 찾을 수 없습니다.</Empty>}
    </div>
  </WorkspaceDrawer>;
}
