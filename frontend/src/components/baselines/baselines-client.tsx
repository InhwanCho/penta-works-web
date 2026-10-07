"use client";

import { DEFAULT_ALERT_EVENT_FILTER, matchesAlertEventFilter, needsAcknowledgement, type AlertEventFilter } from "@/lib/alert-event-state";
import { averagePeriodMessage, previewAlertRange } from "@/lib/alert-range";
import AlertPatternInbox, { SharePatternButton } from "./alert-pattern-sharing";
import ManagementTabs from "@/components/common/management-tabs";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/provider/auth-provider";
import { ArrowBackIconMini } from "@/components/icons/arrow-back-icon";
import type { AlertEventSummary, AlertThreshold, SiteAlertSettings } from "@/lib/api";
import { formatMetricMeasurement, METRICS } from "@/lib/metrics";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

const METRIC_DESCRIPTION = new Map(METRICS.map((metric) => [metric.key, metric.description]));

export default function BaselinesClient({
  entries,
  loadFailed = false,
  canEdit = false,
  canEditCompany = false,
  companyThresholds,
  onSaveCompany,
  onRestoreCompany,
  onSave,
  onToggleVisibility,
  onToggleAlerts,
  events,
  eventsLoading = false,
  eventsFailed = false,
  onAcknowledge,
  onAcknowledgeMany,
  onRetryDelivery,
}: {
  entries: SiteAlertSettings[];
  loadFailed?: boolean;
  canEdit?: boolean;
  canEditCompany?: boolean;
  companyThresholds: AlertThreshold[];
  onSaveCompany: (thresholds: AlertThreshold[]) => Promise<AlertThreshold[]>;
  onRestoreCompany: (siteId: string) => Promise<SiteAlertSettings>;
  onSave: (entry: SiteAlertSettings) => Promise<SiteAlertSettings>;
  onToggleVisibility: (siteId: string, visible: boolean) => Promise<void>;
  onToggleAlerts: (siteId: string, enabled: boolean) => Promise<void>;
  events: AlertEventSummary[];
  eventsLoading?: boolean;
  eventsFailed?: boolean;
  onAcknowledge: (eventId: number) => Promise<AlertEventSummary>;
  onAcknowledgeMany: (eventIds: number[]) => Promise<{ ok: boolean; count: number }>;
  onRetryDelivery: (eventId: number) => Promise<{ ok: boolean; eventId: number }>;

}) {
  const [view, setView] = useState<"sites" | "thresholds" | "events" | "patterns">("thresholds");
  const [busySite, setBusySite] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [restoringSite, setRestoringSite] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SiteAlertSettings | null>(null);
  const [editorMetric, setEditorMetric] = useState<string | undefined>();
  function openSettings(entry: SiteAlertSettings, metricKey?: string) {
    setEditorMetric(metricKey);
    setSelected(entry);
  }
  function openEventSettings(event: AlertEventSummary) {
    const entry = entries.find(item => item.siteid === event.siteId);
    if (entry) openSettings(entry, event.metricKey);
  }
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return entries;
    return entries.filter((entry) =>
      entry.siteid.toLowerCase().includes(keyword) || (entry.name ?? "").toLowerCase().includes(keyword),
    );
  }, [entries, query]);
  const activeCount = useMemo(
    () => entries.reduce((count, entry) => count + entry.thresholds.filter((threshold) => threshold.active).length + (entry.noDataActive ? 1 : 0) + (entry.coldChillerActive ? 1 : 0), 0),
    [entries],
  );

  async function toggleVisibility(entry: SiteAlertSettings) {
    setBusySite(entry.siteid); setActionError(null);
    try { await onToggleVisibility(entry.siteid, !entry.dashboardVisible); }
    catch (error) { setActionError(error instanceof Error ? error.message : "표시 설정을 변경하지 못했습니다."); }
    finally { setBusySite(null); }
  }

  async function toggleAlerts(entry: SiteAlertSettings) {
    setBusySite(entry.siteid); setActionError(null);
    try { await onToggleAlerts(entry.siteid, !entry.alertsEnabled); }
    catch (error) { setActionError(error instanceof Error ? error.message : "알림 설정을 변경하지 못했습니다."); }
    finally { setBusySite(null); }
  }

  async function restoreCompany(entry: SiteAlertSettings) {
    if (!window.confirm(`${entry.name ?? entry.siteid}의 내 알림 패턴을 초기 기준으로 되돌릴까요? 내 기준값·반복 주기·발송 제외 설정이 바뀝니다.`)) return;
    setRestoringSite(entry.siteid); setActionError(null);
    try { await onRestoreCompany(entry.siteid); }
    catch (error) { setActionError(error instanceof Error ? error.message : "회사 기준으로 복원하지 못했습니다."); }
    finally { setRestoringSite(null); }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <div className="mb-2 sm:mb-3">
        <Link href="/" className="text-text-secondary hover:bg-background-tertiary hover:text-text-major dark:text-text-dark-primary/70 dark:hover:bg-background-dark-secondary dark:hover:text-text-dark-primary inline-flex min-h-10 items-center gap-x-1.5 rounded-lg px-2 text-sm font-bold transition-colors">
          <ArrowBackIconMini className="h-4 w-4" /> 대시보드
        </Link>
      </div>

      <header className="mb-5 overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#123b5d,#176083)] px-5 py-6 text-white shadow-[0_10px_28px_rgba(17,65,94,0.12)] sm:px-7">
        <p className="mb-1 text-xs font-bold tracking-[0.16em] text-sky-200 uppercase">Alert settings</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">알림 관리</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium text-white/70">
          내 병원별 알림 패턴을 설정하세요. 기준값·반복 주기·조용한 시간·지정 휴일은 본인에게만 적용됩니다.
        </p>
      </header>

      <ManagementTabs label="알림 관리" value={view} onChange={setView} items={[
        {value:"thresholds",label:"내 알림 패턴"}, {value:"sites",label:"병원 관리"},
        {value:"events",label:"알림 이력",badge:events.filter(needsAcknowledgement).length},
        {value:"patterns",label:"패턴 공유"},
      ]} />

      {view === "sites" ? <section className="space-y-3">
        <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4 text-sm text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100">
          <p className="font-bold">병원 표시 → 알림 사용 → 상세 기준값</p>
          <p className="mt-1 text-xs opacity-75">표시를 끄면 대시보드에서 사라지고 이 병원의 알림 발송도 중지됩니다. 다시 표시하면 각 담당자의 개인 설정을 따릅니다.</p>
        </div>
        {actionError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{actionError}</p>}
        {loadFailed && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">병원 설정을 불러오지 못했습니다.</p>}
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="병원 이름 또는 코드 검색" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400 dark:border-white/10 dark:bg-background-dark-card" />
        <div className="space-y-2">{filtered.map((entry) => <article key={entry.siteid} className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(22,58,82,0.035)] sm:flex-row sm:items-center dark:border-white/8 dark:bg-background-dark-card">
          <div className="min-w-0 flex-1"><h2 className="truncate font-bold">{entry.name ?? "이름 없는 병원"}</h2><p className="text-text-secondary mt-0.5 text-xs">{entry.siteid} · {entry.dashboardVisible ? (entry.alertsEnabled ? "대시보드 표시 · 알림 켜짐" : "대시보드 표시 · 알림 꺼짐") : "대시보드 숨김 · 알림 불가"}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            {canEditCompany && <button type="button" disabled={busySite === entry.siteid} onClick={() => toggleVisibility(entry)} className={`min-h-10 cursor-pointer rounded-lg px-3 text-xs font-bold transition disabled:opacity-50 ${entry.dashboardVisible ? "bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-sky-950/50 dark:text-sky-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/7 dark:text-white/70"}`} aria-label={`${entry.name ?? entry.siteid} 대시보드 ${entry.dashboardVisible ? "숨기기" : "표시하기"}`}>{entry.dashboardVisible ? "대시보드 표시 중" : "대시보드 숨김"}</button>}
            {canEdit && <button type="button" disabled={busySite === entry.siteid || !entry.dashboardVisible} onClick={() => toggleAlerts(entry)} className={`min-h-10 cursor-pointer rounded-lg px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${entry.alertsEnabled && entry.dashboardVisible ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/7 dark:text-white/70"}`}>{entry.alertsEnabled && entry.dashboardVisible ? "알림 켜짐" : "알림 꺼짐"}</button>}
            <button type="button" onClick={() => openSettings(entry)} className="min-h-10 cursor-pointer rounded-lg border border-slate-200 px-3 text-xs font-bold text-sky-700 transition hover:bg-sky-50 dark:border-white/10 dark:text-sky-200">상세 설정</button>
          </div>
        </article>)}</div>
        {filtered.length === 0 && <EmptyState />}
      </section> : view === "thresholds" ? <>
      <CompanyThresholdEditor thresholds={companyThresholds} canEdit={canEditCompany} onSave={onSaveCompany} />
      {loadFailed && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">기준값을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>}
      {actionError && <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{actionError}</p>}

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:gap-3">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="병원명 또는 병원 코드 검색" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition placeholder:text-text-secondary/70 focus:border-sky-400 dark:border-white/8 dark:bg-background-dark-card" />
        <StatChip label="병원" value={entries.length} />
        <StatChip label="사용 중 기준" value={activeCount} accent />
      </div>

      {filtered.length === 0 ? <EmptyState /> : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((entry) => {
            const pressure = entry.thresholds.find((threshold) => threshold.key === "hepres");
            const level = entry.thresholds.find((threshold) => threshold.key === "heleve");
            const enabled = entry.thresholds.filter((threshold) => threshold.active).length + (entry.noDataActive ? 1 : 0) + (entry.coldChillerActive ? 1 : 0);
            return (
              <article key={entry.siteid} className="group rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_3px_14px_rgba(22,58,82,0.045)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_7px_22px_rgba(22,58,82,0.075)] dark:border-white/8 dark:bg-background-dark-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h2 className="truncate font-extrabold">{entry.name ?? "이름 없는 병원"}</h2><p className="text-text-secondary mt-0.5 text-xs">병원 {entry.siteid}</p></div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${entry.alertsEnabled && enabled > 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-white/55"}`}>{entry.alertsEnabled ? `${enabled}/${entry.thresholds.length + 2} 사용` : "전체 중지"}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <RangePreview label="He Pressure" threshold={pressure} />
                  <RangePreview label="He Level" threshold={level} />
                  <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/4"><p className="text-text-secondary truncate text-[11px] font-bold">수신 중단</p><p className="mt-1 text-sm font-extrabold tabular-nums">{entry.noDataActive ? `${entry.noDataMinutes}분` : "사용 안 함"}</p></div>
                </div>
                <p className="text-text-secondary mt-3 text-xs">{entry.configured ? "내 알림 패턴 적용 중" : "초기 기준 적용 중"}</p>
                <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => openSettings(entry)} className="min-h-10 flex-1 cursor-pointer rounded-lg border border-slate-200 px-3 text-sm font-bold text-sky-700 transition hover:border-sky-200 hover:bg-sky-50 dark:border-white/10 dark:text-sky-200 dark:hover:bg-sky-950/30">{canEdit ? "상세 설정" : "기준값 보기"}</button><SharePatternButton entry={entry}/>{canEdit && entry.configured && <button type="button" disabled={restoringSite === entry.siteid} onClick={() => restoreCompany(entry)} className="min-h-10 cursor-pointer rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-white/70">초기 기준 복원</button>}</div>
              </article>
            );
          })}
        </section>
      )}
      </> : view === "events" ? <AlertEventsPanel onOpenSettings={openEventSettings} availableSites={entries.map(entry => entry.siteid)} events={events} loading={eventsLoading} failed={eventsFailed} onAcknowledge={onAcknowledge} onAcknowledgeMany={onAcknowledgeMany} onRetryDelivery={onRetryDelivery} />
        : <AlertPatternInbox/>}

      {selected && <SiteThresholdEditor entry={entries.find(entry => entry.siteid === selected.siteid) ?? selected} initialMetricKey={editorMetric} onlyMetricKey={selected.thresholds.some(item => item.key === editorMetric) ? editorMetric : undefined} canEdit={canEdit} onClose={() => setSelected(null)} onSave={async (entry) => { const saved = await onSave(entry); setSelected(saved); return saved; }} />}
    </main>
  );
}

function CompanyThresholdEditor({ thresholds, canEdit, onSave }: {
  thresholds: AlertThreshold[];
  canEdit: boolean;
  onSave: (thresholds: AlertThreshold[]) => Promise<AlertThreshold[]>;
}) {
  const [draft, setDraft] = useState<AlertThreshold[]>(thresholds);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setDraft(thresholds), [thresholds]);
  async function save() {
    for (const row of draft) {
      if (!Number.isFinite(row.min) || !Number.isFinite(row.max) || row.min < 0 || row.min > row.max) {
        setError(`${row.label}: 최소·최대값을 확인해주세요.`); return;
      }
    }
    setSaving(true); setError(null);
    try { await onSave(draft); setOpen(false); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "회사 기준을 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }
  if (thresholds.length === 0) return null;
  return <section className="mb-4 rounded-xl border border-sky-200/80 bg-sky-50/50 p-4 dark:border-sky-900/40 dark:bg-sky-950/15">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-extrabold">신규 사용자의 초기 기준</h2><p className="text-text-secondary mt-1 text-xs">개인 패턴을 처음 만들 때 참고하는 기준입니다. 이미 만들어진 다른 사용자의 패턴은 변경되지 않습니다.</p></div><button type="button" onClick={() => setOpen(!open)} className="min-h-10 cursor-pointer rounded-lg border border-sky-200 bg-white px-4 text-xs font-bold text-sky-700 hover:bg-sky-50 dark:border-sky-900/50 dark:bg-background-dark-card dark:text-sky-200">{open ? "접기" : "회사 기준 보기"}</button></div>
    {open && <><div className="mt-4 grid gap-3 md:grid-cols-2">{draft.map((threshold) => <MetricEditor key={threshold.key} threshold={threshold} disabled={!canEdit || saving} onChange={(patch) => setDraft((current) => current.map((item) => item.key === threshold.key ? { ...item, ...patch } : item))} />)}</div>{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}{canEdit && <div className="mt-4 flex justify-end"><button type="button" disabled={saving || draft.length === 0} onClick={save} className="bg-button-primary min-h-11 cursor-pointer rounded-lg px-5 text-sm font-bold text-white disabled:opacity-50">{saving ? "저장 중…" : "회사 기준 저장"}</button></div>}</>}
  </section>;
}

function TimeField({ label, value, onChange, optional = false }: { label: string; value: string; onChange: (value: string) => void; optional?: boolean }) { return <label className="text-text-secondary block min-w-28 flex-1 text-xs font-bold">{label}<input type="time" required={!optional} value={value} onChange={(event) => onChange(event.target.value)} className="text-text-major mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/5 dark:text-text-dark-primary" /></label>; }

function AlertEventsPanel({ events, loading, failed, onAcknowledge, onAcknowledgeMany, onRetryDelivery, onOpenSettings, availableSites }: {
  onOpenSettings: (event: AlertEventSummary) => void;
  availableSites: string[];
  events: AlertEventSummary[];
  loading: boolean;
  failed: boolean;
  onAcknowledge: (eventId: number) => Promise<AlertEventSummary>;
  onAcknowledgeMany: (eventIds: number[]) => Promise<{ ok: boolean; count: number }>;
  onRetryDelivery: (eventId: number) => Promise<{ ok: boolean; eventId: number }>;
}) {
  const [filter, setFilter] = useState<AlertEventFilter>(DEFAULT_ALERT_EVENT_FILTER);
  const [page, setPage] = useState(1);

  const [query, setQuery] = useState("");
  const [siteId, setSiteId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  useEffect(() => setPage(1), [filter, query, siteId, fromDate, toDate]);
  const [selected, setSelected] = useState<number[]>([]);
  const [acknowledging, setAcknowledging] = useState<number | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sites = useMemo(() => Array.from(new Map(events.map((event) => [event.siteId, event.siteName ?? event.siteId])).entries()), [events]);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
    return events.filter((event) => {
      const occurred = new Date(event.occurredAt).getTime();
      const statusMatches = matchesAlertEventFilter(event, filter);
      const queryMatches = !keyword || `${event.siteName ?? ""} ${event.siteId} ${event.message} ${event.metricKey}`.toLowerCase().includes(keyword);
      return event.eventType !== "RECOVERY" && statusMatches && (!siteId || event.siteId === siteId) && queryMatches &&
        (from == null || occurred >= from) && (to == null || occurred <= to);
    });
  }, [events, filter, query, siteId, fromDate, toDate]);
  const openCount = events.filter((event) => event.eventType !== "RECOVERY" && !event.recoveredAt).length;
  const selectableIds = filtered.filter(needsAcknowledgement).map((event) => event.id);
  const unacknowledgedCount = events.filter(needsAcknowledgement).length;
  const selectedIds = selected.filter(id => selectableIds.includes(id));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 20)));
  const busy = bulkSaving || acknowledging !== null || retrying !== null;

  async function acknowledge(eventId: number) {
    if (!window.confirm("이 알림을 본인의 확인완료로 기록할까요? 진행 중인 알림은 본인의 반복 발송도 중지됩니다. 다른 담당자의 확인 상태는 바뀌지 않습니다.")) return;
    setAcknowledging(eventId); setError(null);
    try { await onAcknowledge(eventId); }
    catch (ackError) { setError(ackError instanceof Error ? ackError.message : "알림을 확인 처리하지 못했습니다."); }
    finally { setAcknowledging(null); }
  }

  async function acknowledgeSelected(ids: number[]) {
    if (ids.length === 0) return;
    if (!window.confirm(`${ids.length}건을 본인의 확인완료로 기록할까요? 진행 중인 알림은 본인의 반복 발송도 중지됩니다. 다른 담당자의 확인 상태는 바뀌지 않습니다.`)) return;
    setBulkSaving(true); setError(null);
    try { await onAcknowledgeMany(ids); setSelected((current) => current.filter((id) => !ids.includes(id))); }
    catch (ackError) { setError(ackError instanceof Error ? ackError.message : "알림을 일괄 확인 처리하지 못했습니다."); }
    finally { setBulkSaving(false); }
  }

  async function retry(eventId: number) {
    if (!window.confirm("발송에 실패한 수신처에 다시 전송할까요? 확인완료한 담당자는 제외됩니다.")) return;
    setRetrying(eventId); setError(null);
    try { await onRetryDelivery(eventId); }
    catch (retryError) { setError(retryError instanceof Error ? retryError.message : "알림을 재전송하지 못했습니다."); }
    finally { setRetrying(null); }
  }

  if (loading) return <div className="text-text-secondary py-16 text-center text-sm">알림 이력을 불러오는 중…</div>;
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-extrabold">알림 이력</h2><p className="text-text-secondary mt-1 text-sm">정상 복귀나 설정 변경으로 상태가 종료돼도 직접 확인하기 전까지 미확인 목록에 남습니다.</p></div>
        <div className="flex max-w-full overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-white/5">{(["unacknowledged", "open", "all", "failed", "skipped"] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${filter === value ? "bg-white text-sky-700 shadow-sm dark:bg-sky-800 dark:text-white" : "text-slate-500 dark:text-white/55"}`}>{value === "all" ? "전체" : value === "open" ? `진행 중 ${openCount}` : value === "unacknowledged" ? `미확인 ${unacknowledgedCount}` : value === "failed" ? "전송 확인 필요" : value === "skipped" ? "미발송" : "미발송"}</button>)}</div>
      </div>
      <div className="mb-3 grid gap-2 rounded-xl border border-slate-200/80 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(9rem,.5fr)_auto_auto] dark:border-white/8 dark:bg-background-dark-card">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="병원명·측정항목·내용 검색" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5" />
        <select value={siteId} onChange={(event) => setSiteId(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5"><option value="">모든 병원</option>{sites.map(([id, name]) => <option key={id} value={id}>{name} · {id}</option>)}</select>
        <label className="text-text-secondary text-[11px] font-bold">시작일<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" /></label>
        <label className="text-text-secondary text-[11px] font-bold">종료일<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" /></label>
      </div>
      <p className="text-text-secondary mb-3 text-xs">최근 최대 500건을 표시합니다. 상태 종료와 확인완료는 별개입니다. 확인완료한 기록도 전체 목록에서 볼 수 있습니다.</p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id))} onChange={(event) => setSelected(event.target.checked ? Array.from(new Set([...selected, ...selectableIds])) : selected.filter((id) => !selectableIds.includes(id)))} className="h-4 w-4 accent-sky-700" />검색 결과의 미확인 알림 선택</label>
        <button type="button" disabled={busy || selectedIds.length === 0} onClick={() => acknowledgeSelected(selectedIds)} className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">선택 확인 ({selectedIds.length})</button>
        <button type="button" disabled={busy || selectableIds.length === 0} onClick={() => acknowledgeSelected(selectableIds)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5">현재 결과 전체 확인</button>
        <span className="text-text-secondary ml-auto text-xs">검색 결과 {filtered.length}건</span>
      </div>
      {failed && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">알림 이력을 불러오지 못했습니다.</p>}
      {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {filtered.length === 0 ? <EmptyState /> : <div className="space-y-2">{filtered.slice((currentPage - 1) * 20, currentPage * 20).map((event) => <AlertEventRow key={event.id} event={event} selected={selected.includes(event.id)} onSelect={(checked) => setSelected((current) => checked ? Array.from(new Set([...current, event.id])) : current.filter((id) => id !== event.id))} acknowledging={busy} retrying={busy} onAcknowledge={() => acknowledge(event.id)} onRetry={() => retry(event.id)} onOpenSettings={() => onOpenSettings(event)} settingsAvailable={availableSites.includes(event.siteId)} />)}</div>}
      {filtered.length > 20 && <div className="mt-4 flex items-center justify-center gap-4"><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="min-h-11 rounded-lg border px-4 disabled:opacity-30">이전</button><span className="text-sm">{currentPage} / {Math.ceil(filtered.length / 20)}</span><button type="button" disabled={currentPage * 20 >= filtered.length} onClick={() => setPage(currentPage + 1)} className="min-h-11 rounded-lg border px-4 disabled:opacity-30">다음</button></div>}
    </section>
  );
}

function AlertEventRow({ event, selected, onSelect, acknowledging, retrying, onAcknowledge, onRetry, onOpenSettings, settingsAvailable }: { event: AlertEventSummary; selected: boolean; onSelect: (checked: boolean) => void; acknowledging: boolean; retrying: boolean; onAcknowledge: () => void; onRetry: () => void; onOpenSettings: () => void; settingsAvailable: boolean }) {
  const { isAdmin } = useAuth();
  const [showDelivery, setShowDelivery] = useState(false);
  const queryClient = useQueryClient();
  const [resolving, setResolving] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState("");
  async function confirmDelivery(resultId: number, received: boolean) {
    if (!window.confirm(received ? "해당 수신처에 알림이 도착한 것을 확인했나요?" : "해당 수신처에 알림이 도착하지 않은 것을 확인했나요? 이후 재시도할 수 있습니다.")) return;
    setResolving(true); setDeliveryMessage("");
    try {
      await apiFetch(`/alerts/events/${event.id}/deliveries/${resultId}`, { method: "PATCH", body: JSON.stringify({ received }) });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["alert-events"] }), queryClient.invalidateQueries({ queryKey: ["alert-deliveries", event.id] })]);
    } catch (error) { setDeliveryMessage(error instanceof Error ? error.message : "처리하지 못했습니다."); }
    finally { setResolving(false); }
  }
  const results = useQuery({
    queryKey: ["alert-deliveries", event.id, event.deliveryStatus, event.notificationCount],
    queryFn: () => apiFetch<{ id: number; recipientLabel: string; status: AlertEventSummary["deliveryStatus"]; attemptCount: number; errorMessage: string | null; startedAt: string | null; currentBatch: boolean; providerSendStatus: number | null; providerResultCode: number | null; providerResultMessage: string | null; smsSendState: string | null; providerCheckedAt: string | null }[]>(`/alerts/events/${event.id}/deliveries`),
    enabled: showDelivery,
    refetchInterval: showDelivery ? 30000 : false,
  });
  const recovered = event.eventType === "RECOVERY" || !!event.recoveredAt;
  const metric = METRICS.find((item) => item.key === event.metricKey);
  const isNoData = event.metricKey === "__data__";
  const isColdChiller = event.metricKey === "__cold_chiller__";
  return <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_3px_12px_rgba(22,58,82,0.04)] dark:border-white/8 dark:bg-background-dark-card">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3"><input type="checkbox" aria-label="알림 선택" checked={selected} disabled={!!event.acknowledgedAt || acknowledging} onChange={(changeEvent) => onSelect(changeEvent.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-sky-700 disabled:opacity-30" /><EventBadge type={isColdChiller ? "COLD_CHILLER" : event.eventType} /><div className="min-w-0"><h3 className="font-extrabold">{event.siteName ?? event.siteId} · {isNoData ? "데이터 수신" : isColdChiller ? "콜드칠러 정지 의심" : metric?.label ?? event.metricKey}</h3><p className="text-text-secondary mt-1 text-sm">{showDelivery ? event.message : ""}</p><p className="text-text-secondary mt-1 text-xs tabular-nums">{isNoData ? `수신 지연 ${formatValue(event.measuredValue, "분")} · 기준 ${formatValue(event.max, "분")}` : isColdChiller ? `IN = OUT: ${formatValue(event.measuredValue, "°C")}` : `측정 ${formatMetricMeasurement(event.measuredValue, metric?.unit)} · 범위 ${formatValue(event.min, metric?.unit)} – ${formatValue(event.max, metric?.unit)}`}</p></div></div>
      <div className="shrink-0 text-right"><p className="text-text-secondary text-xs tabular-nums">{new Date(event.occurredAt).toLocaleString("ko-KR")}</p><p className="text-text-secondary mt-1 text-[10px]">전송 {deliveryLabel(event.deliveryStatus)}</p></div>
    </div>
    <div className="mt-3 flex flex-wrap items-start justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/7">
      <div className="flex flex-wrap items-center gap-2"><span className={`text-xs font-bold ${recovered ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-300"}`}>{recovered ? "상태 종료" : "진행 중"}</span><span className={`rounded-full px-2 py-1 text-xs font-bold ${event.acknowledgedAt ? "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-white/60" : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"}`}>{event.acknowledgedAt ? "확인완료" : "미확인"}</span>{event.recoveredAt && <span className="text-text-secondary text-[11px]">종료 {new Date(event.recoveredAt).toLocaleString("ko-KR")}</span>}</div>
      <div className="flex max-w-full flex-wrap items-center gap-2"><button type="button" disabled={!settingsAvailable} onClick={onOpenSettings} className="min-h-11 rounded-lg border border-sky-200 px-3 text-xs font-bold text-sky-700 disabled:opacity-40 dark:border-sky-900 dark:text-sky-300">알림 설정</button>{isAdmin && !recovered && ["FAILED", "PARTIAL", "SKIPPED"].includes(event.deliveryStatus) && <button type="button" disabled={retrying} onClick={onRetry} className="min-h-11 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30">{retrying ? "재전송 중…" : "전송 재시도"}</button>}{event.acknowledgedAt ? <span className="text-text-secondary text-xs">확인 {new Date(event.acknowledgedAt).toLocaleString("ko-KR")}</span> : <button type="button" disabled={acknowledging} onClick={onAcknowledge} className="min-h-11 rounded-lg bg-slate-100 px-3 text-xs font-bold transition hover:bg-slate-200 disabled:opacity-50 dark:bg-white/5 dark:hover:bg-white/10">{acknowledging ? "처리 중…" : "확인완료"}</button>}</div>
    </div>
    {event.deliveryError && <p className="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-300">{event.deliveryError}</p>}
    <button type="button" aria-expanded={showDelivery} onClick={() => setShowDelivery(!showDelivery)} className="min-h-10 cursor-pointer text-xs font-semibold text-sky-700 dark:text-sky-300">{showDelivery ? "전송 결과 접기" : "수신처별 전송 결과"}</button>
    {showDelivery && <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3 text-xs dark:bg-white/5">
      {results.isLoading ? <p>불러오는 중…</p> : results.isError ? <button type="button" onClick={() => results.refetch()}>결과를 불러오지 못했습니다. 다시 시도</button> : !results.data?.length ? <p>기록된 수신처별 결과가 없습니다. 이전 발송 또는 미발송 건일 수 있습니다.</p> : results.data.map((result) => <div key={result.id} className="space-y-1">
        <p className="font-semibold">{result.recipientLabel} · {deliveryLabel(result.status)} · 시도 {result.attemptCount}회</p>
        {result.providerCheckedAt && <p className="text-text-secondary">{result.providerSendStatus === 1 ? "알림톡 전송 성공" : result.providerSendStatus === 2 ? "알림톡 실패" : result.providerSendStatus === 0 ? "알림톡 전송 중" : "바로빌 상태 확인 필요"}{result.smsSendState ? ` · 대체문자: ${result.smsSendState}` : ""} · 확인 {new Date(result.providerCheckedAt).toLocaleString("ko-KR")}</p>}
        {result.providerResultMessage && result.providerSendStatus !== 1 && <p className="text-amber-700 dark:text-amber-300">{result.providerResultMessage}</p>}
        {result.startedAt && <p className="text-text-secondary">{new Date(result.startedAt).toLocaleString("ko-KR")}</p>}
        {result.errorMessage && <p className="text-amber-700 dark:text-amber-300">{result.errorMessage}</p>}
        {isAdmin && result.currentBatch && event.deliveryStatus === "UNKNOWN" && result.status === "UNKNOWN" && <div className="flex gap-3">
          <button type="button" disabled={resolving} onClick={() => confirmDelivery(result.id, true)} className="min-h-10 cursor-pointer font-semibold text-sky-700 dark:text-sky-300">수신 확인</button>
          <button type="button" disabled={resolving} onClick={() => confirmDelivery(result.id, false)} className="min-h-10 cursor-pointer font-semibold text-rose-600">미수신 확인</button>
        </div>}
      </div>)}
      {deliveryMessage && <p role="alert">{deliveryMessage}</p>}
    </div>}
  </article>;
}

function EventBadge({ type }: { type: AlertEventSummary["eventType"] | "COLD_CHILLER" }) {
  const style = type === "RECOVERY" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : type === "LOW" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300";
  return <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-extrabold ${style}`}>{type === "COLD_CHILLER" ? "정지 의심" : type === "RECOVERY" ? "복구" : type === "LOW" ? "낮음" : type === "NO_DATA" ? "수신 중단" : "높음"}</span>;
}

function formatValue(value: number | null, unit?: string | null) { return value == null ? "-" : `${Number(value.toFixed(2))}${unit ? ` ${unit}` : ""}`; }
function deliveryLabel(status: AlertEventSummary["deliveryStatus"]) { return ({ PENDING: "대기", SENDING: "전송 중", SENT: "접수 완료", PARTIAL: "일부 접수 실패", FAILED: "접수 실패", SKIPPED: "미발송", UNKNOWN: "결과 확인 필요" } as const)[status] ?? status; }

export function SiteThresholdEditor({ entry, canEdit, initialMetricKey, onlyMetricKey, onClose, onSave }: {
  entry: SiteAlertSettings;
  canEdit: boolean;
  initialMetricKey?: string;
  onlyMetricKey?: string;
  onClose: () => void;
  onSave: (entry: SiteAlertSettings) => Promise<SiteAlertSettings>;
}) {
  const [thresholds, setThresholds] = useState(() => onlyMetricKey ? entry.thresholds.filter(item => item.key === onlyMetricKey) : entry.thresholds);
  const [metricFilter, setMetricFilter] = useState<"active" | "all">(initialMetricKey && !initialMetricKey.startsWith("__") ? "all" : entry.thresholds.some(item => item.active) ? "active" : "all");
  const noDataSection = useRef<HTMLElement>(null);
  const [advancedOpen, setAdvancedOpen] = useState(initialMetricKey === "__data__");
  useEffect(() => { if (initialMetricKey === "__data__") noDataSection.current?.scrollIntoView({ block: "start" }); }, [initialMetricKey]);
  const [collectionIntervalMinutes, setCollectionIntervalMinutes] = useState(entry.collectionIntervalMinutes ?? 10);
  const [missingCollectionThreshold, setMissingCollectionThreshold] = useState(entry.missingCollectionThreshold ?? 2);
  const noDataMinutes = collectionIntervalMinutes * missingCollectionThreshold;
  const [noDataActive, setNoDataActive] = useState(entry.noDataActive);
  const [policyHelp, setPolicyHelp] = useState<"site" | "chiller" | null>(null);
  const [coldChillerActive, setColdChillerActive] = useState(entry.coldChillerActive);
  const [alertsEnabled, setAlertsEnabled] = useState(entry.alertsEnabled);
  const [triggerAfterMinutes, setTriggerAfterMinutes] = useState(entry.triggerAfterMinutes);
  const [repeatMinutes, setRepeatMinutes] = useState(entry.repeatMinutes);
  const [quietEnabled, setQuietEnabled] = useState(Boolean(entry.quietStart && entry.quietEnd));
  const [quietStart, setQuietStart] = useState(entry.quietStart?.slice(0, 5) ?? "22:00");
  const [quietEnd, setQuietEnd] = useState(entry.quietEnd?.slice(0, 5) ?? "08:00");
  const [suppressWeekends, setSuppressWeekends] = useState(entry.suppressWeekends);
  const [holidayDates, setHolidayDates] = useState(entry.holidayDates);
  const [holidayDate, setHolidayDate] = useState("");
  const holidayInput = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function close(event: KeyboardEvent) { if (event.key === "Escape" && !saving) onClose(); }
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", close); document.body.style.overflow = ""; };
  }, [onClose, saving]);

  // Refresh the stored hourly snapshot without overwriting unsaved preferences.
  useEffect(() => {
    setThresholds(current => current.map(item => {
      const latest = entry.thresholds.find(value => value.key === item.key);
      return latest ? {...item, averageValue:latest.averageValue,
        averageSampleCount:latest.averageSampleCount, excludedZeroCount:latest.excludedZeroCount,
        averageCapturedAt:latest.averageCapturedAt, averageApplied:latest.averageApplied,
        averageUnavailableReason:latest.averageUnavailableReason, historicalAverage:latest.historicalAverage} : item;
    }));
  }, [entry.thresholds]);

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
    if (!onlyMetricKey) {
    if (!Number.isInteger(collectionIntervalMinutes) || collectionIntervalMinutes < 5 || collectionIntervalMinutes > 1440 || !Number.isInteger(missingCollectionThreshold) || missingCollectionThreshold < 1 || missingCollectionThreshold > 288 || noDataMinutes > 1440) {
      setError("수집 주기는 5~1440분, 누락 기준은 1~288회 정수이며 총 대기시간은 1440분 이하여야 합니다."); return;
    }
    if (!Number.isInteger(triggerAfterMinutes) || triggerAfterMinutes < 0 || triggerAfterMinutes > 1440) {
      setError("이상 지속 기준은 0분에서 1440분 사이의 정수여야 합니다."); return;
    }
    if (!Number.isInteger(repeatMinutes) || repeatMinutes < 0 || repeatMinutes > 10080 || (repeatMinutes > 0 && repeatMinutes < 5)) {
      setError("반복 알림은 0(사용 안 함) 또는 5분에서 10080분 사이여야 합니다."); return;
    }
    }
    for (const threshold of thresholds) {
      if (!Number.isFinite(threshold.tolerancePercent) || threshold.tolerancePercent < 0.1 || threshold.tolerancePercent > 100) {
        setError(`${threshold.label}: 자동 평균 허용편차는 0.1%에서 100% 사이여야 합니다.`); return;
      }
    }
    if (!onlyMetricKey && quietEnabled && (!quietStart || !quietEnd || quietStart === quietEnd)) { setError("발송 제외 시작과 종료를 서로 다르게 입력해주세요."); return; }
    setSaving(true); setError(null);
    try { await onSave({ ...entry, thresholds, noDataMinutes, noDataActive, coldChillerActive, collectionIntervalMinutes, missingCollectionThreshold, alertsEnabled, triggerAfterMinutes, repeatMinutes, quietStart: quietEnabled ? quietStart : null, quietEnd: quietEnabled ? quietEnd : null, suppressWeekends, holidayDates }); onClose(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "기준값을 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="threshold-editor-title" onSubmit={submit} className={`flex max-h-[calc(100dvh-env(safe-area-inset-top,0px))] sm:max-h-[92dvh] w-full flex-col rounded-t-2xl border border-slate-200 bg-white shadow-[0_14px_48px_rgba(12,37,54,0.2)] ${onlyMetricKey ? "sm:max-w-lg" : "sm:max-w-4xl"} sm:rounded-2xl dark:border-white/10 dark:bg-background-dark-card`}>
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6 dark:border-white/7">
          <div><p className="text-xs font-bold text-sky-700 dark:text-sky-300">알림값 설정 · 병원 {entry.siteid}</p><h2 id="threshold-editor-title" className="mt-1 text-xl font-extrabold">{entry.name ?? "이름 없는 병원"}</h2><p className="text-text-secondary mt-1 text-sm">24시간 평균 + 허용편차 또는 수동 범위를 선택하세요. 평균은 매시간 갱신됩니다.{onlyMetricKey && " 선택한 항목만 변경됩니다."}</p></div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="닫기" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/70">×</button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {!onlyMetricKey && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/20">
            <div className="flex items-center gap-1"><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={alertsEnabled} disabled={!canEdit || saving || !entry.dashboardVisible} onChange={event => setAlertsEnabled(event.target.checked)} className="h-5 w-5 accent-emerald-600" />내 병원 알림 사용</label><button type="button" aria-label="내 병원 알림 사용 설명" aria-expanded={policyHelp === "site"} aria-controls="alert-policy-help" onClick={() => setPolicyHelp(current => current === "site" ? null : "site")} className="flex h-11 w-11 items-center justify-center rounded-full text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-white/10"><span className="flex h-5 w-5 items-center justify-center rounded-full border text-xs font-bold">?</span></button></div>
            <div className="flex items-center gap-1"><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={coldChillerActive} disabled={!canEdit || saving} onChange={event => setColdChillerActive(event.target.checked)} className="h-5 w-5 accent-emerald-600" />콜드칠러 정지 의심</label><button type="button" aria-label="콜드칠러 정지 의심 설명" aria-expanded={policyHelp === "chiller"} aria-controls="alert-policy-help" onClick={() => setPolicyHelp(current => current === "chiller" ? null : "chiller")} className="flex h-11 w-11 items-center justify-center rounded-full text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-white/10"><span className="flex h-5 w-5 items-center justify-center rounded-full border text-xs font-bold">?</span></button></div>
            {policyHelp && <div id="alert-policy-help" role="note" className="flex w-full items-start gap-2 rounded-xl border border-sky-200 bg-white p-3 text-xs leading-6 dark:border-sky-900 dark:bg-background-dark-card"><div className="flex-1"><p className="font-bold">{policyHelp === "site" ? "내 병원 알림을 켜고 끄는 스위치" : "콜드칠러 IN·OUT 온도 비교 알림"}</p><p>{policyHelp === "site" ? "끄면 본인이 받을 이 병원의 범위 이탈, 수집 누락, 콜드칠러 정지 의심 알림을 모두 중지합니다. 다른 담당자의 알림에는 영향을 주지 않습니다. 각 측정항목의 설정값은 유지됩니다. 대시보드에서 숨긴 병원은 알림을 켤 수 없습니다." : "콜드칠러 IN·OUT 온도가 정확히 같으면 냉각이 멈췄을 가능성을 알립니다. 고장이 확정된다는 뜻은 아닙니다. 미측정 값은 제외하며, 병원 알림이 켜져 있어야 발송됩니다. 고급 설정의 이상 지속 시간과 반복·발송 제외 설정을 따릅니다."}</p></div><button type="button" aria-label="알림 설명 닫기" onClick={() => setPolicyHelp(null)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg hover:bg-slate-100 dark:hover:bg-white/10">×</button></div>}
            {!entry.dashboardVisible && <p className="w-full text-xs text-text-secondary">숨긴 병원은 알림을 켤 수 없습니다.</p>}
          </div>}
          {!onlyMetricKey && <div className="mb-3 flex flex-wrap items-center gap-2">{(["active", "all"] as const).map(value => <button type="button" key={value} onClick={() => setMetricFilter(value)} className={`min-h-11 rounded-lg px-4 text-sm font-bold ${metricFilter === value ? "bg-sky-700 text-white" : "bg-slate-100 dark:bg-white/10"}`}>{value === "active" ? "사용 중 항목" : "전체 항목"}</button>)}<button type="button" disabled={!canEdit || saving} onClick={() => setThresholds(current => current.map(item => ({...item, useAverage: true})))} className="min-h-11 rounded-lg border px-3 text-xs font-bold dark:border-white/10">모든 항목을 24시간 평균으로</button></div>}
          <div className={`grid gap-3 ${onlyMetricKey ? "" : "md:grid-cols-2"}`}>
            {thresholds.filter(threshold => metricFilter === "all" || threshold.active)
              .sort((a, b) => Number(b.key === initialMetricKey) - Number(a.key === initialMetricKey))
              .map(threshold => <div key={threshold.key} className={threshold.key === initialMetricKey ? "rounded-xl ring-2 ring-sky-500" : undefined}>
                {threshold.key === initialMetricKey && <p className="px-3 py-2 text-xs font-bold text-sky-700 dark:text-sky-300">선택한 항목</p>}
                <RangePreview label={entry.thresholds.find(item => item.key === threshold.key)?.active ? "현재 저장된 적용 범위" : "현재 저장된 설정 · 알림 꺼짐"} threshold={entry.thresholds.find(item => item.key === threshold.key)} />
                <MetricEditor threshold={threshold} disabled={!canEdit || saving} allowAverage onChange={patch => update(threshold.key, patch)} />
              </div>)}
          </div>
          {!onlyMetricKey && <details open={advancedOpen} onToggle={event => setAdvancedOpen(event.currentTarget.open)} className="mt-5 rounded-xl border p-3 dark:border-white/10">
            <summary className="min-h-11 cursor-pointer font-bold">고급 설정 · 반복 알림 / 수집 누락 / 발송 제외</summary>
            <div className="mt-3">
          <section className={`mb-4 rounded-xl border p-4 transition ${alertsEnabled ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/15" : "border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">내 알림 운영 · 발송 제외</h3><p className="text-text-secondary mt-1 text-xs">{entry.dashboardVisible ? "전체 알림, 이상 지속 시간, 반복 주기와 발송 제외 시간을 관리합니다." : "숨긴 병원은 알림을 켤 수 없습니다. 먼저 대시보드 표시를 켜주세요."}</p></div><label className="flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" checked={alertsEnabled} disabled={!canEdit || saving || !entry.dashboardVisible} onChange={(event) => setAlertsEnabled(event.target.checked)} className="h-5 w-5 accent-emerald-600" />{alertsEnabled ? "알림 사용" : "전체 중지"}</label></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-text-secondary text-xs font-bold">이상 지속 후 알림 (분)<input type="number" min="0" max="1440" step="1" required value={triggerAfterMinutes} disabled={!canEdit || saving || !alertsEnabled} onChange={(event) => setTriggerAfterMinutes(Number(event.target.value))} className="text-text-major mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold tabular-nums dark:border-white/10 dark:bg-background-dark-primary dark:text-text-dark-primary" /><span className="mt-1 block font-medium">0이면 이상 감지 즉시 알립니다.</span></label>
              <label className="text-text-secondary text-xs font-bold">반복 알림 주기 (분)<input type="number" min="0" max="10080" step="1" required value={repeatMinutes} disabled={!canEdit || saving || !alertsEnabled} onChange={(event) => setRepeatMinutes(Number(event.target.value))} className="text-text-major mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold tabular-nums dark:border-white/10 dark:bg-background-dark-primary dark:text-text-dark-primary" /><span className="mt-1 block font-medium">0이면 최초 1회만 발송합니다. 5분 이상 입력하면 확인완료 전까지 반복합니다.</span></label>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2"><label className="flex cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={quietEnabled} disabled={!canEdit || saving || !alertsEnabled} onChange={(event) => setQuietEnabled(event.target.checked)} className="h-4 w-4 accent-sky-700" />조용한 시간 사용</label><label className="flex cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={suppressWeekends} disabled={!canEdit || saving || !alertsEnabled} onChange={(event) => setSuppressWeekends(event.target.checked)} className="h-4 w-4 accent-sky-700" />주말 발송 제외</label></div>
            {quietEnabled && <div className="mt-3 grid max-w-md grid-cols-2 gap-2"><TimeField label="제외 시작" value={quietStart} onChange={setQuietStart} /><TimeField label="제외 종료" value={quietEnd} onChange={setQuietEnd} /></div>}
            <div className="mt-4 rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/8 dark:bg-white/3"><p className="text-xs font-extrabold">지정 휴일 발송 제외</p><div className="mt-2 flex gap-2"><input ref={holidayInput} aria-label="지정 휴일" type="date" value={holidayDate} disabled={!canEdit || saving || !alertsEnabled} onChange={(event) => setHolidayDate(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-background-dark-primary" /><button type="button" disabled={!canEdit || saving} onClick={() => { const date = holidayInput.current?.value ?? holidayDate; if (!date || !holidayInput.current?.validity.valid) { setError("지정 휴일 날짜를 입력해주세요."); return; } setHolidayDates(current => current.includes(date) ? current : [...current, date].sort()); setHolidayDate(""); setError(null); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5">휴일 추가</button></div>{holidayDates.length > 0 ? <div className="mt-2 flex flex-wrap gap-1.5">{holidayDates.map((date) => <button key={date} type="button" disabled={!canEdit || saving} onClick={() => setHolidayDates((current) => current.filter((item) => item !== date))} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-600 dark:bg-white/7 dark:text-white/70">{date} ×</button>)}</div> : <p className="text-text-secondary mt-2 text-[11px]">추가한 날짜에는 알림을 발송하지 않습니다.</p>}</div>
          </section>
          <section ref={noDataSection} className={`mb-4 rounded-xl border p-4 transition ${noDataActive ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/70 dark:bg-amber-950/20" : "border-slate-200/80 bg-slate-50/45 dark:border-white/8 dark:bg-white/3"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">연속 수집 누락 알림</h3><p className="text-text-secondary mt-1 text-xs leading-5">마지막 수집 시각부터 예정된 수집이 연속으로 빠진 횟수를 계산합니다. 1시간 건수와는 별개이며, 다시 수집되면 누락 횟수는 0으로 돌아갑니다. 반복 주기는 위 설정을 따릅니다.</p></div><label className="flex cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={noDataActive} disabled={!canEdit || saving} onChange={(event) => setNoDataActive(event.target.checked)} className="h-5 w-5 accent-amber-600" />사용</label></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-text-secondary text-xs font-bold">예상 수집 주기 (분)<input type="number" min="5" max="1440" step="1" required value={collectionIntervalMinutes} disabled={!canEdit || saving} onChange={event => setCollectionIntervalMinutes(Number(event.target.value))} className="text-text-major mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold dark:border-white/10 dark:bg-background-dark-primary dark:text-text-dark-primary" /></label>
              <label className="text-text-secondary text-xs font-bold">연속 누락 알림 기준 (회)<input type="number" min="1" max="288" step="1" required value={missingCollectionThreshold} disabled={!canEdit || saving} onChange={event => setMissingCollectionThreshold(Number(event.target.value))} className="text-text-major mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold dark:border-white/10 dark:bg-background-dark-primary dark:text-text-dark-primary" /></label>
            </div>
            <p role="status" className="mt-3 text-sm font-bold">{collectionIntervalMinutes}분마다 수집 · {missingCollectionThreshold}회 연속 누락 시 알림 (마지막 수집 후 {noDataMinutes}분부터)</p>
          </section>
            </div>
          </details>}

        </div>
        {error && <p role="alert" className="shrink-0 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-100 bg-white px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:flex sm:justify-end sm:px-6 dark:border-white/7 dark:bg-background-dark-card">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">{canEdit ? "취소" : "닫기"}</button>
          {canEdit && <button type="submit" disabled={saving} className="bg-button-primary hover:bg-button-primary-hover rounded-xl px-6 py-3 text-sm font-bold text-white shadow-sm transition disabled:opacity-50">{saving ? "저장 중…" : onlyMetricKey ? "이 알림 저장" : "전체 변경 저장"}</button>}
        </footer>
      </form>
    </div>
  );
}

function MetricEditor({ threshold, disabled, allowAverage = false, onChange }: { threshold: AlertThreshold; disabled: boolean; allowAverage?: boolean; onChange: (patch: Partial<AlertThreshold>) => void }) {
  const preview = previewAlertRange(threshold);
  const unit = threshold.unit ? ` ${threshold.unit}` : "";
  const formatRange = (min: number, max: number) => `${roundThreshold(min)} – ${roundThreshold(max)}${unit}`;
  const manualFields = <div className="grid grid-cols-2 gap-3">
    <NumberField label="최소값" value={threshold.min} disabled={disabled} onChange={min => onChange({min})} />
    <NumberField label="최대값" value={threshold.max} disabled={disabled} onChange={max => onChange({max})} />
  </div>;
  return (
    <section className={`rounded-xl border p-3.5 transition ${threshold.active ? "border-sky-200 bg-sky-50/45 dark:border-sky-900/70 dark:bg-sky-950/20" : "border-slate-200/80 bg-slate-50/45 dark:border-white/8 dark:bg-white/3"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="font-extrabold">{threshold.label}{threshold.unit && <span className="text-text-secondary ml-1 text-xs font-medium">({threshold.unit})</span>}</h3><p className="text-text-secondary mt-0.5 line-clamp-2 text-xs">{METRIC_DESCRIPTION.get(threshold.key)}</p><code className="mt-1 block text-[10px] text-slate-400">{threshold.key}</code></div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={threshold.active} disabled={disabled} onChange={(event) => onChange({ active: event.target.checked })} className="h-5 w-5 accent-sky-700" />사용</label>
      </div>
      {allowAverage && <fieldset className="mt-4">
        <legend className="text-sm font-bold">알림 기준 선택</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {[{value:true,label:"24시간 평균 + 허용편차",description:"평균이 갱신되면 범위도 자동 변경"}, {value:false,label:"수동 최소·최대 범위",description:"입력한 범위를 계속 사용"}].map(mode =>
            <label key={String(mode.value)} className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border p-3 ${threshold.useAverage === mode.value ? "border-sky-500 bg-sky-50 dark:bg-sky-950/30" : "border-slate-200 dark:border-white/10"}`}>
              <input type="radio" name={`alert-basis-${threshold.key}`} checked={threshold.useAverage === mode.value} disabled={disabled} onChange={()=>onChange({useAverage:mode.value})} className="mt-0.5 h-5 w-5 shrink-0 accent-sky-700" />
              <span><span className="block text-xs font-bold">{mode.label}</span><span className="mt-1 block text-[11px] text-text-secondary">{mode.description}</span></span>
            </label>)}
        </div>
      </fieldset>}
      {allowAverage && threshold.useAverage ? <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <p className="text-xs font-bold">{threshold.historicalAverage ? "과거 24시간 평균 사용" : "최근 24시간 평균"}</p>
        {threshold.historicalAverage && <p className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-300">최근 평균을 사용할 수 없어 마지막 정상 평균을 사용합니다. 최근 표본이 충분해지면 자동 복귀합니다.</p>}
        {averagePeriodMessage(threshold) && <p className="mt-1 text-[11px] text-text-secondary">{averagePeriodMessage(threshold)}</p>}
        <p className="mt-1 text-lg font-extrabold">{threshold.averageValue == null ? "데이터 없음" : `${roundThreshold(threshold.averageValue)}${unit}`}</p>
        <p className="mt-1 text-[11px] text-text-secondary">유효 {threshold.averageSampleCount}건 · 미측정 제외 {threshold.excludedZeroCount}건 · 매시간 자동 갱신</p>
        <div className="mt-3"><NumberField label="허용편차 (±%)" value={threshold.tolerancePercent} min={0.1} max={100} disabled={disabled} onChange={tolerancePercent=>onChange({tolerancePercent})} /></div>
        <div role="status" aria-live="polite" className={`mt-3 rounded-lg p-3 ${preview.averageApplied ? "bg-emerald-100/70 dark:bg-emerald-950/50" : "bg-amber-100/70 dark:bg-amber-950/40"}`}>
          <p className="text-xs font-bold">저장 후 적용될 범위 · {preview.averageApplied ? threshold.historicalAverage ? "과거 24시간 평균" : "24시간 평균" : "대체 범위"}</p>
          <p className="mt-1 text-base font-extrabold">{formatRange(preview.min,preview.max)}</p>
          {!preview.averageApplied && <p className="mt-2 text-xs leading-5">{preview.reason ?? "허용편차를 확인해주세요."} 현재는 아래 대체 범위로 판단합니다. 표본과 최신성 조건이 충족되면 평균 기준으로 자동 전환됩니다.</p>}
        </div>
        {threshold.averageValue != null && !preview.averageApplied && <p className="mt-2 text-[11px] text-text-secondary">평균 적용 조건 충족 시 계산 범위: {formatRange(threshold.averageValue - Math.abs(threshold.averageValue)*threshold.tolerancePercent/100, threshold.averageValue + Math.abs(threshold.averageValue)*threshold.tolerancePercent/100)} · 현재 미적용</p>}
        <details className="mt-3 rounded-lg border border-emerald-200 bg-white/70 p-3 dark:border-emerald-900 dark:bg-white/5"><summary className="min-h-10 cursor-pointer text-xs font-bold">평균 사용 불가 시 대체 범위 수정</summary>{manualFields}<p className="mt-2 text-[11px] text-text-secondary">최근 평균이 부족하거나 오래되면 이전의 정상 24시간 평균을 찾아 사용합니다. 과거에도 유효 표본 12건 이상인 정상 평균이 없으면 이 대체 범위를 사용합니다. 미측정 값은 평균에서 제외합니다.</p></details>
      </div> : <div className="mt-3 rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
        <p className="mb-3 text-xs font-bold">수동 범위 설정</p>{manualFields}
        <p role="status" aria-live="polite" className="mt-3 text-sm font-bold">저장 후 적용될 범위: {formatRange(threshold.min,threshold.max)}</p>
        {allowAverage && <p className="mt-2 text-xs text-text-secondary">24시간 평균과 허용편차는 알림 판단에 사용하지 않습니다.</p>}
      </div>}
    </section>
  );
}

function roundThreshold(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : value;
}

function NumberField({ label, value, disabled, ignoreBlank = false, min = 0, max, onChange }: { label: string; value: number; disabled: boolean; ignoreBlank?: boolean; min?: number; max?: number; onChange: (value: number) => void }) {
  return <label className="text-text-secondary text-xs font-bold">{label}<input type="number" min={min} max={max} step="any" required value={Number.isFinite(value) ? roundThreshold(value) : ""} disabled={disabled} onChange={(event) => { if (ignoreBlank && event.target.value === "") return; onChange(event.target.value === "" ? Number.NaN : Number(event.target.value)); }} className="text-text-major mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold tabular-nums outline-none focus:border-sky-400 disabled:opacity-70 dark:border-white/10 dark:bg-background-dark-primary dark:text-text-dark-primary" /></label>;
}

function RangePreview({ label, threshold }: { label: string; threshold?: AlertThreshold }) {
  return <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/4"><p className="text-text-secondary truncate text-[11px] font-bold">{label}{threshold ? threshold.averageApplied ? threshold.historicalAverage ? " · 과거 24시간 평균" : " · 24시간 평균" : threshold.useAverage ? " · 평균 대기 / 대체 범위" : " · 수동 범위" : ""}</p><p className="mt-1 text-sm font-extrabold tabular-nums">{threshold ? `${roundThreshold(threshold.effectiveMin)} – ${roundThreshold(threshold.effectiveMax)}${threshold.unit ? ` ${threshold.unit}` : ""}` : "-"}</p></div>;
}

function StatChip({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-sm dark:border-white/8 dark:bg-background-dark-card"><span className="text-text-secondary text-xs font-medium">{label}</span><span className={`text-sm font-bold tabular-nums ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</span></div>;
}

function EmptyState() { return <div className="text-text-secondary rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm dark:border-white/10">검색 결과가 없습니다.</div>; }
