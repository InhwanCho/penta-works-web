"use client";
import { useId } from "react";

export default function ManagementTabs<T extends string>({
  label,
  value,
  items,
  onChange,
  large = false,
}: {
  label: string;
  large?: boolean;
  value: T;
  items: { value: T; label: string; badge?: number }[];
  onChange: (value: T) => void;
}) {
  const groupId = useId();
  return (
    <>
      {items.length > 3 && (
        <fieldset className="mb-4 sm:hidden">
          <legend className="mb-2 text-sm font-bold">{label}</legend>
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => (
              <label
                key={item.value}
                className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${value === item.value ? "border-sky-600 bg-sky-50 text-sky-900 dark:border-sky-400 dark:bg-sky-950/60 dark:text-sky-200" : "dark:bg-background-dark-card border-slate-200 bg-white dark:border-white/15"}`}
              >
                <input
                  type="radio"
                  name={groupId}
                  value={item.value}
                  checked={value === item.value}
                  onChange={() => onChange(item.value)}
                  className="h-4 w-4 accent-sky-700"
                />
                <span>
                  {item.label}
                  {item.badge ? ` (${item.badge})` : ""}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div
        role="tablist"
        aria-label={label}
        className={`mb-5 w-full min-w-0 overflow-x-auto border-b border-slate-200 dark:border-white/10 ${items.length > 3 ? "hidden sm:flex" : "flex"}`}
      >
        {items.map((item, index) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={value === item.value}
            tabIndex={value === item.value ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % items.length
                  : event.key === "ArrowLeft"
                    ? (index + items.length - 1) % items.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? items.length - 1
                        : null;
              if (next == null) return;
              event.preventDefault();
              onChange(items[next].value);
              (
                event.currentTarget.parentElement?.children[next] as HTMLElement
              )?.focus();
            }}
            className={`flex min-h-12 min-w-max flex-1 items-center justify-center gap-1 border-b-2 px-2 sm:px-4 ${large ? "text-base" : "text-sm"} font-bold whitespace-nowrap transition ${value === item.value ? "border-sky-700 text-sky-800 dark:border-sky-400 dark:text-sky-300" : "border-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"}`}
          >
            {item.label}
            {Boolean(item.badge) && (
              <span
                className={`rounded-full bg-rose-100 px-1.5 py-0.5 ${large ? "text-sm" : "text-[10px]"} text-rose-700 dark:bg-rose-950/50 dark:text-rose-300`}
              >
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
