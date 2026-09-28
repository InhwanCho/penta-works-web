"use client";

import { ArrowBackIconMini } from "@/components/icons/arrow-back-icon";
import type { AlertEventSummary, AlertThreshold, SiteAlertSettings } from "@/lib/api";
import { METRICS } from "@/lib/metrics";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

const METRIC_DESCRIPTION = new Map(METRICS.map((metric) => [metric.key, metric.description]));

export default function BaselinesClient({
  entries,
  loadFailed = false,
  canEdit = false,
  onSave,
  events,
  eventsLoading = false,
  eventsFailed = false,
  onAcknowledge,
}: {
  entries: SiteAlertSettings[];
  loadFailed?: boolean;
  canEdit?: boolean;
  onSave: (entry: SiteAlertSettings) => Promise<SiteAlertSettings>;
  events: AlertEventSummary[];
  eventsLoading?: boolean;
  eventsFailed?: boolean;
  onAcknowledge: (eventId: number) => Promise<AlertEventSummary>;
}) {
  const [view, setView] = useState<"thresholds" | "events">("thresholds");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SiteAlertSettings | null>(null);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return entries;
    return entries.filter((entry) =>
      entry.siteid.toLowerCase().includes(keyword) || (entry.name ?? "").toLowerCase().includes(keyword),
    );
  }, [entries, query]);
  const activeCount = useMemo(
    () => entries.reduce((count, entry) => count + entry.thresholds.filter((threshold) => threshold.active).length, 0),
    [entries],
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <div className="mb-2 sm:mb-3">
        <Link href="/" className="text-text-secondary hover:bg-background-tertiary hover:text-text-major dark:text-text-dark-primary/70 dark:hover:bg-background-dark-secondary dark:hover:text-text-dark-primary inline-flex min-h-10 items-center gap-x-1.5 rounded-lg px-2 text-sm font-bold transition-colors">
          <ArrowBackIconMini className="h-4 w-4" /> 대시보드
        </Link>
      </div>

      <header className="mb-5 overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#123b5d,#176083)] px-5 py-6 text-white shadow-[0_16px_45px_rgba(17,65,94,0.16)] sm:px-7">
        <p className="mb-1 text-xs font-bold tracking-[0.16em] text-sky-200 uppercase">Alert settings</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">병원별 기준값</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium text-white/70">
          11개 측정항목의 허용범위와 알림 사용 여부를 관리합니다. 같은 범위가 대시보드 이상 표시에 적용됩니다.
        </p>
      </header>

      <div className="mb-5 inline-flex rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm dark:border-white/8 dark:bg-background-dark-card">
        <ViewTab active={view === "thresholds"} onClick={() => setView("thresholds")}>기준값</ViewTab>
        <ViewTab active={view === "events"} onClick={() => setView("events")} badge={events.filter((event) => event.eventType !== "RECOVERY" && !event.recoveredAt).length}>알림 이력</ViewTab>
      </div>

      {view === "thresholds" ? <>
      {loadFailed && <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">기준값을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>}

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:gap-3">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="병원명 또는 사업장 코드 검색" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition placeholder:text-text-secondary/70 focus:border-sky-400 dark:border-white/8 dark:bg-background-dark-card" />
        <StatChip label="사업장" value={entries.length} />
        <StatChip label="사용 중 기준" value={activeCount} accent />
      </div>

      {filtered.length === 0 ? <EmptyState /> : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((entry) => {
            const pressure = entry.thresholds.find((threshold) => threshold.key === "hepres");
            const level = entry.thresholds.find((threshold) => threshold.key === "heleve");
            const enabled = entry.thresholds.filter((threshold) => threshold.active).length;
            return (
              <article key={entry.siteid} className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_24px_rgba(22,58,82,0.06)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_12px_34px_rgba(22,58,82,0.1)] dark:border-white/8 dark:bg-background-dark-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h2 className="truncate font-extrabold">{entry.name ?? "이름 없는 사업장"}</h2><p className="text-text-secondary mt-0.5 text-xs">사업장 {entry.siteid}</p></div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${enabled > 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-white/55"}`}>{enabled}/11 사용</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <RangePreview label="He Pressure" threshold={pressure} />
                  <RangePreview label="He Level" threshold={level} />
                </div>
                {!entry.configured && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">아직 저장된 기준값이 없습니다.</p>}
                <button type="button" onClick={() => setSelected(entry)} className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-sky-700 transition hover:border-sky-200 hover:bg-sky-50 dark:border-white/10 dark:text-sky-200 dark:hover:bg-sky-950/30">{canEdit ? "전체 기준값 관리" : "전체 기준값 보기"}</button>
              </article>
            );
          })}
        </section>
      )}
      </> : <AlertEventsPanel events={events} loading={eventsLoading} failed={eventsFailed} onAcknowledge={onAcknowledge} />}

      {selected && <SiteThresholdEditor entry={selected} canEdit={canEdit} onClose={() => setSelected(null)} onSave={async (entry) => { const saved = await onSave(entry); setSelected(saved); return saved; }} />}
    </main>
  );
}

