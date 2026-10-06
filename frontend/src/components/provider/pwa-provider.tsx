"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PwaProvider() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/accept-invite" || pathname === "/reset-password") return;
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => {
      void navigator.serviceWorker.register("/sw.js?v=2", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Browsers with unavailable storage can continue using the normal online app.
      });
    };
    // Keep service worker installation off the initial rendering path.
    const timer = window.setTimeout(register, 2000);
    return () => window.clearTimeout(timer);
  }, [pathname]);
  return null;
}
