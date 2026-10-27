"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PwaProvider() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/accept-invite" || pathname === "/reset-password") return;
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let disposed = false;
    let previouslyControlled = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    let pendingMenu: {href:string;at:number} | null = null;
    const menuNavigation = (event:Event) => {
      const href=(event as CustomEvent<unknown>).detail;
      if(typeof href==="string"&&["/","/overview","/hospitals","/baselines","/settings"].includes(href))pendingMenu={href,at:Date.now()};
    };
    const applyUpdate = () => {
      if (disposed || reloading) return;
      if (previouslyControlled) {
        reloading = true;
        // A cold-start update can arrive before Next commits the first menu click.
        // Continue to that approved destination instead of reloading the old page.
        if(pendingMenu&&Date.now()-pendingMenu.at<10_000&&pendingMenu.href!==window.location.pathname+(window.location.search||""))window.location.assign(pendingMenu.href);
        else window.location.reload();
      }
      previouslyControlled = true;
    };
    navigator.serviceWorker.addEventListener("controllerchange", applyUpdate);
    window.addEventListener("mreyes:menu-navigation",menuNavigation);
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
    window.addEventListener("pageshow", check);
    const timer = window.setTimeout(() => { void register(); }, 2000);
    const interval = window.setInterval(check, 5 * 60 * 1000);
    return () => {
      disposed = true;
      window.clearTimeout(timer); window.clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
      window.removeEventListener("pageshow", check);
      navigator.serviceWorker.removeEventListener("controllerchange", applyUpdate);
      window.removeEventListener("mreyes:menu-navigation",menuNavigation);
      registration?.removeEventListener("updatefound", found);
      installing?.removeEventListener("statechange", changed);
    };
  }, [pathname]);
  return null;
}
