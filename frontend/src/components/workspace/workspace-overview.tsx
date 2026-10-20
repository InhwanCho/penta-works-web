"use client";
import Link from "next/link";
import { useMemo, useState, useEffect, useRef, type ReactNode } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/api";
import type { OfficeAssetsResponse } from "@/hooks/use-office-assets-query";
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
};
export default function OverviewPage() {
  const { sites, records, schedules } = useWorkspace(),
    planning = usePlanning(),
    qc = useQueryClient();
  const today = dayString();
  const [month, setMonth] = useState(today.slice(0, 7)),
    [selected, setSelected] = useState(today),
    [dayOpen, setDayOpen] = useState(false),
    [error, setError] = useState("");
  const old = useQueries({
    queries: (sites.data || []).map((site) => ({
      queryKey: ["officeAssets", site.siteDb],
      queryFn: () =>
        apiFetch<OfficeAssetsResponse>(
          `/sites/${encodeURIComponent(site.siteDb)}/office-assets`,
        ),
      staleTime: 300000,
      retry: false,
    })),
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
        ...old.flatMap((q, i) =>
          (q.data?.maintenanceHistory || [])
            .filter((r) => r.workDate)
            .map((r) => ({
              key: `old-${i}-${r.id}`,
              siteId: sites.data![i].siteDb,
              siteName: sites.data![i].name || sites.data![i].siteDb,
              title: r.serviceTitle || r.equipmentName,
              date: r.workDate!,
              type: r.serviceType || "ETC",
              status: r.status,
              href: `/sites/${Number(sites.data![i].siteDb) || sites.data![i].siteDb}`,
            })),
        ),
      ].sort((a, b) => b.date.localeCompare(a.date)),
    [records.data, old, sites.data],
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
        });
    }
  }
  due.sort((a, b) => a.date.localeCompare(b.date));
  const upcomingDue = due.filter((d) => d.days <= 45);
  const preparations = planning.data?.preparations || [];
  const recentRecords = [...(records.data || [])]
    .sort((a, b) => b.workDate.localeCompare(a.workDate) || b.id - a.id)
    .slice(0, 8);
  const days = calendarDays(month);
  const dayRecords = summaries.filter((r) => r.date === selected);
  const daySchedules = (schedules.data || []).filter(
    (s) =>
      s.startAt.slice(0, 10) <= selected && s.endAt.slice(0, 10) >= selected,
  );
  const dayDue = due.filter((d) => d.date === selected);
  const loading =
    sites.isPending || records.isPending || old.some((q) => q.isPending);
  const partial = old.some(
    (q) =>
      q.isError && !(q.error instanceof ApiError && q.error.status === 404),
  );
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
  return (
    <main className="work-page work-overview">
      <PageHeading
        title="업무 현황"
        description="점검 예정일, 일정과 방문 전 확인사항을 한눈에 확인하세요."
      />
      {(records.error || sites.error) && (
        <ErrorState
          error={records.error || sites.error}
          retry={() => {
            void records.refetch();
            void sites.refetch();
          }}
        />
      )}
      {partial && (
        <p className="work-hint">
          일부 병원의 이전 서비스 이력을 불러오지 못했습니다. 표시된 기록을
          기준으로 집계합니다.
        </p>
      )}
      <div className="work-section">
        <h2>일정 달력</h2>
        <div className="overview-shortcuts">
          <Link href="/work">작업일지 목록</Link>
          <Link href="/schedule">＋ 일정 작성·관리</Link>
        </div>
      </div>
      <section className="work-panel work-calendar">
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
          <label>
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
          <button
            type="button"
            className="work-calendar-today"
            onClick={() => {
              setMonth(today.slice(0, 7));
              setSelected(today);
            }}
          >
            오늘
          </button>
        </div>
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
                title: `${s.serviceType === "PM" ? "PM" : scheduleCategory(s)} · ${s.siteName || s.title}`,
                type: "schedule",
              })),
              ...logs.map((r) => ({
                title: `${r.siteName} · ${r.type === "PM" ? "PM" : serviceLabels[r.type] || r.title}`,
                type: r.status === "COMPLETED" ? "record" : "open",
              })),
              ...dueItems.map((d) => ({
                title: `${d.type} · ${d.siteName}`,
                type: "due",
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
                <div
                  className="work-calendar-dots"
                  aria-hidden="true"
                >
                  {[...new Set(tags.map((t) => t.type))].map((t) => (
                    <i
                      className={t}
                      key={t}
                    />
                  ))}
                  {tags.length > 0 && <small>{tags.length}</small>}
                </div>
              </button>
            );
          })}
        </div>
        <div className="work-calendar-legend">
          <span className="record">● 완료</span>
          <span className="open">● 진행 중·재방문</span>
          <span className="due">● 점검 예정</span>
          <span className="schedule">● 일정</span>
        </div>
      </section>
      {dayOpen && (
        <DayDialog
          onClose={() => setDayOpen(false)}
          title={dateLabel(selected)}
        >
          <div className="day-create-actions">
            <Link href={`/schedule?date=${selected}&new=1`}>＋ 일정 등록</Link>
            <Link href={`/work/new?date=${selected}`}>＋ 작업일지 작성</Link>
          </div>
          {!!daySchedules.length && (
            <section className="day-agenda-section">
              <h3>등록 일정 <span>{daySchedules.length}</span></h3>
              <div className="day-entry-list">
                {daySchedules.map((s) => (
                  <DayEntry key={"s" + s.id} href={`/schedule?date=${selected}`}
                    type={s.serviceType === "PM" ? "PM" : scheduleCategory(s)}
                    title={s.siteName || s.title}
                    description={s.siteName && s.title !== s.siteName ? s.title : undefined}
                    meta={scheduleTimeLabel(s.startAt, s.endAt)} />
                ))}
              </div>
            </section>
          )}
          {!!dayDue.length && (
            <section className="day-agenda-section day-due-section">
              <div className="day-section-heading">
                <h3>점검 기한 <span>{dayDue.length}</span></h3>
                <details className="day-due-help">
                  <summary aria-label="점검 기한 안내">?</summary>
                  <p>점검 주기와 완료 이력으로 계산한 날짜입니다. 방문 확정 일정은 아니며, 병원 상세에서 기준을 변경할 수 있습니다.</p>
                </details>
              </div>
              <div className="day-entry-list">
                {dayDue.map((d, i) => (
                  <DayEntry key={"d" + i} href={`/sites/${Number(d.siteId) || d.siteId}#inspection-plan`}
                    type={d.type} title={d.siteName} meta="점검 기준 확인" />
                ))}
              </div>
            </section>
          )}
          {!!dayRecords.length && (
            <section className="day-agenda-section">
              <h3>작업일지 <span>{dayRecords.length}</span></h3>
              <div className="day-entry-list">
                {dayRecords.map((r) => (
                  <DayEntry key={r.key} href={r.href}
                    date={r.date} completed={r.status === "COMPLETED"}
                    type={r.type === "PM" ? "PM" : serviceLabels[r.type] || "일반 업무"}
                    title={r.siteName} description={r.title !== r.siteName ? r.title : undefined}
                    meta={statusLabels[r.status] || r.status} />
                ))}
              </div>
            </section>
          )}
          {!dayRecords.length && !daySchedules.length && !dayDue.length && (
            <Empty>이 날짜에 등록된 일정과 작업일지가 없습니다.</Empty>
          )}
        </DayDialog>
      )}
      <div className="overview-folds">
        <details
          id="work-due"
          className="overview-fold"
        >
          <summary>
            <span>다가오는 점검</span>
            <small>45일 이내 · {upcomingDue.length}건</small>
          </summary>
          <div className="overview-fold-body">
            <p className="work-hint">
              PM 기본 2개월 · ACR 서류 12개월 · 정밀 36개월. 유형이 확인된 완료
              기록과 병원별 지정일로 계산합니다.
            </p>
            <div className="work-panel">
              {upcomingDue.map((d) => (
                <Link
                  className="work-due-row"
                  href={`/sites/${Number(d.siteId) || d.siteId}`}
                  key={d.siteId + d.type}
                >
                  <div>
                    <strong>{d.siteName}</strong>
                    <p>
                      {d.type} · {d.date}
                    </p>
                  </div>
                  <span className={`work-badge ${d.days < 0 ? "overdue" : ""}`}>
                    {d.days < 0 ? `${-d.days}일 지남` : `D-${d.days}`}
                  </span>
                </Link>
              ))}
              {!upcomingDue.length && (
                <Empty>
                  {loading
                    ? "예정일을 계산하는 중…"
                    : "45일 이내 예정된 점검이 없습니다."}
                </Empty>
              )}
            </div>
          </div>
        </details>
        <details
          id="work-preparation"
          className="overview-fold"
        >
          <summary>
            <span>방문 전 확인사항</span>
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
                {preparations.map((p) => (
                  <label
                    className={`work-preparation ${p.done ? "done" : ""}`}
                    key={p.id}
                  >
                    <input
                      type="checkbox"
                      checked={p.done}
                      onChange={(e) => void check(p.id, e.target.checked)}
                    />
                    <div>
                      <span>{p.siteName || "일반 업무"}</span>
                      <strong>{p.content}</strong>
                    </div>
                  </label>
                ))}
                {!preparations.length && (
                  <Empty>
                    작업일지에 방문 전 확인사항을 적으면 여기에 표시됩니다.
                  </Empty>
                )}
              </div>
            )}
          </div>
        </details>
        <details className="overview-fold">
          <summary>
            <span>최근 작업일지</span>
            <small>
              {records.isPending
                ? "불러오는 중…"
                : records.isError
                  ? "조회 실패"
                  : `${recentRecords.length}건`}
            </small>
          </summary>
          <div className="overview-fold-body">
            <Link
              className="work-back"
              href="/work"
            >
              작업일지 전체 보기 →
            </Link>
            {records.isError ? (
              <ErrorState
                error={records.error}
                retry={() => void records.refetch()}
              />
            ) : (
              <div className="work-panel">
                {recentRecords.map((r) => (
                  <Link
                    href={`/work/${r.id}`}
                    className="work-overview-record recent-work-record"
                    key={r.id}
                  >
                    <div className="recent-work-content">
                      <small>
                        {r.workDate} · {r.siteName || "일반 업무"}
                      </small>
                      <strong>{r.title || "제목 없는 작업일지"}</strong>
                      <div className="recent-work-meta">
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
                    </div>
                    <span
                      aria-hidden="true"
                      className="recent-work-arrow"
                    >
                      ›
                    </span>
                  </Link>
                ))}
                {!recentRecords.length && (
                  <Empty>
                    {records.isPending
                      ? "작업일지를 불러오는 중…"
                      : "아직 작성된 작업일지가 없습니다."}
                  </Empty>
                )}
              </div>
            )}
          </div>
        </details>
      </div>
    </main>
  );
}

function DayEntry({ href, type, title, description, meta, date, completed }: {
  href: string; type: string; title: string; description?: string; meta: string; date?: string; completed?: boolean;
}) {
  return <Link href={href} className="day-entry">
    <div className="day-entry-content">
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      <span className="day-type">{type}</span>
    </div>
    <div className="day-entry-aside">
      {date && <time dateTime={date}>{date.replaceAll("-", ". ")}</time>}
      <span className={`day-entry-status${completed ? " is-completed" : ""}`}>{meta}</span>
    </div>
  </Link>;
}

function DayDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="work-day-dialog"
      aria-labelledby="work-day-title"
      data-ptr-ignore
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const b = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < b.left ||
          e.clientX > b.right ||
          e.clientY < b.top ||
          e.clientY > b.bottom
        )
          onClose();
      }}
    >
      <header>
        <h2 id="work-day-title">{title}</h2>
        <button
          type="button"
          className="day-close"
          onClick={onClose}
          autoFocus
          aria-label="날짜 상세 닫기"
        >
          ✕
        </button>
      </header>
      <div className="work-day-body">{children}</div>
    </dialog>
  );
}
