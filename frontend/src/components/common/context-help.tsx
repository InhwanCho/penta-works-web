"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
type Explanation = { title: string; message: string };
type HelpRequest = Explanation & { host?: HTMLElement };
const eventName = "mreyes-context-help";
export default function HelpButton({ title, message }: Explanation) {
  return (
    <button
      type="button"
      data-context-help
      aria-label={`${title} 도움말`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(
          new CustomEvent<HelpRequest>(eventName, {
            detail: { title, message, host: event.currentTarget.closest<HTMLElement>('dialog, [role="dialog"]') ?? undefined },
          }),
        );
      }}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg align-middle text-sky-800 hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-sky-600 dark:text-sky-200 dark:hover:bg-slate-700"
    >
      <span
        aria-hidden="true"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs font-extrabold"
      >
        ?
      </span>
    </button>
  );
}
/** One shared card escapes sticky table clipping and replaces the previous explanation. */
export function ContextHelpHost() {
  const [help, setHelp] = useState<HelpRequest | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    setHelp(null);
    const close = () => setHelp(null);
    const show = (event: Event) => {
      const explanation = (event as CustomEvent<HelpRequest>).detail;
      if (!explanation?.title || !explanation?.message) return;
      setHelp(explanation);
    };
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest("[data-context-help]")
      )
        close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener(eventName, show);
    window.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener(eventName, show);
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", key);
    };
  }, [pathname]);
  if (!help) return null;
  return createPortal(
    <aside
      data-context-help
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed right-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] left-3 z-[150] mx-auto max-h-[60dvh] max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-left text-white shadow-xl lg:bottom-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-extrabold">{help.title}</p>
        <button
          type="button"
          onClick={() => setHelp(null)}
          className="min-h-11 shrink-0 rounded-lg px-3 text-base font-bold hover:bg-white/10"
          aria-label="도움말 닫기"
        >
          ×
        </button>
      </div>
      <p className="mt-1 text-base leading-7 font-normal break-words">
        {help.message}
      </p>
    </aside>,
    help.host?.isConnected ? help.host : document.body,
  );
}
