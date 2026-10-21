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
    // Next's layout/focus handler can run after the first reset during a route commit.
    const frame = requestAnimationFrame(() => {
      if (!hasScrollTarget()) scrollPageToTop();
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  return null;
}
