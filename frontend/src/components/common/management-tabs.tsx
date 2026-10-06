"use client";

export default function ManagementTabs<T extends string>({ label, value, items, onChange }: {
  label: string;
  value: T;
  items: { value: T; label: string; badge?: number }[];
  onChange: (value: T) => void;
}) {
  return <div role="tablist" aria-label={label} className="mb-5 flex w-full min-w-0 overflow-x-auto border-b border-slate-200 dark:border-white/10">
    {items.map((item, index) => <button key={item.value} type="button" role="tab" aria-selected={value === item.value} tabIndex={value === item.value ? 0 : -1}
      onClick={() => onChange(item.value)}
      onKeyDown={event => {
        const next = event.key === "ArrowRight" ? (index + 1) % items.length : event.key === "ArrowLeft" ? (index + items.length - 1) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
        if (next == null) return;
        event.preventDefault(); onChange(items[next].value);
        (event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
      }}
      className={`flex min-h-12 min-w-28 flex-1 shrink-0 items-center justify-center gap-2 border-b-2 px-4 text-sm font-bold whitespace-nowrap transition ${value === item.value ? "border-sky-700 text-sky-800 dark:border-sky-400 dark:text-sky-300" : "border-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"}`}>
      {item.label}{Boolean(item.badge) && <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{item.badge}</span>}
    </button>)}
  </div>;
}