function ViewTab({ active, onClick, badge, children }: { active: boolean; onClick: () => void; badge?: number; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${active ? "bg-[#174d70] text-white shadow-sm dark:bg-sky-700" : "text-slate-500 hover:bg-slate-100 dark:text-white/55 dark:hover:bg-white/5"}`}>{children}{badge ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/15 text-white" : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"}`}>{badge}</span> : null}</button>;
}

function AlertEventsPanel({ events, loading, failed, onAcknowledge }: { events: AlertEventSummary[]; loading: boolean; failed: boolean; onAcknowledge: (eventId: number) => Promise<AlertEventSummary> }) {
  const [filter, setFilter] = useState<"all" | "open" | "recovered">("all");
  const [acknowledging, setAcknowledging] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filtered = events.filter((event) => filter === "all" || (filter === "open" ? event.eventType !== "RECOVERY" && !event.recoveredAt : event.eventType === "RECOVERY" || !!event.recoveredAt));
  const openCount = events.filter((event) => event.eventType !== "RECOVERY" && !event.recoveredAt).length;

  async function acknowledge(eventId: number) {
    setAcknowledging(eventId); setError(null);
    try { await onAcknowledge(eventId); }
    catch (ackError) { setError(ackError instanceof Error ? ackError.message : "알림을 확인 처리하지 못했습니다."); }
    finally { setAcknowledging(null); }
  }

  if (loading) return <div className="text-text-secondary py-16 text-center text-sm">알림 이력을 불러오는 중…</div>;
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-extrabold">발생·복구 이력</h2><p className="text-text-secondary mt-1 text-sm">동일한 이상 상태는 한 번만 기록되고 정상 복귀 시 복구 이력이 추가됩니다.</p></div>
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-white/5">{(["all", "open", "recovered"] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${filter === value ? "bg-white text-sky-700 shadow-sm dark:bg-sky-800 dark:text-white" : "text-slate-500 dark:text-white/55"}`}>{value === "all" ? "전체" : value === "open" ? `진행 중 ${openCount}` : "복구"}</button>)}</div>
      </div>
      {failed && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">알림 이력을 불러오지 못했습니다.</p>}
      {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {filtered.length === 0 ? <EmptyState /> : <div className="space-y-2">{filtered.map((event) => <AlertEventRow key={event.id} event={event} acknowledging={acknowledging === event.id} onAcknowledge={() => acknowledge(event.id)} />)}</div>}
    </section>
  );
}

function AlertEventRow({ event, acknowledging, onAcknowledge }: { event: AlertEventSummary; acknowledging: boolean; onAcknowledge: () => void }) {
  const recovered = event.eventType === "RECOVERY" || !!event.recoveredAt;
  const metric = METRICS.find((item) => item.key === event.metricKey);
  return <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_5px_20px_rgba(22,58,82,0.05)] dark:border-white/8 dark:bg-background-dark-card">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3"><EventBadge type={event.eventType} /><div className="min-w-0"><h3 className="font-extrabold">{event.siteName ?? event.siteId} · {metric?.label ?? event.metricKey}</h3><p className="text-text-secondary mt-1 text-sm">{event.message}</p><p className="text-text-secondary mt-1 text-xs tabular-nums">측정 {formatValue(event.measuredValue, metric?.unit)} · 범위 {formatValue(event.min, metric?.unit)} – {formatValue(event.max, metric?.unit)}</p></div></div>
      <div className="shrink-0 text-right"><p className="text-text-secondary text-xs tabular-nums">{new Date(event.occurredAt).toLocaleString("ko-KR")}</p><p className="text-text-secondary mt-1 text-[10px]">전송 {deliveryLabel(event.deliveryStatus)}</p></div>
    </div>
    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/7"><span className={`text-xs font-bold ${recovered ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-300"}`}>{recovered ? "복구됨" : "진행 중"}</span>{event.acknowledgedAt ? <span className="text-text-secondary text-xs">확인 {new Date(event.acknowledgedAt).toLocaleString("ko-KR")}</span> : <button type="button" disabled={acknowledging} onClick={onAcknowledge} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold transition hover:bg-slate-200 disabled:opacity-50 dark:bg-white/5 dark:hover:bg-white/10">{acknowledging ? "처리 중…" : "확인 처리"}</button>}</div>
  </article>;
}

function EventBadge({ type }: { type: AlertEventSummary["eventType"] }) {
  const style = type === "RECOVERY" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : type === "LOW" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300";
  return <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-extrabold ${style}`}>{type === "RECOVERY" ? "복구" : type === "LOW" ? "낮음" : "높음"}</span>;
}

function formatValue(value: number | null, unit?: string | null) { return value == null ? "-" : `${value}${unit ? ` ${unit}` : ""}`; }
function deliveryLabel(status: AlertEventSummary["deliveryStatus"]) { return ({ PENDING: "대기", SENT: "완료", FAILED: "실패", SKIPPED: "채널 없음" } as const)[status]; }

