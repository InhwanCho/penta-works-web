"use client";

import { useEffect } from "react";

export default function PwaProvider() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Browsers with unavailable storage can continue using the normal online app.
      });
    };
    // Keep service worker installation off the initial rendering path.
    const timer = window.setTimeout(register, 2000);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
