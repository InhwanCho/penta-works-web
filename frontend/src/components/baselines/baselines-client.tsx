"use client";

import { ArrowBackIconMini } from "@/components/icons/arrow-back-icon";
import type { AlertEventSummary, AlertRecipient, AlertThreshold, SiteAlertSettings } from "@/lib/api";
import { METRICS } from "@/lib/metrics";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

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
  recipients,
  recipientsLoading = false,
  recipientsFailed = false,
  onCreateRecipient,
  onUpdateRecipient,
  onDeleteRecipient,
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
  recipients: AlertRecipient[];
  recipientsLoading?: boolean;
  recipientsFailed?: boolean;
  onCreateRecipient: (request: { siteId: string; destination: string; quietStart: string | null; quietEnd: string | null; enabled: boolean }) => Promise<AlertRecipient>;
  onUpdateRecipient: (recipient: AlertRecipient) => Promise<AlertRecipient>;
  onDeleteRecipient: (id: number) => Promise<void>;
}) {
  const [view, setView] = useState<"sites" | "thresholds" | "events" | "recipients">("sites");
  const [busySite, setBusySite] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [restoringSite, setRestoringSite] = useState<string | null>(null);
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
    () => entries.reduce((count, entry) => count + entry.thresholds.filter((threshold) => threshold.active).length + (entry.noDataActive ? 1 : 0), 0),
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
    if (!window.confirm(`${entry.name ?? entry.siteid}의 병원별 측정 기준을 지우고 회사 공통 기준으로 되돌릴까요?`)) return;
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
          먼저 대시보드에 보여줄 사업장을 선택하세요. 표시된 사업장에만 알림을 켤 수 있습니다.
        </p>
      </header>

      <div className="mb-5 inline-flex rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-[0_2px_8px_rgba(22,58,82,0.04)] dark:border-white/8 dark:bg-background-dark-card">
        <ViewTab active={view === "sites"} onClick={() => setView("sites")}>사업장·알림</ViewTab>
        <ViewTab active={view === "thresholds"} onClick={() => setView("thresholds")}>상세 기준값</ViewTab>
        <ViewTab active={view === "events"} onClick={() => setView("events")} badge={events.filter((event) => event.eventType !== "RECOVERY" && !event.recoveredAt).length}>알림 이력</ViewTab>
        {canEdit && <ViewTab active={view === "recipients"} onClick={() => setView("recipients")}>수신 채널</ViewTab>}
      </div>

      {view === "sites" ? <section className="space-y-3">
        <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4 text-sm text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100">
          <p className="font-bold">사업장 표시 → 알림 사용 → 상세 기준값</p>
          <p className="mt-1 text-xs opacity-75">표시를 끄면 대시보드에서 사라지고 진행 중인 알림도 종료됩니다. 다시 표시해도 알림은 직접 켜야 합니다.</p>
        </div>
        {actionError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{actionError}</p>}
        {loadFailed && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">사업장 설정을 불러오지 못했습니다.</p>}
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="사업장 이름 또는 코드 검색" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400 dark:border-white/10 dark:bg-background-dark-card" />
        <div className="space-y-2">{filtered.map((entry) => <article key={entry.siteid} className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(22,58,82,0.035)] sm:flex-row sm:items-center dark:border-white/8 dark:bg-background-dark-card">
          <div className="min-w-0 flex-1"><h2 className="truncate font-bold">{entry.name ?? "이름 없는 사업장"}</h2><p className="text-text-secondary mt-0.5 text-xs">{entry.siteid} · {entry.dashboardVisible ? (entry.alertsEnabled ? "대시보드 표시 · 알림 켜짐" : "대시보드 표시 · 알림 꺼짐") : "대시보드 숨김 · 알림 불가"}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            {canEditCompany && <button type="button" disabled={busySite === entry.siteid} onClick={() => toggleVisibility(entry)} className={`min-h-10 cursor-pointer rounded-lg px-3 text-xs font-bold transition disabled:opacity-50 ${entry.dashboardVisible ? "bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-sky-950/50 dark:text-sky-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/7 dark:text-white/70"}`} aria-label={`${entry.name ?? entry.siteid} 대시보드 ${entry.dashboardVisible ? "숨기기" : "표시하기"}`}>{entry.dashboardVisible ? "대시보드 표시 중" : "대시보드 숨김"}</button>}
            {canEdit && <button type="button" disabled={busySite === entry.siteid || !entry.dashboardVisible} onClick={() => toggleAlerts(entry)} className={`min-h-10 cursor-pointer rounded-lg px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${entry.alertsEnabled && entry.dashboardVisible ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/7 dark:text-white/70"}`}>{entry.alertsEnabled && entry.dashboardVisible ? "알림 켜짐" : "알림 꺼짐"}</button>}
            <button type="button" onClick={() => setSelected(entry)} className="min-h-10 cursor-pointer rounded-lg border border-slate-200 px-3 text-xs font-bold text-sky-700 transition hover:bg-sky-50 dark:border-white/10 dark:text-sky-200">상세 설정</button>
          </div>
        </article>)}</div>
        {filtered.length === 0 && <EmptyState />}
      </section> : view === "thresholds" ? <>
      <CompanyThresholdEditor thresholds={companyThresholds} canEdit={canEditCompany} onSave={onSaveCompany} />
      {loadFailed && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">기준값을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>}
      {actionError && <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{actionError}</p>}

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
            const enabled = entry.thresholds.filter((threshold) => threshold.active).length + (entry.noDataActive ? 1 : 0);
            return (
              <article key={entry.siteid} className="group rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_3px_14px_rgba(22,58,82,0.045)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_7px_22px_rgba(22,58,82,0.075)] dark:border-white/8 dark:bg-background-dark-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h2 className="truncate font-extrabold">{entry.name ?? "이름 없는 사업장"}</h2><p className="text-text-secondary mt-0.5 text-xs">사업장 {entry.siteid}</p></div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${entry.alertsEnabled && enabled > 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-white/55"}`}>{entry.alertsEnabled ? `${enabled}/12 사용` : "전체 중지"}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <RangePreview label="He Pressure" threshold={pressure} />
                  <RangePreview label="He Level" threshold={level} />
                  <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/4"><p className="text-text-secondary truncate text-[11px] font-bold">수신 중단</p><p className="mt-1 text-sm font-extrabold tabular-nums">{entry.noDataActive ? `${entry.noDataMinutes}분` : "사용 안 함"}</p></div>
                </div>
                <p className="text-text-secondary mt-3 text-xs">{entry.configured ? "병원별 기준 적용 중" : "회사 공통 기준 적용 중"}</p>
                <div className="mt-3 flex gap-2"><button type="button" onClick={() => setSelected(entry)} className="min-h-10 flex-1 cursor-pointer rounded-lg border border-slate-200 px-3 text-sm font-bold text-sky-700 transition hover:border-sky-200 hover:bg-sky-50 dark:border-white/10 dark:text-sky-200 dark:hover:bg-sky-950/30">{canEdit ? "상세 설정" : "기준값 보기"}</button>{canEdit && entry.configured && <button type="button" disabled={restoringSite === entry.siteid} onClick={() => restoreCompany(entry)} className="min-h-10 cursor-pointer rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-white/70">회사 기준 복원</button>}</div>
              </article>
            );
          })}
        </section>
      )}
      </> : view === "events" ? <AlertEventsPanel events={events} loading={eventsLoading} failed={eventsFailed} onAcknowledge={onAcknowledge} onAcknowledgeMany={onAcknowledgeMany} onRetryDelivery={onRetryDelivery} />
        : <RecipientPanel sites={entries.filter((entry) => entry.dashboardVisible)} recipients={recipients} loading={recipientsLoading} failed={recipientsFailed} onCreate={onCreateRecipient} onUpdate={onUpdateRecipient} onDelete={onDeleteRecipient} />}

      {selected && <SiteThresholdEditor entry={selected} canEdit={canEdit} onClose={() => setSelected(null)} onSave={async (entry) => { const saved = await onSave(entry); setSelected(saved); return saved; }} />}
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
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-extrabold">회사 공통 기준</h2><p className="text-text-secondary mt-1 text-xs">병원별 기준이 없는 사업장에 적용됩니다. 병원별 기준을 저장하면 그 사업장에는 회사 기준 변경이 자동 적용되지 않습니다.</p></div><button type="button" onClick={() => setOpen(!open)} className="min-h-10 cursor-pointer rounded-lg border border-sky-200 bg-white px-4 text-xs font-bold text-sky-700 hover:bg-sky-50 dark:border-sky-900/50 dark:bg-background-dark-card dark:text-sky-200">{open ? "접기" : "회사 기준 보기"}</button></div>
    {open && <><div className="mt-4 grid gap-3 md:grid-cols-2">{draft.map((threshold) => <MetricEditor key={threshold.key} threshold={threshold} disabled={!canEdit || saving} onChange={(patch) => setDraft((current) => current.map((item) => item.key === threshold.key ? { ...item, ...patch } : item))} />)}</div>{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}{canEdit && <div className="mt-4 flex justify-end"><button type="button" disabled={saving || draft.length === 0} onClick={save} className="bg-button-primary min-h-11 cursor-pointer rounded-lg px-5 text-sm font-bold text-white disabled:opacity-50">{saving ? "저장 중…" : "회사 기준 저장"}</button></div>}</>}
  </section>;
}

function RecipientPanel({ sites, recipients, loading, failed, onCreate, onUpdate, onDelete }: {
  sites: SiteAlertSettings[];
  recipients: AlertRecipient[];
  loading: boolean;
  failed: boolean;
  onCreate: (request: { siteId: string; destination: string; quietStart: string | null; quietEnd: string | null; enabled: boolean }) => Promise<AlertRecipient>;
  onUpdate: (recipient: AlertRecipient) => Promise<AlertRecipient>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [siteId, setSiteId] = useState(sites[0]?.siteid ?? "");
  const [destination, setDestination] = useState("");
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("08:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      await onCreate({ siteId, destination, quietStart: quietEnabled ? quietStart : null, quietEnd: quietEnabled ? quietEnd : null, enabled: true });
      setDestination("");
    } catch (createError) { setError(createError instanceof Error ? createError.message : "수신 채널을 추가하지 못했습니다."); }
    finally { setSaving(false); }
  }

  return <section className="grid gap-4 xl:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
    <form onSubmit={submit} className="h-fit rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(22,58,82,0.045)] dark:border-white/8 dark:bg-background-dark-card">
      <h2 className="text-lg font-extrabold">Slack 수신 채널 추가</h2><p className="text-text-secondary mt-1 text-sm leading-6">사업장별 Incoming Webhook으로 알림을 보냅니다. 주소는 저장 후 다시 노출되지 않습니다.</p>
      <label className="mt-5 block text-sm font-bold">사업장<select required value={siteId} onChange={(event) => setSiteId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 dark:border-white/10 dark:bg-white/5">{sites.map((site) => <option key={site.siteid} value={site.siteid}>{site.name ?? site.siteid} · {site.siteid}</option>)}</select></label>
      <label className="mt-4 block text-sm font-bold">Slack Webhook URL<input required type="url" autoComplete="off" placeholder="https://hooks.slack.com/services/..." value={destination} onChange={(event) => setDestination(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 dark:border-white/10 dark:bg-white/5" /></label>
      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" checked={quietEnabled} onChange={(event) => setQuietEnabled(event.target.checked)} className="h-5 w-5 accent-sky-700" />조용한 시간 사용</label>
      {quietEnabled && <div className="mt-3 grid grid-cols-2 gap-2"><TimeField label="시작" value={quietStart} onChange={setQuietStart} /><TimeField label="종료" value={quietEnd} onChange={setQuietEnd} /></div>}
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      <button type="submit" disabled={saving || !siteId} className="bg-button-primary hover:bg-button-primary-hover mt-5 w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? "추가 중…" : "수신 채널 추가"}</button>
    </form>
    <div><div className="mb-3"><h2 className="text-lg font-extrabold">등록된 채널</h2><p className="text-text-secondary mt-1 text-sm">등록 채널이 없으면 기존 전역 Slack 채널로 발송됩니다.</p></div>{failed && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">수신 채널을 불러오지 못했습니다.</p>}{loading ? <p className="text-text-secondary py-12 text-center text-sm">불러오는 중…</p> : recipients.length === 0 ? <EmptyState /> : <div className="space-y-2">{recipients.map((recipient) => <RecipientRow key={recipient.id} recipient={recipient} onUpdate={onUpdate} onDelete={onDelete} />)}</div>}</div>
  </section>;
}

function RecipientRow({ recipient, onUpdate, onDelete }: { recipient: AlertRecipient; onUpdate: (recipient: AlertRecipient) => Promise<AlertRecipient>; onDelete: (id: number) => Promise<void> }) {
  const [start, setStart] = useState(recipient.quietStart?.slice(0, 5) ?? "");
  const [end, setEnd] = useState(recipient.quietEnd?.slice(0, 5) ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function update(patch: Partial<AlertRecipient> = {}) { setSaving(true); setError(null); try { await onUpdate({ ...recipient, quietStart: start || null, quietEnd: end || null, ...patch }); } catch (updateError) { setError(updateError instanceof Error ? updateError.message : "변경하지 못했습니다."); } finally { setSaving(false); } }
  async function remove() { if (!confirmDelete) { setConfirmDelete(true); return; } setSaving(true); try { await onDelete(recipient.id); } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "삭제하지 못했습니다."); setSaving(false); } }
  return <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/8 dark:bg-background-dark-card"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{recipient.siteName ?? recipient.siteId} <span className="text-text-secondary text-xs font-medium">· {recipient.siteId}</span></h3><p className="text-text-secondary mt-1 text-xs">{recipient.destinationMasked} · 등록 {recipient.userName}</p></div><button type="button" disabled={saving} onClick={() => update({ enabled: !recipient.enabled })} className={`rounded-full px-3 py-1.5 text-xs font-bold ${recipient.enabled ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-white/55"}`}>{recipient.enabled ? "사용 중" : "중지됨"}</button></div><div className="mt-3 flex flex-wrap items-end gap-2"><TimeField label="조용한 시간 시작" value={start} onChange={setStart} optional /><TimeField label="종료" value={end} onChange={setEnd} optional /><button type="button" disabled={saving || (!!start !== !!end)} onClick={() => update()} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5">시간 저장</button><button type="button" disabled={saving} onClick={remove} onBlur={() => setConfirmDelete(false)} className="rounded-xl px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30">{confirmDelete ? "정말 삭제" : "삭제"}</button></div>{error && <p className="mt-3 text-xs font-semibold text-red-600 dark:text-red-300">{error}</p>}</article>;
}

function TimeField({ label, value, onChange, optional = false }: { label: string; value: string; onChange: (value: string) => void; optional?: boolean }) { return <label className="text-text-secondary block min-w-28 flex-1 text-xs font-bold">{label}<input type="time" required={!optional} value={value} onChange={(event) => onChange(event.target.value)} className="text-text-major mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/5 dark:text-text-dark-primary" /></label>; }

function ViewTab({ active, onClick, badge, children }: { active: boolean; onClick: () => void; badge?: number; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${active ? "bg-[#174d70] text-white shadow-sm dark:bg-sky-700" : "text-slate-500 hover:bg-slate-100 dark:text-white/55 dark:hover:bg-white/5"}`}>{children}{badge ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/15 text-white" : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"}`}>{badge}</span> : null}</button>;
}

function AlertEventsPanel({ events, loading, failed, onAcknowledge, onAcknowledgeMany, onRetryDelivery }: {
  events: AlertEventSummary[];
  loading: boolean;
  failed: boolean;
  onAcknowledge: (eventId: number) => Promise<AlertEventSummary>;
  onAcknowledgeMany: (eventIds: number[]) => Promise<{ ok: boolean; count: number }>;
  onRetryDelivery: (eventId: number) => Promise<{ ok: boolean; eventId: number }>;
}) {
  const [filter, setFilter] = useState<"all" | "open" | "recovered" | "unacknowledged" | "failed">("all");
  const [query, setQuery] = useState("");
  const [siteId, setSiteId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
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
      const statusMatches = filter === "all" ||
        (filter === "open" && event.eventType !== "RECOVERY" && !event.recoveredAt) ||
        (filter === "recovered" && (event.eventType === "RECOVERY" || !!event.recoveredAt)) ||
        (filter === "unacknowledged" && !event.acknowledgedAt) ||
        (filter === "failed" && event.deliveryStatus === "FAILED");
      const queryMatches = !keyword || `${event.siteName ?? ""} ${event.siteId} ${event.message} ${event.metricKey}`.toLowerCase().includes(keyword);
      return statusMatches && (!siteId || event.siteId === siteId) && queryMatches &&
        (from == null || occurred >= from) && (to == null || occurred <= to);
    });
  }, [events, filter, query, siteId, fromDate, toDate]);
  const openCount = events.filter((event) => event.eventType !== "RECOVERY" && !event.recoveredAt).length;
  const selectableIds = filtered.filter((event) => !event.acknowledgedAt).map((event) => event.id);

  async function acknowledge(eventId: number) {
    setAcknowledging(eventId); setError(null);
    try { await onAcknowledge(eventId); }
    catch (ackError) { setError(ackError instanceof Error ? ackError.message : "알림을 확인 처리하지 못했습니다."); }
    finally { setAcknowledging(null); }
  }

  async function acknowledgeSelected(ids: number[]) {
    if (ids.length === 0) return;
    setBulkSaving(true); setError(null);
    try { await onAcknowledgeMany(ids); setSelected((current) => current.filter((id) => !ids.includes(id))); }
    catch (ackError) { setError(ackError instanceof Error ? ackError.message : "알림을 일괄 확인 처리하지 못했습니다."); }
    finally { setBulkSaving(false); }
  }

  async function retry(eventId: number) {
    setRetrying(eventId); setError(null);
    try { await onRetryDelivery(eventId); }
    catch (retryError) { setError(retryError instanceof Error ? retryError.message : "알림을 재전송하지 못했습니다."); }
    finally { setRetrying(null); }
  }

  if (loading) return <div className="text-text-secondary py-16 text-center text-sm">알림 이력을 불러오는 중…</div>;
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-extrabold">발생·복구 이력</h2><p className="text-text-secondary mt-1 text-sm">동일한 이상 상태는 한 번만 기록되고 정상 복귀 시 복구 이력이 추가됩니다.</p></div>
        <div className="flex max-w-full overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-white/5">{(["all", "open", "unacknowledged", "failed", "recovered"] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${filter === value ? "bg-white text-sky-700 shadow-sm dark:bg-sky-800 dark:text-white" : "text-slate-500 dark:text-white/55"}`}>{value === "all" ? "전체" : value === "open" ? `진행 중 ${openCount}` : value === "unacknowledged" ? "미확인" : value === "failed" ? "전송 실패" : "복구"}</button>)}</div>
      </div>
      <div className="mb-3 grid gap-2 rounded-xl border border-slate-200/80 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(9rem,.5fr)_auto_auto] dark:border-white/8 dark:bg-background-dark-card">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="병원명·측정항목·내용 검색" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5" />
        <select value={siteId} onChange={(event) => setSiteId(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5"><option value="">모든 사업장</option>{sites.map(([id, name]) => <option key={id} value={id}>{name} · {id}</option>)}</select>
        <label className="text-text-secondary text-[11px] font-bold">시작일<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" /></label>
        <label className="text-text-secondary text-[11px] font-bold">종료일<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" /></label>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id))} onChange={(event) => setSelected(event.target.checked ? Array.from(new Set([...selected, ...selectableIds])) : selected.filter((id) => !selectableIds.includes(id)))} className="h-4 w-4 accent-sky-700" />검색 결과의 미확인 알림 선택</label>
        <button type="button" disabled={bulkSaving || selected.length === 0} onClick={() => acknowledgeSelected(selected)} className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">선택 확인 ({selected.length})</button>
        <button type="button" disabled={bulkSaving || selectableIds.length === 0} onClick={() => acknowledgeSelected(selectableIds)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5">현재 결과 전체 확인</button>
        <span className="text-text-secondary ml-auto text-xs">검색 결과 {filtered.length}건</span>
      </div>
      {failed && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">알림 이력을 불러오지 못했습니다.</p>}
      {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {filtered.length === 0 ? <EmptyState /> : <div className="space-y-2">{filtered.map((event) => <AlertEventRow key={event.id} event={event} selected={selected.includes(event.id)} onSelect={(checked) => setSelected((current) => checked ? Array.from(new Set([...current, event.id])) : current.filter((id) => id !== event.id))} acknowledging={acknowledging === event.id} retrying={retrying === event.id} onAcknowledge={() => acknowledge(event.id)} onRetry={() => retry(event.id)} />)}</div>}
    </section>
  );
}

function AlertEventRow({ event, selected, onSelect, acknowledging, retrying, onAcknowledge, onRetry }: { event: AlertEventSummary; selected: boolean; onSelect: (checked: boolean) => void; acknowledging: boolean; retrying: boolean; onAcknowledge: () => void; onRetry: () => void }) {
  const recovered = event.eventType === "RECOVERY" || !!event.recoveredAt;
  const metric = METRICS.find((item) => item.key === event.metricKey);
  const isNoData = event.metricKey === "__data__";
  return <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_3px_12px_rgba(22,58,82,0.04)] dark:border-white/8 dark:bg-background-dark-card">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3"><input type="checkbox" aria-label="알림 선택" checked={selected} disabled={!!event.acknowledgedAt} onChange={(changeEvent) => onSelect(changeEvent.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-sky-700 disabled:opacity-30" /><EventBadge type={event.eventType} /><div className="min-w-0"><h3 className="font-extrabold">{event.siteName ?? event.siteId} · {isNoData ? "데이터 수신" : metric?.label ?? event.metricKey}</h3><p className="text-text-secondary mt-1 text-sm">{event.message}</p><p className="text-text-secondary mt-1 text-xs tabular-nums">{isNoData ? `수신 지연 ${formatValue(event.measuredValue, "분")} · 기준 ${formatValue(event.max, "분")}` : `측정 ${formatValue(event.measuredValue, metric?.unit)} · 범위 ${formatValue(event.min, metric?.unit)} – ${formatValue(event.max, metric?.unit)}`}</p></div></div>
      <div className="shrink-0 text-right"><p className="text-text-secondary text-xs tabular-nums">{new Date(event.occurredAt).toLocaleString("ko-KR")}</p><p className="text-text-secondary mt-1 text-[10px]">전송 {deliveryLabel(event.deliveryStatus)}</p></div>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-white/7"><span className={`text-xs font-bold ${recovered ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-300"}`}>{recovered ? "복구됨" : "진행 중"}</span><div className="flex items-center gap-2">{event.deliveryStatus === "FAILED" && <button type="button" disabled={retrying} onClick={onRetry} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30">{retrying ? "재전송 중…" : "전송 재시도"}</button>}{event.acknowledgedAt ? <span className="text-text-secondary text-xs">확인 {new Date(event.acknowledgedAt).toLocaleString("ko-KR")}</span> : <button type="button" disabled={acknowledging} onClick={onAcknowledge} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold transition hover:bg-slate-200 disabled:opacity-50 dark:bg-white/5 dark:hover:bg-white/10">{acknowledging ? "처리 중…" : "확인 처리"}</button>}</div></div>
  </article>;
}

function EventBadge({ type }: { type: AlertEventSummary["eventType"] }) {
  const style = type === "RECOVERY" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : type === "LOW" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300";
  return <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-extrabold ${style}`}>{type === "RECOVERY" ? "복구" : type === "LOW" ? "낮음" : type === "NO_DATA" ? "수신 중단" : "높음"}</span>;
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
  const [noDataMinutes, setNoDataMinutes] = useState(entry.noDataMinutes);
  const [noDataActive, setNoDataActive] = useState(entry.noDataActive);
  const [alertsEnabled, setAlertsEnabled] = useState(entry.alertsEnabled);
  const [triggerAfterMinutes, setTriggerAfterMinutes] = useState(entry.triggerAfterMinutes);
  const [repeatMinutes, setRepeatMinutes] = useState(entry.repeatMinutes);
  const [quietEnabled, setQuietEnabled] = useState(Boolean(entry.quietStart && entry.quietEnd));
  const [quietStart, setQuietStart] = useState(entry.quietStart?.slice(0, 5) ?? "22:00");
  const [quietEnd, setQuietEnd] = useState(entry.quietEnd?.slice(0, 5) ?? "08:00");
  const [suppressWeekends, setSuppressWeekends] = useState(entry.suppressWeekends);
  const [holidayDates, setHolidayDates] = useState(entry.holidayDates);
  const [holidayDate, setHolidayDate] = useState("");
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
    if (!Number.isInteger(noDataMinutes) || noDataMinutes < 5 || noDataMinutes > 1440) {
      setError("수신 중단 기준은 5분에서 1440분 사이의 정수여야 합니다."); return;
    }
    if (!Number.isInteger(triggerAfterMinutes) || triggerAfterMinutes < 0 || triggerAfterMinutes > 1440) {
      setError("이상 지속 기준은 0분에서 1440분 사이의 정수여야 합니다."); return;
    }
    if (!Number.isInteger(repeatMinutes) || repeatMinutes < 0 || repeatMinutes > 10080 || (repeatMinutes > 0 && repeatMinutes < 5)) {
      setError("반복 알림은 0(사용 안 함) 또는 5분에서 10080분 사이여야 합니다."); return;
    }
    for (const threshold of thresholds) {
      if (!Number.isFinite(threshold.tolerancePercent) || threshold.tolerancePercent < 0.1 || threshold.tolerancePercent > 100) {
        setError(`${threshold.label}: 자동 평균 허용편차는 0.1%에서 100% 사이여야 합니다.`); return;
      }
    }
    setSaving(true); setError(null);
    try { await onSave({ ...entry, thresholds, noDataMinutes, noDataActive, alertsEnabled, triggerAfterMinutes, repeatMinutes, quietStart: quietEnabled ? quietStart : null, quietEnd: quietEnabled ? quietEnd : null, suppressWeekends, holidayDates }); onClose(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "기준값을 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="threshold-editor-title" onSubmit={submit} className="flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-slate-200 bg-white shadow-[0_14px_48px_rgba(12,37,54,0.2)] sm:max-w-4xl sm:rounded-2xl dark:border-white/10 dark:bg-background-dark-card">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6 dark:border-white/7">
          <div><p className="text-xs font-bold text-sky-700 dark:text-sky-300">사업장 {entry.siteid} · {entry.configured ? "병원별 기준" : "회사 공통 기준 상속"}</p><h2 id="threshold-editor-title" className="mt-1 text-xl font-extrabold">{entry.name ?? "이름 없는 사업장"}</h2><p className="text-text-secondary mt-1 text-sm">최소·최대값을 직접 입력하거나 기준값과 ± 허용편차로 빠르게 계산할 수 있습니다. 저장하면 이 사업장만 별도 기준을 사용합니다.</p></div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="닫기" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/70">×</button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <section className={`mb-4 rounded-xl border p-4 transition ${alertsEnabled ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/15" : "border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">사업장 알림 운영</h3><p className="text-text-secondary mt-1 text-xs">{entry.dashboardVisible ? "전체 알림, 이상 지속 시간, 반복 주기와 발송 제외 시간을 관리합니다." : "숨긴 사업장은 알림을 켤 수 없습니다. 먼저 대시보드 표시를 켜주세요."}</p></div><label className="flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" checked={alertsEnabled} disabled={!canEdit || saving || !entry.dashboardVisible} onChange={(event) => setAlertsEnabled(event.target.checked)} className="h-5 w-5 accent-emerald-600" />{alertsEnabled ? "알림 사용" : "전체 중지"}</label></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-text-secondary text-xs font-bold">이상 지속 후 알림 (분)<input type="number" min="0" max="1440" step="1" required value={triggerAfterMinutes} disabled={!canEdit || saving || !alertsEnabled} onChange={(event) => setTriggerAfterMinutes(Number(event.target.value))} className="text-text-major mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold tabular-nums dark:border-white/10 dark:bg-background-dark-primary dark:text-text-dark-primary" /><span className="mt-1 block font-medium">0이면 이상 감지 즉시 알립니다.</span></label>
              <label className="text-text-secondary text-xs font-bold">반복 알림 주기 (분)<input type="number" min="0" max="10080" step="1" required value={repeatMinutes} disabled={!canEdit || saving || !alertsEnabled} onChange={(event) => setRepeatMinutes(Number(event.target.value))} className="text-text-major mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold tabular-nums dark:border-white/10 dark:bg-background-dark-primary dark:text-text-dark-primary" /><span className="mt-1 block font-medium">0이면 최초 발생과 복구 시에만 알립니다.</span></label>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2"><label className="flex cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={quietEnabled} disabled={!canEdit || saving || !alertsEnabled} onChange={(event) => setQuietEnabled(event.target.checked)} className="h-4 w-4 accent-sky-700" />야간 발송 제외</label><label className="flex cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={suppressWeekends} disabled={!canEdit || saving || !alertsEnabled} onChange={(event) => setSuppressWeekends(event.target.checked)} className="h-4 w-4 accent-sky-700" />주말 발송 제외</label></div>
            {quietEnabled && <div className="mt-3 grid max-w-md grid-cols-2 gap-2"><TimeField label="제외 시작" value={quietStart} onChange={setQuietStart} /><TimeField label="제외 종료" value={quietEnd} onChange={setQuietEnd} /></div>}
            <div className="mt-4 rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/8 dark:bg-white/3"><p className="text-xs font-extrabold">지정 휴일 발송 제외</p><div className="mt-2 flex gap-2"><input type="date" value={holidayDate} disabled={!canEdit || saving || !alertsEnabled} onChange={(event) => setHolidayDate(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-background-dark-primary" /><button type="button" disabled={!holidayDate || !canEdit || saving || holidayDates.includes(holidayDate)} onClick={() => { setHolidayDates((current) => [...current, holidayDate].sort()); setHolidayDate(""); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5">휴일 추가</button></div>{holidayDates.length > 0 ? <div className="mt-2 flex flex-wrap gap-1.5">{holidayDates.map((date) => <button key={date} type="button" disabled={!canEdit || saving} onClick={() => setHolidayDates((current) => current.filter((item) => item !== date))} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-600 dark:bg-white/7 dark:text-white/70">{date} ×</button>)}</div> : <p className="text-text-secondary mt-2 text-[11px]">추가한 날짜에는 알림을 발송하지 않습니다.</p>}</div>
          </section>
          <section className={`mb-4 rounded-xl border p-4 transition ${noDataActive ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/70 dark:bg-amber-950/20" : "border-slate-200/80 bg-slate-50/45 dark:border-white/8 dark:bg-white/3"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">데이터 수신 중단</h3><p className="text-text-secondary mt-1 text-xs">마지막 데이터 이후 설정 시간을 넘기면 한 번 알리고, 수신 재개 시 복구 알림을 보냅니다.</p></div><label className="flex cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={noDataActive} disabled={!canEdit || saving} onChange={(event) => setNoDataActive(event.target.checked)} className="h-5 w-5 accent-amber-600" />사용</label></div>
            <label className="text-text-secondary mt-3 block max-w-52 text-xs font-bold">수신 중단 기준 (분)<input type="number" min="5" max="1440" step="1" required value={noDataMinutes} disabled={!canEdit || saving} onChange={(event) => setNoDataMinutes(Number(event.target.value))} className="text-text-major mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold tabular-nums outline-none focus:border-amber-400 disabled:opacity-70 dark:border-white/10 dark:bg-background-dark-primary dark:text-text-dark-primary" /></label>
          </section>
          <div className="grid gap-3 md:grid-cols-2">
            {thresholds.map((threshold) => <MetricEditor key={threshold.key} threshold={threshold} disabled={!canEdit || saving} allowAverage onChange={(patch) => update(threshold.key, patch)} />)}
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

function MetricEditor({ threshold, disabled, allowAverage = false, onChange }: { threshold: AlertThreshold; disabled: boolean; allowAverage?: boolean; onChange: (patch: Partial<AlertThreshold>) => void }) {
  const center = roundThreshold((threshold.min + threshold.max) / 2);
  const tolerance = roundThreshold((threshold.max - threshold.min) / 2);
  function changeCenter(value: number) {
    const appliedTolerance = Number.isFinite(value) ? Math.min(tolerance, value) : tolerance;
    onChange({ min: roundThreshold(value - appliedTolerance), max: roundThreshold(value + appliedTolerance) });
  }
  function changeTolerance(value: number) {
    const appliedTolerance = Number.isFinite(value) ? Math.min(value, center) : value;
    onChange({ min: roundThreshold(center - appliedTolerance), max: roundThreshold(center + appliedTolerance) });
  }
  return (
    <section className={`rounded-xl border p-3.5 transition ${threshold.active ? "border-sky-200 bg-sky-50/45 dark:border-sky-900/70 dark:bg-sky-950/20" : "border-slate-200/80 bg-slate-50/45 dark:border-white/8 dark:bg-white/3"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="font-extrabold">{threshold.label}{threshold.unit && <span className="text-text-secondary ml-1 text-xs font-medium">({threshold.unit})</span>}</h3><p className="text-text-secondary mt-0.5 line-clamp-2 text-xs">{METRIC_DESCRIPTION.get(threshold.key)}</p><code className="mt-1 block text-[10px] text-slate-400">{threshold.key}</code></div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={threshold.active} disabled={disabled} onChange={(event) => onChange({ active: event.target.checked })} className="h-5 w-5 accent-sky-700" />사용</label>
      </div>
      {allowAverage && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={threshold.useAverage} disabled={disabled} onChange={(event) => onChange({ useAverage: event.target.checked })} className="h-4 w-4 accent-emerald-700" />최근 24시간 평균을 기준값으로 사용</label>
        <p className="text-text-secondary mt-1 text-[11px]">0은 평균에서 제외합니다. 매시간 갱신하며 유효 표본 12개 이상이 필요합니다.</p>
        <p className="mt-2 text-xs font-semibold tabular-nums">현재 평균 {threshold.averageValue == null ? "없음" : `${roundThreshold(threshold.averageValue)}${threshold.unit ? ` ${threshold.unit}` : ""}`} · 유효 {threshold.averageSampleCount}개 · 0 제외 {threshold.excludedZeroCount}개</p>
        {threshold.useAverage && <div className="mt-2"><NumberField label="허용편차 (±%)" value={threshold.tolerancePercent} min={0.1} max={100} disabled={disabled} onChange={(value) => onChange({ tolerancePercent: value })} /><p className="text-text-secondary mt-1 text-[11px]">{threshold.averageApplied ? `적용 범위 ${roundThreshold(threshold.effectiveMin)} – ${roundThreshold(threshold.effectiveMax)}` : "평균을 적용할 수 없으면 아래 고정 범위를 사용합니다."}</p></div>}
      </div>}
      <div className="mt-3 rounded-xl border border-dashed border-sky-200 bg-white/65 p-2.5 dark:border-sky-900/70 dark:bg-white/3">
        <p className="mb-2 text-[10px] font-extrabold tracking-wide text-sky-700 uppercase dark:text-sky-300">{allowAverage ? "고정 기준값 (평균 사용 불가 시 대체) ± 허용편차" : "기준값 ± 허용편차"}</p>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="기준값" value={center} disabled={disabled} ignoreBlank onChange={changeCenter} />
          <NumberField label="± 편차" value={tolerance} disabled={disabled} ignoreBlank onChange={changeTolerance} />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <NumberField label="최소" value={threshold.min} disabled={disabled} onChange={(min) => onChange({ min })} />
        <NumberField label="최대" value={threshold.max} disabled={disabled} onChange={(max) => onChange({ max })} />
      </div>
    </section>
  );
}

function roundThreshold(value: number) {
  return Number.isFinite(value) ? Math.round(value * 1_000_000) / 1_000_000 : value;
}

function NumberField({ label, value, disabled, ignoreBlank = false, min = 0, max, onChange }: { label: string; value: number; disabled: boolean; ignoreBlank?: boolean; min?: number; max?: number; onChange: (value: number) => void }) {
  return <label className="text-text-secondary text-xs font-bold">{label}<input type="number" min={min} max={max} step="any" required value={Number.isFinite(value) ? value : ""} disabled={disabled} onChange={(event) => { if (ignoreBlank && event.target.value === "") return; onChange(event.target.value === "" ? Number.NaN : Number(event.target.value)); }} className="text-text-major mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold tabular-nums outline-none focus:border-sky-400 disabled:opacity-70 dark:border-white/10 dark:bg-background-dark-primary dark:text-text-dark-primary" /></label>;
}

function RangePreview({ label, threshold }: { label: string; threshold?: AlertThreshold }) {
  return <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/4"><p className="text-text-secondary truncate text-[11px] font-bold">{label}{threshold?.averageApplied ? " · 24h 평균" : ""}</p><p className="mt-1 text-sm font-extrabold tabular-nums">{threshold ? `${roundThreshold(threshold.effectiveMin)} – ${roundThreshold(threshold.effectiveMax)}${threshold.unit ? ` ${threshold.unit}` : ""}` : "-"}</p></div>;
}

function StatChip({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-sm dark:border-white/8 dark:bg-background-dark-card"><span className="text-text-secondary text-xs font-medium">{label}</span><span className={`text-sm font-bold tabular-nums ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</span></div>;
}

function EmptyState() { return <div className="text-text-secondary rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm dark:border-white/10">검색 결과가 없습니다.</div>; }