function SiteThresholdEditor({ entry, canEdit, onClose, onSave }: {
  entry: SiteAlertSettings;
  canEdit: boolean;
  onClose: () => void;
  onSave: (entry: SiteAlertSettings) => Promise<SiteAlertSettings>;
}) {
  const [thresholds, setThresholds] = useState(entry.thresholds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function close(event: KeyboardEvent) { if (event.key === "Escape" && !saving) onClose(); }
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", close); document.body.style.overflow = ""; };
  }, [onClose, saving]);

  function update(key: string, patch: Partial<AlertThreshold>) {
    setThresholds((current) => current.map((threshold) => threshold.key === key ? { ...threshold, ...patch } : threshold));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    for (const threshold of thresholds) {
      if (!Number.isFinite(threshold.min) || !Number.isFinite(threshold.max) || threshold.min < 0 || threshold.max < 0) {
        setError(`${threshold.label}: 기준값은 0 이상의 숫자여야 합니다.`); return;
      }
      if (threshold.min > threshold.max) { setError(`${threshold.label}: 최소값이 최대값보다 큽니다.`); return; }
    }
    setSaving(true); setError(null);
    try { await onSave({ ...entry, thresholds }); onClose(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "기준값을 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="threshold-editor-title" onSubmit={submit} className="flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(12,37,54,0.28)] sm:max-w-4xl sm:rounded-3xl dark:border-white/10 dark:bg-background-dark-card">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6 dark:border-white/7">
          <div><p className="text-xs font-bold text-sky-700 dark:text-sky-300">사업장 {entry.siteid}</p><h2 id="threshold-editor-title" className="mt-1 text-xl font-extrabold">{entry.name ?? "이름 없는 사업장"}</h2><p className="text-text-secondary mt-1 text-sm">최소값 미만 또는 최대값 초과 시 이상으로 판단합니다.</p></div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="닫기" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/70">×</button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-3 md:grid-cols-2">
            {thresholds.map((threshold) => <MetricEditor key={threshold.key} threshold={threshold} disabled={!canEdit || saving} onChange={(patch) => update(threshold.key, patch)} />)}
          </div>
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        </div>
        <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex sm:justify-end sm:px-6 dark:border-white/7 dark:bg-background-dark-card">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">{canEdit ? "취소" : "닫기"}</button>
          {canEdit && <button type="submit" disabled={saving} className="bg-button-primary hover:bg-button-primary-hover rounded-xl px-6 py-3 text-sm font-bold text-white shadow-sm transition disabled:opacity-50">{saving ? "저장 중…" : "전체 변경 저장"}</button>}
        </footer>
      </form>
    </div>
  );
}

function MetricEditor({ threshold, disabled, onChange }: { threshold: AlertThreshold; disabled: boolean; onChange: (patch: Partial<AlertThreshold>) => void }) {
  return (
    <section className={`rounded-2xl border p-3.5 transition ${threshold.active ? "border-sky-200 bg-sky-50/45 dark:border-sky-900/70 dark:bg-sky-950/20" : "border-slate-200/80 bg-slate-50/45 dark:border-white/8 dark:bg-white/3"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="font-extrabold">{threshold.label}{threshold.unit && <span className="text-text-secondary ml-1 text-xs font-medium">({threshold.unit})</span>}</h3><p className="text-text-secondary mt-0.5 line-clamp-2 text-xs">{METRIC_DESCRIPTION.get(threshold.key)}</p><code className="mt-1 block text-[10px] text-slate-400">{threshold.key}</code></div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={threshold.active} disabled={disabled} onChange={(event) => onChange({ active: event.target.checked })} className="h-5 w-5 accent-sky-700" />사용</label>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <NumberField label="최소" value={threshold.min} disabled={disabled} onChange={(min) => onChange({ min })} />
        <NumberField label="최대" value={threshold.max} disabled={disabled} onChange={(max) => onChange({ max })} />
      </div>
    </section>
  );
}

function NumberField({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return <label className="text-text-secondary text-xs font-bold">{label}<input type="number" min="0" step="any" required value={Number.isFinite(value) ? value : ""} disabled={disabled} onChange={(event) => onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))} className="text-text-major mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold tabular-nums outline-none focus:border-sky-400 disabled:opacity-70 dark:border-white/10 dark:bg-background-dark-primary dark:text-text-dark-primary" /></label>;
}

function RangePreview({ label, threshold }: { label: string; threshold?: AlertThreshold }) {
  return <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/4"><p className="text-text-secondary truncate text-[11px] font-bold">{label}</p><p className="mt-1 text-sm font-extrabold tabular-nums">{threshold ? `${threshold.min} – ${threshold.max}${threshold.unit ? ` ${threshold.unit}` : ""}` : "-"}</p></div>;
}

function StatChip({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-sm dark:border-white/8 dark:bg-background-dark-card"><span className="text-text-secondary text-xs font-medium">{label}</span><span className={`text-sm font-bold tabular-nums ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</span></div>;
}

function EmptyState() { return <div className="text-text-secondary rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm dark:border-white/10">검색 결과가 없습니다.</div>; }
