"use client";

import { newScheduleForm, scheduleEditForm, scheduleTimes, substantialScheduleChange, normalizeScheduleForm } from "./schedule-form";
import CircleLoader from "@/components/icons/circle-loader";
import PageLoader from "@/components/common/page-loader";

import Link from "@/components/common/app-link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useDashboardQuery } from "@/hooks/use-dashboard-query";
import { visibleDashboardSites } from "@/lib/dashboard-site-visibility";
import { orderHospitalDirectory } from "@/lib/hospital-directory-order";
import { useWorkDraft } from "./use-work-draft";
import { HospitalRegistration } from "./hospital-profile";
import HospitalPicker from "./hospital-picker";
import AuthoringHeader from "./authoring-header";
import AuthoringKind from "./authoring-kind";
import ActionMenu from "@/components/common/action-menu";
import { ChoiceGroup } from "./choice-group";
import { useAuth } from "@/components/provider/auth-provider";
import {
  useWorkspace,
  dayString,
  dateLabel,
  dateTime,
  errorText,
  serviceLabels,
  statusLabels,
  scheduleTimeLabel,
  scheduleCategory,
  personalScheduleLabels,
  type WorkRecord,
  type WorkSchedule,
} from "./workspace-data";
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="work-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div
      role="alert"
      className="work-error"
    >
      {errorText(error)} <button onClick={retry}>다시 시도</button>
    </div>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="work-empty">{children}</p>;
}
export function RecordList({ rows }: { rows: WorkRecord[] }) {
  return (
    <div className="work-panel">
      {rows.length ? (
        rows.map((r) => (
          <Link
            className="work-record"
            href={`/work/${r.id}`}
            key={r.id}
          >
            <div>
              <span
                className={`work-badge service-${r.serviceType?.toLowerCase() || "general"}`}
              >
                {r.kind === "GENERAL"
                  ? "일반 업무"
                  : serviceLabels[r.serviceType || ""] || "현장 서비스"}
              </span>
              <span
                className={`work-status ${r.status === "COMPLETED" ? "done" : ""}`}
              >
                {statusLabels[r.status]}
              </span>
            </div>
            <strong>{r.title}</strong>
            {r.siteName && <p>{r.siteName}</p>}
            <small>
              {r.workDate} ·{" "}
              {r.engineerName
                ? `담당 ${r.engineerName}`
                : `작성자 ${r.authorName}`}
            </small>
          </Link>
        ))
      ) : (
        <Empty>아직 작성한 업무가 없습니다.</Empty>
      )}
    </div>
  );
}
function ScheduleRows({ rows }: { rows: WorkSchedule[] }) {
  return (
    <div className="work-panel">
      {rows.length ? (
        rows.map((s) => (
          <Link
            href="/schedule"
            className="work-task"
            key={s.id}
          >
            <span className="work-time">
              {scheduleTimeLabel(s.startAt, s.endAt)}
            </span>
            <div>
              <span className="work-badge">{scheduleCategory(s)}</span>
              <strong>{s.title}</strong>
              <p>
                {s.siteName ? `${s.siteName} · ` : ""}
                {s.authorName}
              </p>
            </div>
            <span className="work-chevron">›</span>
          </Link>
        ))
      ) : (
        <Empty>등록된 일정이 없습니다.</Empty>
      )}
    </div>
  );
}
export function TodayPage() {
  const { session } = useAuth();
  const { records, schedules } = useWorkspace();
  const today = dayString();
  const rows = (schedules.data || []).filter(
    (s) => s.startAt.slice(0, 10) <= today && s.endAt.slice(0, 10) >= today,
  );
  const next = rows.find(
    (s) => new Date(dateTime(s.endAt) + "+09:00").getTime() >= Date.now(),
  );
  if (records.isPending || schedules.isPending) {
    return <PageLoader as="main" />;
  }
  return (
    <main className="work-page">
      <div className="work-date">{dateLabel(today)}</div>
      <PageHeading
        title={`${session?.name || ""}님, 오늘의 업무입니다`}
        description="오늘의 일정과 팀의 업무를 확인하세요."
        action={
          <Link
            className="work-secondary hospital-register desktop-work-action"
            href="/work/new"
          >
            ＋ 업무기록
          </Link>
        }
      />
      <div className="work-overview">
        <section className="work-next">
          <span>다음 일정</span>
          <h2>
            {next?.siteName || next?.title || "등록된 다음 일정이 없습니다"}
          </h2>
          <p>
            {next
              ? `${dateTime(next.startAt).slice(11, 16)} · ${next.title}`
              : "방문·점검 일정을 추가하고 팀과 공유하세요."}
          </p>
          <div>
            {next?.siteId ? (
              <Link href={`/sites/${Number(next.siteId) || next.siteId}`}>
                병원 확인 →
              </Link>
            ) : (
              <Link href="/schedule">일정 확인 →</Link>
            )}
            <Link
              href={
                next?.siteId ? `/work/new?site=${next.siteId}` : "/work/new"
              }
            >
              업무기록 시작
            </Link>
          </div>
        </section>
        <section className="work-notice">
          <strong>병원 상태를 확인하세요</strong>
          <p>모니터링에서 최신 측정값과 확인할 알림을 조회합니다.</p>
          <Link href="/">모니터링 열기 →</Link>
        </section>
      </div>
      <div className="work-two-columns">
        <section>
          <div className="work-section">
            <h2>
              오늘의 일정 <span>{rows.length}</span>
            </h2>
            <Link href="/schedule">전체 보기 →</Link>
          </div>
          {schedules.error ? (
            <ErrorState
              error={schedules.error}
              retry={() => void schedules.refetch()}
            />
          ) : schedules.isPending ? (
            <p><CircleLoader size="xs" /></p>
          ) : (
            <ScheduleRows rows={rows} />
          )}
        </section>
        <section>
          <div className="work-section">
            <h2>팀의 최근 업무</h2>
            <Link href="/work">전체 보기 →</Link>
          </div>
          {records.error ? (
            <ErrorState
              error={records.error}
              retry={() => void records.refetch()}
            />
          ) : records.isPending ? (
            <p><CircleLoader size="xs" /></p>
          ) : (
            <RecordList rows={(records.data || []).slice(0, 3)} />
          )}
        </section>
      </div>
      <Link
        href="/work/new"
        className="work-secondary hospital-register work-floating"
      >
        ＋ 업무기록
      </Link>
    </main>
  );
}
export function HospitalsPage() {
  const { session } = useAuth();
  const sites = useQuery({
    queryKey: ["workspace-hospital-directory", session?.id],
    queryFn: () =>
      apiFetch<
        {
          siteDb: string;
          name: string | null;
          address: string;
          equipment: string[];
          monitoringConnected: boolean;
          hospitalId: number | null;
        }[]
      >("/workspace/hospitals"),
    enabled: !!session,
  });
  const dashboard = useDashboardQuery();
  const hiddenSites = useQuery({
    queryKey: ["dashboard-hidden-sites", session?.id],
    queryFn: () => apiFetch<string[]>("/dashboard/hidden-sites"), enabled: !!session,
  });
  const monitoringIds = new Set(visibleDashboardSites(dashboard.data?.rows || [], hiddenSites.data || []).map(s => s.siteDb));
  const [search, setSearch] = useState("");
  const rows = orderHospitalDirectory(sites.data || [], monitoringIds).filter(s =>
    `${s.name || s.siteDb} ${s.address} ${s.equipment.join(" ")}`.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <main className="work-page work-hospitals">
      <div className="hospital-directory-heading">
        <PageHeading
          title="병원 · 장비"
          description="병원별 모니터링, 장비와 서비스 이력을 확인하세요."
        />
      <input
        className="work-input work-search"
        placeholder="병원명 · 장비 · 주소 검색"
        aria-label="병원명 · 장비 · 주소 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
        <HospitalRegistration />
      </div>
      <div className="hospital-directory-tools">
      <div className="hospital-directory-meta"><span>병원 {rows.length}곳</span><span>모니터링 우선 · 이름순</span></div>
      </div>
      {sites.error ? (
        <ErrorState
          error={sites.error}
          retry={() => void sites.refetch()}
        />
      ) : sites.isPending ? (
        <PageLoader />
      ) : (
        <div className="work-hospital-grid">
          {rows.map((s) => (
              <Link
                className="work-hospital"
                key={s.siteDb}
                href={`/sites/${Number(s.siteDb) || s.siteDb}`}
              >
                <div>
                  <div className="hospital-directory-title"><strong>{s.name || s.siteDb}</strong>
                  <span className={`hospital-list-connection ${monitoringIds.has(s.siteDb) ? "is-monitoring" : ""}`}>
                    {monitoringIds.has(s.siteDb) ? "모니터링" : "서비스 관리"}
                  </span></div>
                  <p className="hospital-directory-equipment">
                    {s.equipment.join(" / ") || "장비 정보 미등록"}
                  </p>
                  <p className="hospital-directory-address">
                    {s.address || "주소 미등록"}
                  </p>
                </div>
                <span className="work-chevron">›</span>
              </Link>
            ))}
          {!sites.data?.length && <Empty>접근 가능한 병원이 없습니다.</Empty>}
          {!!sites.data?.length &&
            !sites.data.some((s) =>
              `${s.name || s.siteDb} ${s.address} ${s.equipment.join(" ")}`
                .toLowerCase()
                .includes(search.trim().toLowerCase()),
            ) && <Empty>검색 결과가 없습니다.</Empty>}
        </div>
      )}
    </main>
  );
}
export function WorkPage({ onlyOpen = false }: { onlyOpen?: boolean }) {
  const { session } = useAuth();
  const [kind, setKind] = useState("ALL"),
    [search, setSearch] = useState("");
  const [openOnly, setOpenOnly] = useState(onlyOpen),
    [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [query, kind, openOnly]);
  const params = new URLSearchParams({
    page: String(page),
    size: "20",
    query,
    kind,
    openOnly: String(openOnly),
  });
  const records = useQuery({
    queryKey: ["workspace-records", "search", session?.id, params.toString()],
    queryFn: () =>
      apiFetch<{ records: WorkRecord[]; total: number }>(
        `/workspace/records/search?${params}`,
      ),
    enabled: !!session,
  });
  const rows = records.data?.records || [];
  return (
    <main className="work-page">
      <PageHeading
        title="업무기록"
        description="현장 서비스와 일반 업무를 함께 기록하세요."
        action={
          <Link
            href="/work/new"
            className="work-secondary hospital-register"
          >
            ＋ 작성
          </Link>
        }
      />
      <div className="work-pills">
        {[
          ["ALL", "전체"],
          ["FIELD", "현장 서비스"],
          ["GENERAL", "일반 업무"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={kind === id ? "selected" : ""}
            onClick={() => setKind(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="work-check mb-4">
        <input
          type="checkbox"
          checked={openOnly}
          onChange={(e) => setOpenOnly(e.target.checked)}
        />
        미완료 작업만 보기
      </label>
      <input
        className="work-input work-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="병원 · 제목 · 내용 검색"
        aria-label="업무 검색"
      />
      {records.error ? (
        <ErrorState
          error={records.error}
          retry={() => void records.refetch()}
        />
      ) : records.isPending ? (
        <PageLoader />
      ) : (
        <>
          <RecordList rows={rows} />
          <div className="work-form-actions mt-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              이전
            </button>
            <span className="text-sm">
              {page} / {Math.max(1, Math.ceil((records.data?.total || 0) / 20))}{" "}
              · {records.data?.total || 0}건
            </span>
            <button
              type="button"
              disabled={page * 20 >= (records.data?.total || 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              다음
            </button>
          </div>
        </>
      )}
    </main>
  );
}
export function SchedulePage() {
  const router = useRouter();
  const search = useSearchParams();
  const requestedEdit = search.get("edit");
  const openedEdit = useRef<string | null>(null);
  const initialDate = /^\d{4}-\d{2}-\d{2}$/.test(search.get("date") || "")
    ? search.get("date")!
    : dayString();
  const { session, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState(initialDate),
    [open, setOpen] = useState(search.get("new") === "1"),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const { sites, schedules } = useWorkspace({
    records: false,
    scheduleFrom: selected,
    scheduleTo: selected,
  });
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(
    null,
  );
  const [form, setForm] = useState(() => newScheduleForm(initialDate));
  const draft = useWorkDraft({
    storageKey: `mreyes-schedule-draft:${session?.id}`,
    value: { form, editingSchedule },
    shouldKeep: value => substantialScheduleChange(normalizeScheduleForm(value.form, initialDate), value.editingSchedule),
    warnOnLeave: substantialScheduleChange(form, editingSchedule),
    enabled: !!session && open,
    onRestore: (d) => {
      openedEdit.current = requestedEdit;
      setForm(normalizeScheduleForm(d.form, initialDate));
      setEditingSchedule(d.editingSchedule);
      setOpen(true);
    },
    restoreNotice: "일정 내용을 이 기기의 임시저장에서 복구했습니다.",
  });
  useEffect(() => {
    if (!requestedEdit || !/^\d+$/.test(requestedEdit) || openedEdit.current === requestedEdit || schedules.isPending || schedules.error || !session || draft.pending) return;
    const schedule = schedules.data?.find(s => String(s.id) === requestedEdit);
    if (!schedule) {
      openedEdit.current = requestedEdit;
      setError("이 날짜에서 수정할 일정을 찾을 수 없습니다.");
      return;
    }
    if (schedule.authorId !== session.id && !isAdmin) {
      openedEdit.current = requestedEdit;
      setError("작성한 일정만 수정할 수 있습니다.");
      return;
    }
    openedEdit.current = requestedEdit;
    if (!draft.confirmLeave()) return;
    draft.resume();
    setEditingSchedule(schedule);
    setForm(scheduleEditForm(schedule));
    setOpen(true);
  }, [requestedEdit, schedules.isPending, schedules.error, schedules.data, session, isAdmin, draft]);
  const rows = (schedules.data || [])
    .filter(
      (s) =>
        s.startAt.slice(0, 10) <= selected && s.endAt.slice(0, 10) >= selected,
    )
    .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.id - b.id);
  useEffect(() => {
    const hash = window.location.hash;
    if (/^#schedule-\d+$/.test(hash))
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ block: "center" });
  }, [schedules.data]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const times = scheduleTimes(form);
      if (times.endAt < times.startAt) throw new Error("종료 날짜·시간은 시작 이후로 설정해주세요.");
      await apiFetch(
        editingSchedule
          ? `/workspace/schedules/${editingSchedule.id}`
          : "/workspace/schedules",
        {
          method: editingSchedule ? "PUT" : "POST",
          body: JSON.stringify({
            ...form,
            ...scheduleTimes(form),
            revision: editingSchedule?.revision,
            personalKind:
              form.targetKind === "GENERAL" ? form.personalKind : null,
            serviceType:
              form.targetKind === "HOSPITAL" ? form.serviceType : null,
          }),
        },
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["workspace-schedules"] }),
        qc.invalidateQueries({ queryKey: ["workspace-records"] }),
      ]);
      draft.clear();
      setSelected(form.date);
      setOpen(false);
      setEditingSchedule(null);
      setForm({ ...form, title: "", body: "" });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  async function remove(id: number) {
    if (!window.confirm("이 일정을 삭제할까요?")) return;
    try {
      await apiFetch(`/workspace/schedules/${id}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["workspace-schedules"] });
    } catch (e) {
      setError(errorText(e));
    }
  }
  return (
    <main className={`work-page schedule-page${open ? " schedule-editing" : ""}`}>
      {open ? <AuthoringHeader title={editingSchedule ? "일정 수정" : "일정 등록"} disabled={saving} onBack={()=>draft.back(()=>router.replace("/overview"))} /> : <>
      <Link
        className="work-back"
        href="/overview"
      >
        ← 업무현황 달력
      </Link>
      <PageHeading
        title="일정"
        description="방문·점검과 팀의 일정을 함께 확인하세요."
      />
      </>}
      {open && !editingSchedule && <AuthoringKind value="schedule" date={form.date} disabled={saving} confirmLeave={draft.confirmLeave} navigate={draft.replace} />}
      {!open && <label className="work-date-picker">
        일정 날짜
        <input
          className="work-input"
          type="date"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        />
      </label>}
      {error && (
        <p
          role="alert"
          className="work-error"
        >
          {error}
        </p>
      )}
      {draft.pending && (
        <div
          className="work-panel work-draft-notice"
          role="status"
        >
          <p>이 기기에 저장하지 않은 일정이 있습니다.</p>
          <div className="work-form-actions">
            <button
              type="button"
              onClick={draft.discard}
            >
              버리기
            </button>
            <button
              type="button"
              className="work-primary"
              onClick={draft.restore}
            >
              복구
            </button>
          </div>
        </div>
      )}
      {open && draft.notice && (
        <p
          className="work-hint"
          role="status"
        >
          {draft.notice}
        </p>
      )}
      {open && (
        <form
          className="work-form work-panel"
          aria-label={editingSchedule ? "일정 수정" : "일정 작성"}
          onSubmit={save}
        >
          <label>
            제목
            <input
              className="work-input"
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <ChoiceGroup
            legend="대상"
            value={form.targetKind}
            options={[
              ["HOSPITAL", "병원"],
              ["GENERAL", "병원 외 일정"],
            ]}
            onChange={(targetKind) =>
              setForm({ ...form, targetKind, siteId: "" })
            }
          />
          {form.targetKind === "GENERAL" ? (
            <ChoiceGroup
              legend="분류"
              value={form.personalKind}
              options={Object.entries(personalScheduleLabels)}
              onChange={(personalKind) => setForm({ ...form, personalKind })}
            />
          ) : (
            <>
              <ChoiceGroup
                legend="서비스 유형"
                value={form.serviceType}
                options={Object.entries(serviceLabels)}
                onChange={(serviceType) => setForm({ ...form, serviceType })}
              />
              <div className="work-picker-field">
                병원 *
                <HospitalPicker
                  sites={sites.data || []}
                  value={form.siteId}
                  onChange={(siteId) => setForm({ ...form, siteId })}
                />
              </div>
            </>
          )}
          <div className="schedule-date-fields">
            <label>일정 날짜<input className="work-input" required type="date" value={form.date} onChange={event => {
              const date = event.target.value;
              setForm({...form,date,endDate:form.endDate === form.date || form.endDate < date ? date : form.endDate});
            }} /></label>

          </div>
          <details className="schedule-date-range" open={form.endDate > form.date || undefined}>
            <summary>{form.endDate > form.date ? `여러 날 일정 · ${form.date} ~ ${form.endDate}` : "＋ 여러 날 일정으로 설정"}</summary>
            <label>종료 날짜<input className="work-input" type="date" min={form.date} value={form.endDate} onChange={event=>setForm({...form,endDate:event.target.value})} /></label>
            <button type="button" className="work-text-button" onClick={event=>{setForm({...form,endDate:form.date});event.currentTarget.closest("details")?.removeAttribute("open");}}>하루 일정으로</button>
          </details>
          <label className="work-check"><input type="checkbox" checked={form.allDay} onChange={event=>setForm({...form,allDay:event.target.checked,startTime:form.startTime === "00:00" ? "09:00" : form.startTime})} />종일</label>
          {!form.allDay && <div className="work-form-row">
            <label>시작 시간<input className="work-input" required type="time" value={form.startTime} onChange={event=>setForm({...form,startTime:event.target.value})} /></label>
            <label>종료 시간 <small>{form.endDate > form.date ? "(여러 날 일정)" : "(선택)"}</small><input className="work-input" required={form.endDate > form.date} type="time" value={form.endTime} onChange={event=>setForm({...form,endTime:event.target.value})} /></label>
          </div>}
          {!form.allDay && <p className="work-hint">종료 시간을 비워두면 시작 시간만 표시합니다.</p>}
          <label>
            내용
            <textarea
              className="work-input"
              maxLength={10000}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </label>
          <div className="work-form-actions">
            <button
              type="button"
              onClick={() => {
                if (draft.confirmLeave()) {
                  draft.pause();
                  setOpen(false);
                }
              }}
            >
              취소
            </button>
            <button
              disabled={saving || !!draft.pending}
              className="work-primary"
            >
              {saving ? <CircleLoader size="xs" inline /> : "일정 저장"}
            </button>
          </div>
        </form>
      )}
      {!open && <div className="work-section">
        <h2>{dateLabel(selected)}</h2>
        <span>{rows.length}건</span>
      </div>}
      {schedules.error ? (
        <ErrorState
          error={schedules.error}
          retry={() => void schedules.refetch()}
        />
      ) : (
        <div className="schedule-list">
          {rows.map((s) => (
            <article
              className="schedule-card"
              id={`schedule-${s.id}`}
              key={s.id}
            >
              <div className="schedule-card-heading">
                <div className="schedule-card-title">
                  <span className="schedule-time">
                    {scheduleTimeLabel(s.startAt, s.endAt)}
                  </span>
                  <span
                    className={`schedule-category category-${s.personalKind || s.serviceType?.toLowerCase() || "unknown"}`}
                  >
                    {scheduleCategory(s)}
                  </span>
                  <h3>{s.title}</h3>
                </div>
                <ActionMenu
                  label={`${s.title} 일정 메뉴`}
                  items={[
                    {
                      label: "업무기록 작성",
                      onSelect: () => router.push(`/work/new?schedule=${s.id}`),
                    },
                    ...(s.authorId === session?.id || isAdmin
                      ? [
                          {
                            label: "수정",
                            onSelect: () => {
                              if (draft.pending || !draft.confirmLeave())
                                return;
                              draft.resume();
                              setEditingSchedule(s);
                              setForm(scheduleEditForm(s));
                              setOpen(true);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            },
                          },
                          {
                            label: "삭제",
                            danger: true,
                            onSelect: () => void remove(s.id),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
              <div className="work-section">
                {(s.linkedRecords || []).map((r) => (
                  <Link
                    className="work-back"
                    key={r.id}
                    href={`/work/${r.id}`}
                  >
                    {r.workDate} · {r.title} →
                  </Link>
                ))}
              </div>
              <dl className="schedule-card-meta">
                <div>
                  <dt>대상</dt>
                  <dd>
                    {s.targetKind === "GENERAL" || s.personalKind
                      ? "병원 외 일정"
                      : s.targetKind === "HOSPITAL" || s.siteId
                        ? "병원"
                        : "미등록"}
                  </dd>
                </div>
                {s.siteName && (
                  <div>
                    <dt>병원</dt>
                    <dd>
                      {s.siteId ? (
                        <Link
                          className="work-back"
                          href={`/sites/${Number(s.siteId) || s.siteId}`}
                        >
                          {s.siteName} →
                        </Link>
                      ) : (
                        s.siteName
                      )}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>등록자</dt>
                  <dd>{s.authorName || "정보 없음"}</dd>
                </div>
              </dl>
              {s.body?.trim() && s.body.trim() !== s.title.trim() && (
                <div className="schedule-card-note">
                  <span>내용</span>
                  <p className="work-prewrap">{s.body}</p>
                </div>
              )}
            </article>
          ))}
          {!rows.length && (
            schedules.isPending ? <PageLoader /> : <Empty>등록된 일정이 없습니다.</Empty>
          )}
        </div>
      )}
    </main>
  );
}
