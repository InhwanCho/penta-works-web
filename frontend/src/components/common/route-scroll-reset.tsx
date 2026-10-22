"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function hasScrollTarget() {
  return (
    !!window.location.hash ||
    new URLSearchParams(window.location.search).has("scrollTo")
  );
}

export function scrollPageToTop() {
  // Reset both roots: mobile browsers can scroll body instead of documentElement.
  const roots = new Set([document.scrollingElement, document.documentElement, document.body]);
  for (const root of roots) {
    if (!root) continue;
    root.scrollTop = 0;
    root.scrollLeft = 0;
  }
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

export default function RouteScrollReset() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    // Preserve links targeting an inspection section or a hospital in monitoring.
    if (hasScrollTarget()) return;
    scrollPageToTop();
    // Mobile momentum scrolling and late layout/focus restoration can outlive
    // the first frame. Bound retries to the transition and yield to user input.
    let stopped = false;
    const reset = () => {
      if (!stopped && !hasScrollTarget()) scrollPageToTop();
    };
    const frame = requestAnimationFrame(reset);
    const timers = [100, 300, 600].map((delay) => window.setTimeout(reset, delay));
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
    const events = ["touchstart", "pointerdown", "wheel", "keydown"] as const;
    events.forEach((event) => window.addEventListener(event, stop, { passive: true }));
    return () => {
      stop();
      events.forEach((event) => window.removeEventListener(event, stop));
    };
  }, [pathname]);
  return null;
}
