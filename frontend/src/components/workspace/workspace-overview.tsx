"use client";
import ChevronRightIcon from "@/components/icons/chevron-right-icon";

import CircleLoader from "@/components/icons/circle-loader";
import PageLoader from "@/components/common/page-loader";

import Link from "@/components/common/app-link";
import ActionMenu from "@/components/common/action-menu";
import PmDateEditor from "./pm-date-editor";
import WorkspaceSearch from "./workspace-search";
import { groupRecentWorkByWeek, recentWorkWindow } from "./recent-work-weeks";
import WorkspaceDrawer from "./workspace-drawer";
import OverviewDetail from "./overview-detail";
import { useMobileWorkspace } from "@/hooks/use-mobile-workspace";
import { useRouter } from "./overlay-navigation";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/provider/auth-provider";
import type { WorkRecord } from "./workspace-data";
import { apiFetch } from "@/lib/api";
import type { OfficeMaintenance } from "@/hooks/use-office-assets-query";
import {
  useWorkspace,
  usePlanning,
  dayString,
  dateLabel,
  errorText,
  serviceLabels,
  statusLabels,
  scheduleTimeLabel,
  scheduleCategory,
} from "./workspace-data";
import { parseDetails } from "./service-form-model";
import {
  calendarDays,
  calendarWindow,
  addCalendarMonths,
  daysBetween,
  nextDue,
} from "./work-planning";
import { PageHeading, Empty, ErrorState } from "./workspace-pages";
type Summary = {
  key: string;
  siteId: string | null;
  siteName: string;
  title: string;
  date: string;
  type: string;
  status: string;
  href: string;
  acrKind?: string;
  countsAsPm?: boolean;
};
type Due = {
  siteId: string;
  siteName: string;
  type: string;
  date: string;
  days: number;
  lastPmDate?: string;
};
function calendarColor(type: string) {
  if (type === "PM") return "gcal-pm";
  if (type.startsWith("ACR")) return "gcal-acr";
  if (["leave", "annual"].includes(type)) return "gcal-leave";
  if (["REPAIR", "COLDHEAD", "INSTALL"].includes(type)) return "gcal-repair";
  if (type === "CALL") return "gcal-call";
  if (type === "office") return "gcal-office";
  if (type === "edu") return "gcal-edu";
  return "gcal-other";
}
export default function OverviewPage() {
  const today = dayString();
  const mobile = useMobileWorkspace();
  const [searchOpen, setSearchOpen] = useState(false);
  const [listHelp, setListHelp] = useState<{ title: string; body: string } | null>(null);
  const [detailHref, setDetailHref] = useState<string | null>(null);
  const calendarGesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressCalendarClick = useRef(false);
  const [month, setMonth] = useState(today.slice(0, 7)),
    [selected, setSelected] = useState(today),
    [dayOpen, setDayOpen] = useState(false),
    [error, setError] = useState("");
  const { session, isAdmin } = useAuth();
  const router = useRouter();
  const [deletingSchedule, setDeletingSchedule] = useState<number | null>(null);
  const [scheduleError, setScheduleError] = useState("");
  const recentRange = recentWorkWindow(today);
  const recent = useQuery({
    queryKey: ["workspace-records", "recent", session?.id, recentRange.from, recentRange.to],
    queryFn: () =>
      apiFetch<WorkRecord[]>(
        `/workspace/records?from=${recentRange.from}&to=${recentRange.to}`,
      ),
    enabled: !!session,
  });
  const range = calendarWindow(month);
  const { sites, records, schedules } = useWorkspace({
    retainMonthData: true,
    recordFrom: range.from,
    recordTo: range.to,
    scheduleFrom: range.from,
    scheduleTo: range.to,
  });
  const planning = usePlanning(),
    qc = useQueryClient();
  const legacy = useQuery({
    queryKey: ["workspace-legacy-history", session?.id, range.from, range.to],
    queryFn: () =>
      apiFetch<{
        items: {
          key: string;
          siteId: string;
          siteName: string;
          date: string;
          maintenance: OfficeMaintenance;
        }[];
        failedSites: string[];
      }>(`/workspace/legacy-history?from=${range.from}&to=${range.to}`),
    placeholderData: (previous, query) => query?.queryKey[1] === session?.id ? previous : undefined,
    enabled: !!session,
    staleTime: 300000,
  });
  const summaries: Summary[] = useMemo(
    () =>
      [
        ...(records.data || []).map((r) => {
          const d = parseDetails(r.detailsJson);
          return {
            key: "new-" + r.id,
            siteId: r.siteId,
            siteName: r.siteName || "일반 업무",
            title: r.title,
            date: r.workDate,
            type: r.kind === "FIELD" ? r.serviceType || "ETC" : "GENERAL",
            status: r.status,
            href: `/work/${r.id}`,
            acrKind: r.acrKind ?? d.acrKind,
            countsAsPm:
              r.countsAsPm === undefined ? d.countsAsPm : !!r.countsAsPm,
          };
        }),
        ...(legacy.data?.items || []).map((item) => ({
          key: item.key,
          siteId: item.siteId,
          siteName: item.siteName,
          title:
            item.maintenance.serviceTitle || item.maintenance.equipmentName,
          date: item.date,
          type: item.maintenance.serviceType || "ETC",
          status: item.maintenance.status,
          href: `/sites/${Number(item.siteId) || item.siteId}`,
        })),
      ].sort((a, b) => b.date.localeCompare(a.date)),
    [records.data, legacy.data],
  );
  const due: Due[] = [];
  for (const site of sites.data || []) {
    const plan = planning.data?.plans.find((p) => p.siteId === site.siteDb);
    const history = summaries.filter(
      (r) => r.siteId === site.siteDb && r.status === "COMPLETED",
    );
    const pm =
      [
        history.find((r) => r.type === "PM" || r.countsAsPm)?.date,
        plan?.lastPmDate,
      ]
        .filter(Boolean)
        .sort()
        .at(-1) || undefined;
    const full =
      [
        history.find((r) => r.type === "ACR" && r.acrKind === "full")?.date,
        plan?.lastAcrFullDate,
      ]
        .filter(Boolean)
        .sort()
        .at(-1) || undefined;
    const doc =
      [
        history.find(
          (r) => r.type === "ACR" && ["doc", "full"].includes(r.acrKind || ""),
        )?.date,
        plan?.lastAcrDocDate,
      ]
        .filter(Boolean)
        .sort()
        .at(-1) || undefined;
    for (const [type, date] of [
      ["PM", nextDue(pm, plan?.pmOverride, plan?.pmIntervalMonths || 2)],
      ["ACR 정밀", nextDue(full, plan?.acrFullOverride, 36)],
      ["ACR 서류", nextDue(doc, plan?.acrDocOverride, 12)],
    ] as [string, string | null][]) {
      if (date)
        due.push({
          siteId: site.siteDb,
          siteName: site.name || site.siteDb,
          type,
          date,
          days: daysBetween(date, today),
          lastPmDate: pm,
        });
    }
  }
  due.sort((a, b) => a.date.localeCompare(b.date));
  const upcomingDue = due.filter((d) => d.days <= 45);
  const preparations = planning.data?.preparations || [];
  const preparationGroups = Array.from(
    preparations.reduce((groups, item) => {
      const key = item.siteId || "general";
      const group = groups.get(key) || { siteId: item.siteId, siteName: item.siteName || "일반 업무", items: [] as typeof preparations };
      group.items.push(item);
      groups.set(key, group);
      return groups;
    }, new Map<string, { siteId: string | null; siteName: string; items: typeof preparations }>()),
    ([key, group]) => ({ key, ...group }),
  ).sort((a, b) => a.siteName.localeCompare(b.siteName, "ko"));
  const recentRecords = recent.data || [];
  const recentWeeks = groupRecentWorkByWeek(recentRecords);
  const days = calendarDays(month);
  const dayRecords = summaries.filter((r) => r.date === selected);
  const daySchedules = (schedules.data || []).filter(
    (s) =>
      s.startAt.slice(0, 10) <= selected && s.endAt.slice(0, 10) >= selected,
  );
  const dayDue = due.filter((d) => d.date === selected);
  const recordsLoading =
    sites.isPending || records.isPending || legacy.isPending;
  const recordsFailed =
    !!(sites.error || records.error || legacy.error) ||
    !!legacy.data?.failedSites.length;
  const planningLoading = recordsLoading || planning.isPending;
  const planningFailed = recordsFailed || !!planning.error;
  function retryRecords() {
    void sites.refetch();
    void records.refetch();
    void legacy.refetch();
  }
  function retryPlanning() {
    retryRecords();
    void planning.refetch();
  }
  async function check(id: number, done: boolean) {
    setError("");
    try {
      await apiFetch(`/workspace/preparations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ done }),
      });
      await qc.invalidateQueries({ queryKey: ["workspace-planning"] });
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function removeSchedule(id: number) {
    if (deletingSchedule !== null || !window.confirm("이 일정을 삭제할까요?")) return;
    setDeletingSchedule(id);
    setScheduleError("");
    try {
      await apiFetch(`/workspace/schedules/${id}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["workspace-schedules"] });
    } catch (e) {
      setScheduleError(errorText(e));
    } finally {
      setDeletingSchedule(null);
    }
  }
  // The overview's queries populate one screen; wait in one place instead of
  // showing a spinner for each calendar source and summary card.
  if (recordsLoading || schedules.isPending || planning.isPending || recent.isPending) {
    return <PageLoader as="main" />;
  }
  return (
    <main className="work-page work-overview" aria-label="업무 현황">
      <PageHeading
        title="업무 현황"
        description="점검 예정일, 일정과 방문 전 확인사항을 한눈에 확인하세요."
        action={<Link className="work-secondary hospital-register" href={`/schedule?date=${selected}&new=1`}>＋ 작성</Link>}
      />
      <div className="work-section overview-calendar-heading">
        <h2>일정 달력</h2>
        <div className="overview-shortcuts">
          <Link href="/work">업무기록 목록</Link>
        </div>
      </div>
      <section className="work-panel work-calendar" aria-busy={records.isFetching || schedules.isFetching || legacy.isFetching}>
        <div className="work-calendar-toolbar">
          <button
            type="button"
            aria-label="이전 달"
            onClick={() =>
              setMonth(addCalendarMonths(month + "-01", -1).slice(0, 7))
            }
          >
            ‹
          </button>
          <label className="overview-month-picker">
            <strong aria-hidden="true">{Number(month.slice(0, 4))}년 {Number(month.slice(5))}월</strong>
            <span className="sr-only">조회 연월</span>
            <input
              type="month"
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </label>
          <button
            type="button"
            aria-label="다음 달"
            onClick={() =>
              setMonth(addCalendarMonths(month + "-01", 1).slice(0, 7))
            }
          >
            ›
          </button>
          <button type="button" className="overview-search-trigger calendar-toolbar-action" aria-label="업무기록·일정 검색" aria-haspopup="dialog" onClick={() => setSearchOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg><span>검색</span>
          </button>
          {!mobile && <button type="button" className="work-calendar-today calendar-toolbar-action" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16" /><circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" /></svg><span>오늘</span></button>}
        </div>
        <CalendarLoadState
          label="업무기록"
          failed={recordsFailed}
          pending={recordsLoading}
          retry={retryRecords}
        />
        <CalendarLoadState
          label="일정"
          failed={!!schedules.error}
          pending={schedules.isPending}
          retry={() => {
            void schedules.refetch();
          }}
        />
        <CalendarLoadState
          label="점검 기한"
          failed={planningFailed}
          pending={planningLoading}
          retry={retryPlanning}
        />
        <div className="overview-calendar-inner"
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            suppressCalendarClick.current = false;
            calendarGesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          }}
          onPointerMove={(event) => {
            const start = calendarGesture.current;
            if (!start || start.id !== event.pointerId) return;
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            if (Math.abs(dy) > 20 && Math.abs(dy) > Math.abs(dx)) {
              calendarGesture.current = null;
              return;
            }
            if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
              suppressCalendarClick.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
            }
          }}
          onPointerUp={(event) => {
            const start = calendarGesture.current;
            calendarGesture.current = null;
            if (!start || start.id !== event.pointerId) return;
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.4) {
              suppressCalendarClick.current = true;
              setMonth((current) => addCalendarMonths(current + "-01", dx < 0 ? 1 : -1).slice(0, 7));
            }
          }}
          onPointerCancel={() => { calendarGesture.current = null; }}
          onClickCapture={(event) => {
            if (suppressCalendarClick.current) {
              event.preventDefault();
              event.stopPropagation();
              suppressCalendarClick.current = false;
            }
          }}
        >
        <div className="work-calendar-grid weekdays">
          {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="work-calendar-grid">
          {days.map((day) => {
            const logs = summaries.filter((r) => r.date === day),
              events = (schedules.data || []).filter(
                (s) =>
                  s.startAt.slice(0, 10) <= day && s.endAt.slice(0, 10) >= day,
              ),
              dueItems = due.filter((d) => d.date === day);
            const tags = [
              ...events.map((s) => ({
                title: `${s.siteName || s.title} · ${s.serviceType === "PM" ? "PM" : scheduleCategory(s)}`,
                type: calendarColor(
                  s.siteId ? s.serviceType || "ETC" : s.personalKind || "etc",
                ),
              })),
              ...logs.map((r) => ({
                title: `${r.siteName} · ${r.type === "PM" ? "PM" : serviceLabels[r.type] || r.title}`,
                type: calendarColor(r.type),
              })),
              ...dueItems.map((d) => ({
                title: `${d.siteName} · ${d.type}`,
                type: calendarColor(d.type),
              })),
            ];
            return (
              <button
                key={day}
                type="button"
                aria-label={`${dateLabel(day)}, 기록 ${logs.length}건, 일정 ${events.length}건, 점검 예정 ${dueItems.length}건`}
                aria-haspopup="dialog"
                aria-pressed={selected === day}
                className={`work-calendar-day ${day.slice(0, 7) !== month ? "outside" : ""} ${selected === day ? "selected" : ""} ${today === day ? "today" : ""}`}
                onClick={() => {
                  setSelected(day);
                  setScheduleError("");
                  setDayOpen(true);
                }}
              >
                <span>{Number(day.slice(8))}</span>
                <div className="work-calendar-tags">
                  {tags.slice(0, 3).map((t, i) => (
                    <span
                      className={t.type}
                      title={t.title}
                      key={i}
                    >
                      {t.title}
                    </span>
                  ))}
                  {tags.length > 3 && <small>+{tags.length - 3}</small>}
                </div>
              </button>
            );
          })}
        </div>
        </div>
        <div className="work-calendar-legend">
          <span className="gcal-pm">● PM</span>
          <span className="gcal-acr">● ACR</span>
          <span className="gcal-leave">● 휴가·연차</span>
          <span className="gcal-repair">● 고장수리·부품교체·설치</span>
          <span className="gcal-call">● 콜</span>
          <span className="gcal-office">● 사무실</span>
          <span className="gcal-edu">● 교육·세미나</span>
          <span className="gcal-other">● 기타</span>
        </div>
      </section>
      {searchOpen && <WorkspaceSearch onClose={() => setSearchOpen(false)} onOpenDetail={mobile ? setDetailHref : undefined} />}
      {dayOpen && (
        <WorkspaceDrawer
          onClose={() => setDayOpen(false)}
          title={dateLabel(selected)}
          onOpenDetail={mobile ? setDetailHref : undefined}
        >
          <section
            className="day-agenda-section"
          >
            <div className="day-section-toolbar">
              <h3>
                작성된 업무기록
                {!recordsLoading && !recordsFailed
                  ? ` (${dayRecords.length})`
                  : ""}
              </h3>
              <Link
                className="day-section-action"
                href={`/work/new?date=${selected}`}
              >
                작성
              </Link>
            </div>
            <CalendarLoadState
              label="업무기록"
              failed={recordsFailed}
              pending={recordsLoading}
              retry={retryRecords}
            />
            {dayRecords.length ? (
              <div className="day-entry-list">
                {dayRecords.map((r) => (
                  <DayEntry
                    key={r.key}
                    href={r.href}
                    date={r.date}
                    category={r.type}
                    completed={r.status === "COMPLETED"}
                    type={
                      r.type === "PM" ? "PM" : serviceLabels[r.type] || "기타"
                    }
                    title={r.siteName}
                    description={r.title !== r.siteName ? r.title : undefined}
                    meta={statusLabels[r.status] || r.status}
                  />
                ))}
              </div>
            ) : !recordsLoading && !recordsFailed ? (
              <div className="day-empty-card"><p className="day-empty">작성된 업무기록이 없습니다.</p></div>
            ) : null}
          </section>
          <section
            className="day-agenda-section"
          >
            <div className="day-section-toolbar">
              <h3>
                등록한 일정{" "}
                {!schedules.isPending && !schedules.error
                  ? `(${daySchedules.length})`
                  : ""}
              </h3>
              <Link
                className="day-section-action"
                href={`/schedule?date=${selected}&new=1`}
              >
                일정 등록
              </Link>
            </div>
            <CalendarLoadState
              label="일정"
              failed={!!schedules.error}
              pending={schedules.isPending}
              retry={() => {
                void schedules.refetch();
              }}
            />
            {scheduleError && <p role="alert" className="work-error">{scheduleError}</p>}
            {daySchedules.length ? (
              <div className="day-entry-list day-schedule-list">
                {daySchedules.map((s) => (
                  <div className="day-schedule-row" key={s.id}>
                  <DayEntry
                    href={`/schedule?date=${selected}#schedule-${s.id}`}
                    category={s.serviceType || "GENERAL"}
                    type={s.serviceType === "PM" ? "PM" : scheduleCategory(s)}
                    title={s.siteName || s.title}
                    description={
                      s.siteName && s.title !== s.siteName ? s.title : undefined
                    }
                    meta={scheduleTimeLabel(s.startAt, s.endAt)}
                  />
                  <ActionMenu label={`${s.title} 일정 메뉴`} items={[
                    ...(s.authorId === session?.id || isAdmin ? [{
                      label: "수정",
                      disabled: deletingSchedule !== null,
                      onSelect: () => router.push(`/schedule?date=${selected}&edit=${s.id}`),
                    }] : []),
                    { label: "업무기록 작성", disabled: deletingSchedule !== null, onSelect: () => router.push(`/work/new?schedule=${s.id}`) },
                    ...(s.authorId === session?.id || isAdmin ? [{ label: "삭제", danger: true, disabled: deletingSchedule !== null, onSelect: () => void removeSchedule(s.id) }] : []),
                  ]} />
                  {s.serviceType === "PM" && s.siteId && <PmDateEditor siteId={s.siteId} date={s.startAt.slice(0,10)} schedule={s} />}
                  </div>
                ))}
              </div>
            ) : !schedules.isPending && !schedules.error ? (
              <div className="day-empty-card"><p className="day-empty">등록된 일정이 없습니다.</p></div>
            ) : null}
          </section>
          <CalendarLoadState
            label="점검 기한"
            failed={planningFailed}
            pending={planningLoading}
            retry={retryPlanning}
          />
          {!!dayDue.length && (
            <section className="day-agenda-section day-due-section">
              <div className="day-section-heading">
                <h3>
                  점검 기한 <span>{dayDue.length}</span>
                </h3>
                <details className="day-due-help">
                  <summary aria-label="점검 기한 안내">?</summary>
                  <p>
                    점검 주기와 완료 이력으로 계산한 날짜입니다. 방문 확정
                    일정은 아니며, 병원 상세에서 기준을 변경할 수 있습니다.
                  </p>
                </details>
              </div>
              <div className="day-entry-list">
                {dayDue.map((d, i) => (
                  <div key={"d" + i} className="day-pm-due-item">
                  <DayEntry
                    href={`/sites/${d.siteId}#inspection-plan`}
                    type={d.type}
                    title={d.siteName}
                    meta={`최근 PM ${d.lastPmDate || "기록 없음"}`}
                  />
                  <div className="day-due-actions"><Link className="work-secondary inspection-record-create" href={`/work/new?site=${encodeURIComponent(d.siteId)}&date=${d.date}&type=${d.type === "PM" ? "PM" : "ACR"}&acrKind=${d.type.includes("정밀") ? "full" : "doc"}`}>업무기록 작성</Link>
                  {d.type === "PM" && <PmDateEditor siteId={d.siteId} date={d.date} compact />}
                  </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </WorkspaceDrawer>
      )}
      <div className="overview-folds">
        <details
          id="work-due"
          className="overview-fold"
        >
          <summary>
            <ChevronRightIcon className="overview-fold-chevron" />
            <span>다가오는 점검</span>
            <button type="button" className="overview-list-help work-help-button" aria-label="다가오는 점검 안내" onClick={event => { event.preventDefault(); event.stopPropagation(); setListHelp({ title: "다가오는 점검 안내", body: "PM 기본 2개월 · ACR 서류 12개월 · 정밀 36개월. 유형이 확인된 완료 기록과 병원별 지정일로 계산합니다. 45일 이내 점검을 표시하며, 방문 확정 일정과는 다릅니다." }); }}><span className="work-help-symbol" aria-hidden="true">?</span></button>
            <small>
              45일 이내
              {!planningLoading && !planningFailed
                ? ` · ${upcomingDue.length}건`
                : ""}
            </small>
          </summary>
          <div className="overview-fold-body">
            <div className="work-panel">
              <CalendarLoadState
                label="점검 기한"
                failed={planningFailed}
                pending={planningLoading}
                retry={retryPlanning}
              />
              {upcomingDue.map((d) => (
                <Link
                  className="work-due-row"
                  href={`/sites/${d.siteId}`}
                  key={d.siteId + d.type}
                  onNavigate={mobile ? (event) => { event.preventDefault(); setDetailHref(`/sites/${d.siteId}`); } : undefined}
                >
                  <div className="overview-due-content">
                    <strong>{d.siteName}</strong>
                    <div className="overview-due-meta">
                      <span className="overview-due-type">{d.type === "PM" ? "정기점검(PM)" : d.type}</span>
                      <span>예정일 {d.date.replaceAll("-", ". ")}</span>
                      {d.type === "PM" && <span>최근 PM {d.lastPmDate?.replaceAll("-", ". ") || "기록 없음"}</span>}
                    </div>
                  </div>
                  <span className={`work-badge overview-due-count ${d.days < 0 ? "overdue" : d.days <= 14 ? "soon" : ""}`}>
                    {d.days < 0 ? `${-d.days}일 지남` : `D-${d.days}`}
                  </span>
                </Link>
              ))}
              {!upcomingDue.length && !planningLoading && !planningFailed && (
                <Empty>45일 이내 예정된 점검이 없습니다.</Empty>
              )}
            </div>
          </div>
        </details>
        <details
          id="work-preparation"
          className="overview-fold"
        >
          <summary>
            <ChevronRightIcon className="overview-fold-chevron" />
            <span>방문 전 확인사항</span>
            <button type="button" className="overview-list-help work-help-button" aria-label="방문 전 확인사항 안내" onClick={event => { event.preventDefault(); event.stopPropagation(); setListHelp({ title: "방문 전 확인사항 안내", body: "업무기록에 작성한 방문 전 확인사항을 병원별로 표시합니다. 완료한 항목은 체크해주세요." }); }}><span className="work-help-symbol" aria-hidden="true">?</span></button>
            <small>{preparations.filter((p) => !p.done).length}건 남음</small>
          </summary>
          <div className="overview-fold-body">
            {error && (
              <p
                className="work-error"
                role="alert"
              >
                {error}
              </p>
            )}
            {planning.error ? (
              <ErrorState
                error={planning.error}
                retry={() => void planning.refetch()}
              />
            ) : (
              <div className="work-panel">
                {preparationGroups.map((group) => (
                  <section className="overview-preparation-group" key={group.key}>
                    <h3>
                      {group.siteId ? <button type="button" onClick={() => mobile ? setDetailHref(`/sites/${group.siteId}`) : router.push(`/sites/${group.siteId}`)}>{group.siteName} <span aria-hidden="true">›</span></button> : group.siteName}
                      <small>{group.items.filter((item) => !item.done).length}건 남음</small>
                    </h3>
                    {group.items.map((p) => (
                      <label className={`work-preparation ${p.done ? "done" : ""}`} key={p.id}>
                        <input type="checkbox" checked={p.done} onChange={(e) => void check(p.id, e.target.checked)} />
                        <strong>{p.content}</strong>
                      </label>
                    ))}
                  </section>
                ))}
                {!preparations.length && (
                  <Empty>
                    등록된 확인사항이 없습니다.
                  </Empty>
                )}
              </div>
            )}
          </div>
        </details>
        <details className="overview-fold">
          <summary>
            <ChevronRightIcon className="overview-fold-chevron" />
            <span>최근 업무기록</span>
            <button type="button" className="overview-list-help work-help-button" aria-label="최근 업무기록 안내" onClick={event => { event.preventDefault(); event.stopPropagation(); setListHelp({ title: "최근 업무기록 안내", body: "이번 주와 이전 4주의 업무기록을 표시합니다." }); }}><span className="work-help-symbol" aria-hidden="true">?</span></button>
            <small>
              {recent.isPending
                ? <CircleLoader size="xs" inline />
                : recent.isError
                  ? "조회 실패"
                  : `${recentRecords.length}건`}
            </small>
          </summary>
          <div className="overview-fold-body">
            <Link
              className="work-back"
              href="/work"
            >
              업무기록 전체 보기 →
            </Link>

            {recent.isError ? (
              <ErrorState
                error={recent.error}
                retry={() => void recent.refetch()}
              />
            ) : (
              <div className="work-panel">
                {recentWeeks.map((week) => (
                  <section className="recent-work-week" key={week.key} aria-label={`${week.year}년 ${week.label}`}>
                    <h3 className="recent-work-week-heading"><span>{week.label}</span><small>{week.records.length}건</small></h3>
                    {week.records.map((r) => (
                  <Link
                    href={`/work/${r.id}`}
                    className="work-overview-record recent-work-record"
                    onNavigate={mobile ? (event) => { event.preventDefault(); setDetailHref(`/work/${r.id}`); } : undefined}
                    key={r.id}
                  >
                    <div className="recent-work-content">
                      <div className="recent-work-meta">
                        <time dateTime={r.workDate}>{r.workDate}</time>
                        {r.siteName && <small className="recent-work-site">{r.siteName}</small>}
                        <span className="work-badge">
                          {r.kind === "GENERAL"
                            ? "일반 업무"
                            : serviceLabels[r.serviceType || ""] ||
                              "현장 서비스"}
                        </span>
                        <span
                          className={`work-status ${r.status === "COMPLETED" ? "done" : ""}`}
                        >
                          {statusLabels[r.status] || "상태 미등록"}
                        </span>
                        <small>{r.authorName}</small>
                      </div>
                      <strong>{r.title || "제목 없는 업무기록"}</strong>
                    </div>
                    <span
                      aria-hidden="true"
                      className="recent-work-arrow"
                    >
                      ›
                    </span>
                  </Link>
                ))}
                  </section>
                ))}
                {!recentRecords.length && (
                  <Empty>
                    {recent.isPending
                      ? <CircleLoader size="xs" />
                      : "아직 작성된 업무기록이 없습니다."}
                  </Empty>
                )}
              </div>
            )}
          </div>
        </details>
      </div>
      {listHelp && <WorkspaceDrawer title={listHelp.title} onClose={() => setListHelp(null)}><p className="overview-list-help-copy">{listHelp.body}</p></WorkspaceDrawer>}
      {detailHref && <OverviewDetail href={detailHref} onClose={() => setDetailHref(null)} />}
      <Link className="work-secondary hospital-register overview-write-mobile" href={`/schedule?date=${selected}&new=1`} aria-label="일정 등록">＋ 작성</Link>
    </main>
  );
}

function DayEntry({
  href,
  type,
  title,
  description,
  meta,
  date,
  completed,
  category = "PM",
}: {
  href: string;
  type: string;
  title: string;
  description?: string;
  meta: string;
  date?: string;
  completed?: boolean;
  category?: string;
}) {
  return (
    <Link
      href={href}
      className={`day-entry day-category-${category.toLowerCase()}`}
    >
      <div className="day-entry-content">
        <strong>{title}</strong>
        {description && <p>{description}</p>}
        <span className="day-type">{type}</span>
      </div>
      <div className="day-entry-aside">
        {date && (
          <time dateTime={date}>
            {new Date(date + "T12:00:00+09:00").toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "numeric",
              day: "numeric",
              weekday: "short",
              timeZone: "Asia/Seoul",
            })}
          </time>
        )}
        <span className={`day-entry-status${completed ? "is-completed" : ""}`}>
          {meta}
        </span>
      </div>
    </Link>
  );
}

function CalendarLoadState({
  label,
  failed,
  pending,
  retry,
}: {
  label: string;
  failed: boolean;
  pending: boolean;
  retry: () => void;
}) {
  if (failed)
    return (
      <div
        className="work-error calendar-load-state"
        role="alert"
      >
        {label} 조회에 실패했습니다. 일부 항목이 표시되지 않을 수 있습니다.{" "}
        <button
          type="button"
          onClick={retry}
        >
          다시 시도
        </button>
      </div>
    );
  if (pending)
    return (
      <p
        className="work-hint calendar-load-state"
        role="status"
      ><CircleLoader size="xs" /></p>
    );
  return null;
}
