"use client";

import CircleLoader from "@/components/icons/circle-loader";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";
import { defaultCompanyMetrics, type CompanyMetric } from "@/lib/company-metrics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function CompanyMetricsEditor() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["company-metrics", session?.id];
  const query = useQuery({ queryKey, queryFn: () => apiFetch<CompanyMetric[]>("/company/metrics"), staleTime: Infinity });
  const [draft, setDraft] = useState<CompanyMetric[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const canEdit = session?.role === "PLATFORM_ADMIN" || session?.role === "SUPER_ADMIN";
  const entries = draft ?? query.data ?? [];
  function change(index: number, patch: Partial<CompanyMetric>) {
    setMessage(""); setDraft(entries.map((entry, i) => i === index ? { ...entry, ...patch } : entry));
  }
  function move(index: number, offset: number) {
    const next = [...entries];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setDraft(next); setMessage("");
  }
  async function save() {
    if (saving) return;
    if (!entries.some((metric) => metric.visible)) { setMessage("최소 한 항목은 표시해야 합니다."); return; }
    if (entries.some((metric) => !metric.displayName.trim())) { setMessage("표시 이름을 입력해주세요."); return; }
    setSaving(true); setMessage("");
    try {
      const saved = await apiFetch<CompanyMetric[]>("/company/metrics", { method: "PATCH", body: JSON.stringify(entries.map((metric, index) => ({ ...metric, sortOrder: index }))) });
      queryClient.setQueryData(queryKey, saved); setDraft(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["siteDetail"] }),
      ]);
      setMessage("회사 측정항목 표시 설정을 저장했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했습니다."); }
    finally { setSaving(false); }
  }
  if (query.isLoading) return <div className="flex min-h-48 items-center justify-center"><CircleLoader size="xl" /></div>;
  if (query.isError) return <button type="button" onClick={() => query.refetch()}>설정을 불러오지 못했습니다. 다시 시도</button>;
  return <section className={`${canEdit ? "mb-[calc(6rem+env(safe-area-inset-bottom,0px))] sm:mb-0" : ""} rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-white/10 dark:bg-background-dark-card`}>
    <h2 className="text-lg font-bold">대시보드 컬럼 이름·순서</h2>
    <p className="text-text-secondary mt-2 text-sm leading-6">병원명은 첫 컬럼으로 고정됩니다. 나머지 컬럼의 이름·순서·표시 여부는 회사 전체에 적용됩니다. 화살표로 순서를 바꾼 뒤 저장하세요. 단위는 표시만 변경하며 수치는 변환하지 않습니다. 항목을 숨겨도 알림 설정은 유지됩니다.</p>
    {!canEdit && <p className="mt-2 text-sm">회사 최고관리자가 설정을 변경할 수 있습니다.</p>}
    <div className="mt-5 space-y-3">{entries.map((metric, index) => <div key={metric.key} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[9rem_1fr_7rem_auto] sm:items-end sm:pb-8 dark:border-white/10">
      <div className="relative"><code className="text-text-secondary block text-xs font-semibold">{metric.key}</code><button type="button" role="switch" aria-checked={metric.visible} aria-label={`${metric.displayName} 사용 여부`} disabled={!canEdit || saving} onClick={() => change(index, {visible: !metric.visible})} className={`mt-1 flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 text-xs font-bold disabled:cursor-default ${metric.visible ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : "border-slate-300 bg-slate-100 text-slate-600 dark:border-white/15 dark:bg-white/5 dark:text-slate-300"}`}><span>{metric.visible ? "사용 중" : "사용 안 함"}</span><span aria-hidden="true" className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 ${metric.visible ? "justify-end bg-emerald-600" : "justify-start bg-slate-400"}`}><span className="h-4 w-4 rounded-full bg-white shadow-sm" /></span></button><p className="mt-1 text-[11px] text-text-secondary sm:absolute sm:top-full">{metric.visible ? "대시보드에 표시" : "대시보드에서 숨김"}</p></div>
      <label className="text-xs font-semibold">표시 이름<input value={metric.displayName} maxLength={80} disabled={!canEdit || saving} onChange={(event) => change(index, { displayName: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10" /></label>
      <label className="text-xs font-semibold">표시 단위<input value={metric.unit ?? ""} maxLength={20} disabled={!canEdit || saving} onChange={(event) => change(index, { unit: event.target.value || null })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2.5 dark:border-white/10" /></label>
      <div className="flex gap-1">{[-1, 1].map((offset) => <button key={offset} type="button" disabled={!canEdit || saving || index + offset < 0 || index + offset >= entries.length} onClick={() => move(index, offset)} aria-label={`${metric.displayName} ${offset < 0 ? "위로" : "아래로"}`} className="min-h-11 min-w-11 cursor-pointer rounded-lg border border-slate-200 disabled:opacity-30 dark:border-white/10">{offset < 0 ? "↑" : "↓"}</button>)}</div>
    </div>)}</div>
    {!canEdit && message && <p role="status" className="mt-4 text-sm">{message}</p>}
    {canEdit && <footer aria-label="측정항목 변경 저장" className="fixed inset-x-0 bottom-0 z-[55] border-t border-slate-200 bg-white px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-[0_-4px_18px_rgba(12,37,54,0.08)] sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none dark:border-white/10 dark:bg-background-dark-card sm:dark:bg-transparent">
      <div className="mx-auto max-w-7xl">
        <p role="status" aria-live="polite" className="mb-2 text-xs leading-4 text-text-secondary">{message || (draft ? "변경사항을 저장해주세요." : "모든 변경사항이 저장되었습니다.")}</p>
        <div className="flex justify-between gap-3"><button type="button" disabled={saving} onClick={() => { setDraft(defaultCompanyMetrics()); setMessage("기본 표시값으로 바꿨습니다. 저장하면 적용됩니다."); }} className="min-h-11 cursor-pointer rounded-lg border px-4 text-sm dark:border-white/15">기본 표시값</button><button type="button" disabled={saving || !draft} onClick={save} className="bg-button-primary min-h-11 flex-1 cursor-pointer rounded-lg px-5 font-bold text-white disabled:opacity-50 sm:flex-none">{saving ? "저장 중…" : "변경 저장"}</button></div>
      </div>
    </footer>}
  </section>;
}
