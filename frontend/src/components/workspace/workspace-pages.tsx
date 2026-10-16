"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import HospitalPicker from "./hospital-picker";
import { useAuth } from "@/components/provider/auth-provider";
import {
  useWorkspace,
  dayString,
  dateLabel,
  dateTime,
  errorText,
  serviceLabels,
  statusLabels,
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
              <span className="work-badge">
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
              {r.workDate} · {r.authorName}
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
              {dateTime(s.startAt).slice(11, 16)}
            </span>
            <div>
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
  return (
    <main className="work-page">
      <div className="work-date">{dateLabel(today)}</div>
      <PageHeading
        title={`${session?.name || ""}님, 오늘의 업무입니다`}
        description="오늘의 일정과 팀의 업무를 확인하세요."
        action={
          <Link
            className="work-primary desktop-work-action"
            href="/work/new"
          >
            ＋ 업무 기록
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
              업무 기록 시작
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
            <p>일정을 불러오는 중…</p>
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
            <p>업무를 불러오는 중…</p>
          ) : (
            <RecordList rows={(records.data || []).slice(0, 3)} />
          )}
        </section>
      </div>
      <Link
        href="/work/new"
        className="work-primary work-floating"
      >
        ＋ 업무 기록
      </Link>
    </main>
  );
}
export function HospitalsPage() {
  const { sites } = useWorkspace();
  const [search, setSearch] = useState("");
  return (
    <main className="work-page">
      <PageHeading
        title="병원 · 장비"
        description="병원별 모니터링, 장비와 서비스 이력을 확인하세요."
      />
      <input
        className="work-input work-search"
        placeholder="병원명 검색"
        aria-label="병원 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {sites.error ? (
        <ErrorState
          error={sites.error}
          retry={() => void sites.refetch()}
        />
      ) : sites.isPending ? (
        <p>병원을 불러오는 중…</p>
      ) : (
        <div className="work-hospitals">
          {(sites.data || [])
            .filter((s) => (s.name || s.siteDb).includes(search))
            .map((s) => (
              <Link
                className="work-hospital"
                key={s.siteDb}
                href={`/sites/${Number(s.siteDb) || s.siteDb}`}
              >
                <span className="work-hospital-icon">＋</span>
                <div>
                  <strong>{s.name || s.siteDb}</strong>
                  <p>장비 · 모니터링 · 서비스 이력</p>
                </div>
                <span className="work-chevron">›</span>
              </Link>
            ))}
          {!sites.data?.length && <Empty>접근 가능한 병원이 없습니다.</Empty>}
        </div>
      )}
    </main>
  );
}
export function WorkPage({ onlyOpen = false }: { onlyOpen?: boolean }) {
  const { records } = useWorkspace();
  const [kind, setKind] = useState("ALL"),
    [search, setSearch] = useState("");
  const [openOnly, setOpenOnly] = useState(onlyOpen);
  const rows = (records.data || []).filter(
    (r) =>
      (!openOnly || r.status !== "COMPLETED") &&
      (kind === "ALL" || r.kind === kind) &&
      `${r.title} ${r.siteName || ""} ${r.body}`.includes(search),
  );
  return (
    <main className="work-page">
      <PageHeading
        title="업무 기록"
        description="현장 서비스와 일반 업무를 함께 기록하세요."
        action={
          <Link
            href="/work/new"
            className="work-primary"
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
        <p>업무를 불러오는 중…</p>
      ) : (
        <RecordList rows={rows} />
      )}
    </main>
  );
}
export function SchedulePage() {
  const { session, isAdmin } = useAuth();
  const { sites, schedules } = useWorkspace();
  const qc = useQueryClient();
  const [selected, setSelected] = useState(dayString()),
    [scope, setScope] = useState("TEAM"),
    [open, setOpen] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    siteId: "",
    body: "",
    startAt: dayString() + "T09:00",
    endAt: dayString() + "T10:00",
  });
  const rows = (schedules.data || []).filter(
    (s) =>
      s.startAt.slice(0, 10) <= selected &&
      s.endAt.slice(0, 10) >= selected &&
      (scope === "TEAM" || s.authorId === session?.id),
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/workspace/schedules", {
        method: "POST",
        body: JSON.stringify(form),
      });
      await qc.invalidateQueries({ queryKey: ["workspace-schedules"] });
      setSelected(form.startAt.slice(0, 10));
      setOpen(false);
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
    <main className="work-page">
      <PageHeading
        title="일정"
        description="방문·점검과 팀의 일정을 함께 확인하세요."
        action={
          <button
            className="work-primary"
            onClick={() => {
              setOpen(!open);
              setError("");
              setForm({
                ...form,
                startAt: selected + "T09:00",
                endAt: selected + "T10:00",
              });
            }}
          >
            ＋ 일정
          </button>
        }
      />
      <div className="work-pills">
        <button
          className={scope === "TEAM" ? "selected" : ""}
          onClick={() => setScope("TEAM")}
        >
          팀 일정
        </button>
        <button
          className={scope === "ME" ? "selected" : ""}
          onClick={() => setScope("ME")}
        >
          내 일정
        </button>
      </div>
      <label className="work-date-picker">
        조회 날짜
        <input
          className="work-input"
          type="date"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        />
      </label>
      {error && (
        <p
          role="alert"
          className="work-error"
        >
          {error}
        </p>
      )}
      {open && (
        <form
          className="work-form work-panel"
          onSubmit={save}
        >
          <h2>일정 작성</h2>
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
          <label>
            병원 (선택)
            <HospitalPicker
              sites={sites.data || []}
              value={form.siteId}
              onChange={(siteId) => setForm({ ...form, siteId })}
              optional
            />
          </label>
          <div className="work-form-row">
            <label>
              시작
              <input
                className="work-input"
                required
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </label>
            <label>
              종료
              <input
                className="work-input"
                required
                type="datetime-local"
                min={form.startAt}
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              />
            </label>
          </div>
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
              onClick={() => setOpen(false)}
            >
              취소
            </button>
            <button
              disabled={saving}
              className="work-primary"
            >
              {saving ? "저장 중…" : "일정 저장"}
            </button>
          </div>
        </form>
      )}
      <div className="work-section">
        <h2>{dateLabel(selected)}</h2>
        <span>{rows.length}건</span>
      </div>
      {schedules.error ? (
        <ErrorState
          error={schedules.error}
          retry={() => void schedules.refetch()}
        />
      ) : (
        <div className="work-panel">
          {rows.map((s) => (
            <div
              className="work-schedule"
              key={s.id}
            >
              <div className="work-time">
                {dateTime(s.startAt).slice(11, 16)}–
                {dateTime(s.endAt).slice(11, 16)}
              </div>
              <strong>{s.title}</strong>
              <p>
                {s.siteName} · {s.authorName}
              </p>
              {s.body && <p className="work-prewrap">{s.body}</p>}
              {(s.authorId === session?.id || isAdmin) && (
                <button
                  className="work-text-button"
                  onClick={() => void remove(s.id)}
                >
                  삭제
                </button>
              )}
            </div>
          ))}
          {!rows.length && (
            <Empty>
              {schedules.isPending
                ? "일정을 불러오는 중…"
                : "등록된 일정이 없습니다."}
            </Empty>
          )}
        </div>
      )}
    </main>
  );
}
