"use client";

import { ArrowBackIconMini } from "@/components/icons/arrow-back-icon";
import type { PsiThreshold } from "@/lib/api";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";

function fmtBound(v: number | null) {
  return v == null ? "-" : String(v);
}

export default function BaselinesClient({
  entries,
  loadFailed = false,
  canEdit = false,
  onSave,
}: {
  entries: PsiThreshold[];
  loadFailed?: boolean;
  canEdit?: boolean;
  onSave: (entry: PsiThreshold) => Promise<PsiThreshold>;
}) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<PsiThreshold | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return entries;

    return entries.filter((e) =>
      (e.name ?? "").toLowerCase().includes(query) || e.siteid.toLowerCase().includes(query),
    );
  }, [q, entries]);

  const activeCount = useMemo(
    () => entries.filter((e) => e.active).length,
    [entries],
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <div className="mb-2 sm:mb-3">
        <Link
          href="/"
          className="text-text-secondary hover:bg-background-tertiary hover:text-text-major dark:text-text-dark-primary/70 dark:hover:bg-background-dark-secondary dark:hover:text-text-dark-primary inline-flex min-h-10 items-center justify-center gap-x-1.5 rounded-lg px-2 text-sm font-bold transition-colors"
        >
          <ArrowBackIconMini className="h-4 w-4" /> 대시보드
        </Link>
      </div>

      <header className="mb-5 overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#123b5d,#176083)] px-5 py-6 text-white shadow-[0_16px_45px_rgba(17,65,94,0.16)] sm:px-7">
        <p className="mb-1 text-xs font-bold tracking-[0.16em] text-sky-200 uppercase">Alert settings</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          병원별 기준값
        </h1>
        <p className="mt-2 text-sm font-medium text-white/70">
          hePsi 알림과 대시보드 이상 표시가 함께 사용하는 허용범위입니다.
        </p>
      </header>

      {loadFailed && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50/60 p-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
        >
          기준값을 불러오지 못했습니다. DB 연결을 확인한 뒤 새로고침해 주세요.
        </div>
      )}

      {/* 통계 + 검색 */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:gap-3">
        <div className="relative">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="병원명으로 검색"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition outline-none placeholder:text-text-secondary/70 focus:border-sky-400 dark:border-white/8 dark:bg-background-dark-card dark:placeholder:text-text-dark-primary/40"
            inputMode="search"
            autoComplete="off"
          />
        </div>
        <StatChip
          label="등록"
          value={entries.length}
        />
        <StatChip
          label="알림 사용중"
          value={activeCount}
          accent
        />
      </div>

      {/* Mobile: 카드 리스트 */}
      <section className="md:hidden">
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2">
            {filtered.map((e) => (
              <li
                key={e.siteid}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_24px_rgba(22,58,82,0.06)] dark:border-white/8 dark:bg-background-dark-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center">
                    <div className="min-w-0"><span className="text-text-major dark:text-text-dark-primary block truncate text-[15px] font-semibold">{e.name ?? "-"}</span><span className="text-text-secondary text-xs">사업장 {e.siteid}</span></div>
                  </div>
                  <div className="flex items-center gap-2"><ActiveBadge active={e.active} />{canEdit && <EditButton onClick={() => setEditing(e)} />}</div>
                </div>
                <div className="bg-border/60 dark:bg-background-dark-secondary/60 my-3 h-px" />
                <div className="flex items-end justify-between text-xs">
                  <div className="flex flex-col">
                    <span className="text-text-secondary dark:text-text-dark-primary/70 text-sm font-medium">
                      최소
                    </span>
                    <span className="text-text-major dark:text-text-dark-primary/90 mt-0.5 text-sm font-semibold tabular-nums">
                      {fmtBound(e.min)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-text-secondary dark:text-text-dark-primary/70 text-sm font-medium">
                      최대
                    </span>
                    <span className="text-text-major dark:text-text-dark-primary/90 mt-0.5 text-sm font-semibold tabular-nums">
                      {fmtBound(e.max)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Desktop: 테이블 */}
      <section className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(22,58,82,0.06)] md:block dark:border-white/8 dark:bg-background-dark-card">
        {filtered.length === 0 ? (
          <div className="py-12">
            <EmptyState />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-background-primary/60 text-text-secondary dark:border-background-dark-secondary dark:bg-background-dark-secondary/40 dark:text-text-dark-primary/70 border-b">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase"
                  >
                    병원명
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide uppercase"
                  >
                    최소
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide uppercase"
                  >
                    최대
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase"
                  >
                    알림
                  </th>
                  {canEdit && <th scope="col" className="px-4 py-2.5 text-right text-[11px] font-semibold tracking-wide uppercase">관리</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.siteid}
                    className="dark:border-background-dark-secondary hover:bg-background-primary/40 dark:hover:bg-background-dark-secondary/30 border-b transition-colors last:border-b-0"
                  >
                    <td className="text-text-major dark:text-text-dark-primary px-4 py-3 font-medium">
                      <span className="block">{e.name ?? "-"}</span><span className="text-text-secondary text-xs font-medium">{e.siteid}</span>
                    </td>
                    <td className="text-text-major dark:text-text-dark-primary px-4 py-3 text-right font-semibold tabular-nums">
                      {fmtBound(e.min)}
                    </td>
                    <td className="text-text-major dark:text-text-dark-primary px-4 py-3 text-right font-semibold tabular-nums">
                      {fmtBound(e.max)}
                    </td>
                    <td className="px-4 py-3">
                      <ActiveBadge active={e.active} />
                    </td>
                    {canEdit && <td className="px-4 py-3 text-right"><EditButton onClick={() => setEditing(e)} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && <ThresholdEditor entry={editing} onClose={() => setEditing(null)} onSave={onSave} />}
    </main>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-sky-700 transition hover:border-sky-200 hover:bg-sky-50 dark:border-white/10 dark:bg-white/5 dark:text-sky-200 dark:hover:bg-sky-950/30">수정</button>;
}

function ThresholdEditor({ entry, onClose, onSave }: {
  entry: PsiThreshold;
  onClose: () => void;
  onSave: (entry: PsiThreshold) => Promise<PsiThreshold>;
}) {
  const [min, setMin] = useState(entry.min == null ? "" : String(entry.min));
  const [max, setMax] = useState(entry.max == null ? "" : String(entry.max));
  const [active, setActive] = useState(entry.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function close(event: KeyboardEvent) { if (event.key === "Escape" && !saving) onClose(); }
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose, saving]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextMin = Number(min);
    const nextMax = Number(max);
    if (min.trim() === "" || max.trim() === "" || !Number.isFinite(nextMin) || !Number.isFinite(nextMax)) {
      setError("최소값과 최대값을 숫자로 입력해주세요.");
      return;
    }
    if (nextMin < 0 || nextMax < 0) {
      setError("기준값은 0 이상이어야 합니다.");
      return;
    }
    if (nextMin > nextMax) {
      setError("최소값은 최대값보다 클 수 없습니다.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...entry, min: nextMin, max: nextMax, active });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "기준값을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="threshold-title" onSubmit={submit} className="w-full rounded-t-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(12,37,54,0.28)] sm:max-w-md sm:rounded-3xl sm:p-6 dark:border-white/10 dark:bg-background-dark-card">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div><p className="text-xs font-bold text-sky-700 dark:text-sky-300">사업장 {entry.siteid}</p><h2 id="threshold-title" className="mt-1 text-xl font-extrabold">{entry.name ?? "이름 없는 사업장"}</h2><p className="text-text-secondary mt-1 text-sm">He Pressure (psi) 허용범위</p></div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="닫기" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/70">×</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-bold">최소값<input autoFocus type="number" min="0" step="any" required value={min} onChange={(event) => setMin(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-base font-semibold tabular-nums outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5" /></label>
          <label className="text-sm font-bold">최대값<input type="number" min="0" step="any" required value={max} onChange={(event) => setMax(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-base font-semibold tabular-nums outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5" /></label>
        </div>
        <label className="mt-4 flex cursor-pointer items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-white/4">
          <span><span className="block text-sm font-bold">이상 알림 사용</span><span className="text-text-secondary mt-0.5 block text-xs">끄면 범위를 벗어나도 알림을 보내지 않습니다.</span></span>
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-5 w-5 accent-sky-700" />
        </label>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-slate-200 py-3 text-sm font-bold transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">취소</button>
          <button type="submit" disabled={saving} className="bg-button-primary hover:bg-button-primary-hover rounded-xl py-3 text-sm font-bold text-white shadow-sm transition disabled:opacity-50">{saving ? "저장 중…" : "변경 저장"}</button>
        </div>
      </form>
    </div>
  );
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-sm dark:border-white/8 dark:bg-background-dark-card">
      <span className="text-text-secondary dark:text-text-dark-primary/60 text-xs font-medium">
        {label}
      </span>
      <span
        className={[
          "text-sm font-semibold tabular-nums",
          accent
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-text-major dark:text-text-dark-primary",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-sm font-bold",
        active
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-slate-400",
        ].join(" ")}
      />
      {active ? "사용중" : "미사용"}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="text-text-secondary dark:text-text-dark-primary/60 py-10 text-center text-sm">
      결과가 없습니다.
    </div>
  );
}
