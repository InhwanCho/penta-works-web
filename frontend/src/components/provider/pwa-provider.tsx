"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PwaProvider() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/accept-invite" || pathname === "/reset-password") return;
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    const changed = () => {
      if (!disposed && registration?.waiting) registration.waiting.postMessage({type:"SKIP_WAITING"});
    };
    const found = () => {
      installing?.removeEventListener("statechange", changed);
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", changed);
    };
    const check = () => {
      if (document.visibilityState === "visible") void registration?.update().catch(() => {});
    };
    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js?v=2", {scope:"/", updateViaCache:"none"});
        if (disposed) return;
        changed(); found();
        registration.addEventListener("updatefound", found);
      } catch { /* Continue online if browser storage is unavailable. */ }
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    const timer = window.setTimeout(() => { void register(); }, 2000);
    const interval = window.setInterval(check, 5 * 60 * 1000);
    return () => {
      disposed = true;
      window.clearTimeout(timer); window.clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
      registration?.removeEventListener("updatefound", found);
      installing?.removeEventListener("statechange", changed);
    };
  }, [pathname]);
  return null;
}
