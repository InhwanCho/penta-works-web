"use client";

import { TOAST_EVENT, type ToastMessage } from "@/lib/toast";
import { useEffect, useRef, useState } from "react";

type Toast = ToastMessage & { id: number };

export default function ToastViewport() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<ToastMessage>).detail;
      setToasts(current => [...current.slice(-2), { ...detail, id: ++nextId.current }]);
    };
    window.addEventListener(TOAST_EVENT, receive);
    return () => window.removeEventListener(TOAST_EVENT, receive);
  }, []);

  return <div aria-label="변경 결과 알림" className="pointer-events-none fixed top-[calc(4.25rem+env(safe-area-inset-top,0px))] right-3 left-3 z-[100] mx-auto flex max-w-md flex-col gap-2 sm:right-5 sm:left-auto">
    {toasts.map(toast => <ToastItem key={toast.id} toast={toast} onDismiss={() => setToasts(current => current.filter(item => item.id !== toast.id))} />)}
  </div>;
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const timer = setTimeout(() => dismiss.current(), toast.tone === "error" ? 6000 : 4000);
    return () => clearTimeout(timer);
  }, [toast.tone]);
  return <div role={toast.tone === "error" ? "alert" : "status"} aria-atomic="true" className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-bold shadow-lg ${toast.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100" : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"}`}>
    <span aria-hidden="true">{toast.tone === "error" ? "!" : "✓"}</span><p className="min-w-0 flex-1 break-words">{toast.message}</p><button type="button" onClick={onDismiss} aria-label="알림 닫기" className="-m-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg">×</button>
  </div>;
}
