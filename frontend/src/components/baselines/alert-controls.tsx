"use client";

import HelpButton from "@/components/common/context-help";
import { ALERT_HELP } from "@/lib/alert-help";
import type { ReactNode } from "react";

export function AlertSwitch({ label, checked, disabled, onChange }: {
  label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void;
}) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled}
    onClick={() => onChange(!checked)} className="reference-switch">
    <span aria-hidden="true" className="reference-switch-track"><span /></span>
    {checked ? "켜짐" : "꺼짐"}
  </button>;
}

export function AlertSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/15 dark:bg-background-dark-card">
    <h3 className="flex flex-wrap items-center gap-1 text-xl font-bold">{title}{ALERT_HELP[title] && <HelpButton title={title} message={ALERT_HELP[title]}/>}</h3><p className="mt-2 text-base leading-7 text-slate-600 dark:text-slate-300">{description}</p>
    <div className="mt-5">{children}</div>
  </section>;
}
