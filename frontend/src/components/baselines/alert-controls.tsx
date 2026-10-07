"use client";

import type { ReactNode } from "react";

export function AlertSwitch({ label, checked, disabled, onChange }: {
  label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void;
}) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled}
    onClick={() => onChange(!checked)} className={`inline-flex min-h-12 shrink-0 items-center gap-3 rounded-xl border px-4 py-2 text-base font-bold disabled:opacity-40 ${checked ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : "border-slate-300 bg-white text-slate-600 dark:border-white/20 dark:bg-white/5 dark:text-slate-300"}`}>
    <span aria-hidden="true" className={`relative h-6 w-10 rounded-full ${checked ? "bg-emerald-600" : "bg-slate-400"}`}><span className={`absolute left-0 top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`} /></span>
    {checked ? "켜짐" : "꺼짐"}
  </button>;
}

export function AlertSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/15 dark:bg-background-dark-card">
    <h3 className="text-xl font-bold">{title}</h3><p className="mt-2 text-base leading-7 text-slate-600 dark:text-slate-300">{description}</p>
    <div className="mt-5">{children}</div>
  </section>;
}
