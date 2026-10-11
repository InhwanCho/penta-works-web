"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function PwaProvider() {
  const pathname = usePathname();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [applying, setApplying] = useState(false);
  useEffect(() => {
    if (pathname === "/accept-invite" || pathname === "/reset-password") return;
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    const changed = () => {
      if (
        !disposed &&
        registration?.waiting &&
        navigator.serviceWorker.controller
      )
        setWaiting(registration.waiting);
    };
    const found = () => {
      installing?.removeEventListener("statechange", changed);
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", changed);
    };
    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js?v=2", {
          scope: "/",
          updateViaCache: "none",
        });
        if (disposed) return;
        changed();
        found();
        registration.addEventListener("updatefound", found);
      } catch {
        /* Continue online if browser storage is unavailable. */
      }
    };
    const timer = window.setTimeout(() => {
      void register();
    }, 2000);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      registration?.removeEventListener("updatefound", found);
      installing?.removeEventListener("statechange", changed);
    };
  }, [pathname]);
  useEffect(() => {
    if (!applying) return;
    const reload = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", reload);
    waiting?.postMessage({ type: "SKIP_WAITING" });
    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", reload);
  }, [applying, waiting]);
  if (!waiting) return null;
  return (
    <aside
      role="status"
      className="fixed top-[calc(4rem+env(safe-area-inset-top,0px))] right-3 left-3 z-[80] mx-auto max-w-md rounded-xl border bg-white p-4 text-sm shadow-xl dark:bg-slate-900"
    >
      <p className="font-bold">새 버전을 사용할 수 있습니다.</p>
      <p className="mt-1">
        작성 중인 내용을 저장한 뒤 적용해주세요. 로그인은 유지됩니다.
      </p>
      <button
        type="button"
        disabled={applying}
        onClick={() => setApplying(true)}
        className="mt-3 min-h-11 rounded-lg bg-sky-700 px-4 font-bold text-white"
      >
        {applying ? "적용 중…" : "새 버전 적용"}
      </button>
      <button
        type="button"
        disabled={applying}
        onClick={() => setWaiting(null)}
        className="ml-2 min-h-11 px-3"
      >
        나중에
      </button>
    </aside>
  );
}
