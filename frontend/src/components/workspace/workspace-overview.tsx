"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { OfficeAssetsResponse } from "@/hooks/use-office-assets-query";
import {
  useWorkspace,
  usePlanning,
  dayString,
  dateLabel,
  errorText,
  serviceLabels,
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
            acrKind: d.acrKind,
            countsAsPm: d.countsAsPm,
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
    const pm = history.find((r) => r.type === "PM" || r.countsAsPm)?.date;
    const full = history.find(
      (r) => r.type === "ACR" && r.acrKind === "full",
    )?.date;
    const doc = history.find(
      (r) => r.type === "ACR" && ["full", "doc"].includes(r.acrKind || ""),
    )?.date;
    for (const [type, date] of [
      ["PM", nextDue(pm, plan?.pmOverride, plan?.pmIntervalMonths || 2)],
      ["ACR 정밀", nextDue(full, plan?.acrFullOverride, 36)],
      ["ACR 서류", nextDue(doc, plan?.acrDocOverride, 12)],
    ] as [string, string | null][]) {
      if (date && daysBetween(date, today) <= 45)
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
  const preparations = planning.data?.preparations || [];
  const pending = preparations.filter((p) => !p.done);
  const days = calendarDays(month);
  const dayRecords = summaries.filter((r) => r.date === selected);
  const daySchedules = (schedules.data || []).filter(
    (s) =>
      s.startAt.slice(0, 10) <= selected && s.endAt.slice(0, 10) >= selected,
  );
  const dayDue = due.filter((d) => d.date === selected);
  const loading =
    sites.isPending || records.isPending || old.some((q) => q.isPending);
  const partial = old.some((q) => q.isError);
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
    <main className="work-page">
      <PageHeading
        title="업무 현황"
        description="점검 예정일, 일정과 방문 준비물을 한눈에 확인하세요."
        action={
          <Link
            className="work-primary"
            href="/work/new"
          >
            ＋ 작업일지
          </Link>
        }
      />
      <div className="work-stats">
        <Link href="/hospitals">
          <span>관리 병원</span>
          <strong>
            {sites.data?.length ?? "…"}
            <small>곳</small>
          </strong>
        </Link>
        <a href="#work-due">
          <span>기한 지남</span>
          <strong>
            {loading ? "…" : due.filter((d) => d.days < 0).length}
            <small>건</small>
          </strong>
        </a>
        <Link href="/work?status=open">
          <span>미완료 작업</span>
          <strong>
            {loading
              ? "…"
              : summaries.filter((r) => r.status !== "COMPLETED").length}
            <small>건</small>
          </strong>
        </Link>
        <a href="#work-preparation">
          <span>챙길 것</span>
          <strong>
            {planning.isPending ? "…" : pending.length}
            <small>건</small>
          </strong>
        </a>
      </div>
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
        <Link href="/schedule">일정 관리 →</Link>
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
                title: s.siteName || s.title,
                type: "schedule",
              })),
              ...logs.map((r) => ({
                title: r.siteName,
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
                aria-pressed={selected === day}
                className={`work-calendar-day ${day.slice(0, 7) !== month ? "outside" : ""} ${selected === day ? "selected" : ""} ${today === day ? "today" : ""}`}
                onClick={() => setSelected(day)}
              >
                <span>{Number(day.slice(8))}</span>
                <div className="work-calendar-tags">
                  {tags.slice(0, 2).map((t, i) => (
                    <span
                      className={t.type}
                      key={i}
                    >
                      {t.title}
                    </span>
                  ))}
                  {tags.length > 2 && <small>+{tags.length - 2}</small>}
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
                </div>
              </button>
            );
          })}
        </div>
        <div className="work-calendar-legend">
          <span>● 작업일지</span>
          <span>● 진행 중·재방문</span>
          <span>● 점검 예정</span>
          <span>● 등록 일정</span>
        </div>
        <div className="work-calendar-agenda">
          <div className="work-section">
            <h3>{dateLabel(selected)}</h3>
            <Link href={`/work/new?date=${selected}`}>＋ 일지 작성</Link>
          </div>
          {dayRecords.map((r) => (
            <Link
              href={r.href}
              className="work-agenda-row"
              key={r.key}
            >
              <span className="work-badge">
                {serviceLabels[r.type] || "일반 업무"}
              </span>
              <div>
                <strong>{r.siteName}</strong>
                <p>{r.title}</p>
              </div>
            </Link>
          ))}
          {daySchedules.map((s) => (
            <Link
              href="/schedule"
              className="work-agenda-row"
              key={"s" + s.id}
            >
              <span className="work-badge">일정</span>
              <div>
                <strong>{s.title}</strong>
                <p>
                  {s.startAt.slice(11, 16)} · {s.siteName || s.authorName}
                </p>
              </div>
            </Link>
          ))}
          {dayDue.map((d, i) => (
            <Link
              href={`/sites/${Number(d.siteId) || d.siteId}`}
              className="work-agenda-row"
              key={"d" + i}
            >
              <span className="work-badge">예정</span>
              <div>
                <strong>{d.siteName}</strong>
                <p>{d.type}</p>
              </div>
            </Link>
          ))}
          {!dayRecords.length && !daySchedules.length && !dayDue.length && (
            <Empty>이 날짜에 등록된 일정과 작업일지가 없습니다.</Empty>
          )}
        </div>
      </section>
      <div className="work-two-columns">
        <section id="work-due">
          <div className="work-section">
            <h2>다가오는 점검 · 45일 이내</h2>
          </div>
          <p className="work-hint">
            PM 기본 2개월 · ACR 서류 12개월 · 정밀 36개월. 유형이 확인된 완료
            기록과 병원별 지정일로 계산합니다.
          </p>
          <div className="work-panel">
            {due.slice(0, 30).map((d) => (
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
            {!due.length && (
              <Empty>
                {loading
                  ? "예정일을 계산하는 중…"
                  : "45일 이내 예정된 점검이 없습니다."}
              </Empty>
            )}
          </div>
        </section>
        <section id="work-preparation">
          <div className="work-section">
            <h2>챙길 것 · 다음 방문 준비물</h2>
          </div>
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
                  작업일지에 다음 방문 준비물을 적으면 여기에 표시됩니다.
                </Empty>
              )}
            </div>
          )}
        </section>
      </div>
      <div className="work-section">
        <h2>최근 작업일지</h2>
        <Link href="/work">새 작업일지 전체 보기 →</Link>
      </div>
      <div className="work-panel">
        {summaries.slice(0, 8).map((r) => (
          <Link
            href={r.href}
            className="work-overview-record"
            key={r.key}
          >
            <div>
              <strong>{r.siteName}</strong>
              <p>{r.title}</p>
              <small>{r.date}</small>
            </div>
            <span className="work-badge">
              {serviceLabels[r.type] || "일반 업무"}
            </span>
          </Link>
        ))}
        {!summaries.length && (
          <Empty>
            {loading
              ? "작업일지를 불러오는 중…"
              : "아직 작성된 작업일지가 없습니다."}
          </Empty>
        )}
      </div>
    </main>
  );
}
