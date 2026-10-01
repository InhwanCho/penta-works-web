"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function DashboardScrollTo({
  offset = 120,
  onTargetRequested,
}: {
  offset?: number;
  onTargetRequested?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    const requestedSlug = sp.get("scrollTo")?.trim();
    if (!requestedSlug) return;
    onTargetRequested?.();
    const slug = /^\d+$/.test(requestedSlug) ? String(Number(requestedSlug)) : requestedSlug;

    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    const id = isDesktop ? `site-d-${slug}` : `site-m-${slug}`;

    let cancelled = false;
    const deadline = performance.now() + 5000;

    const tick = () => {
      if (cancelled) return;

      const gridRow = document.getElementById(`site-grid-${slug}`);
      const el = gridRow ?? document.getElementById(id);
      if (!el) {
        if (performance.now() < deadline) requestAnimationFrame(tick);
        return;
      }

      if (gridRow) {
        const scroller = gridRow.closest<HTMLElement>("[data-dashboard-scroll]");
        if (scroller) {
          window.scrollTo({
            top: Math.max(0, scroller.getBoundingClientRect().top + window.scrollY - offset),
            behavior: "smooth",
          });
          const headHeight = scroller.querySelector("thead")?.getBoundingClientRect().height ?? 60;
          scroller.scrollTo({
            top: scroller.scrollTop + gridRow.getBoundingClientRect().top - scroller.getBoundingClientRect().top - headHeight,
            left: 0,
            behavior: "smooth",
          });
        }
      } else {
        const y = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      }
      el.animate([{ outline: "2px solid #3b82f6", outlineOffset: "-2px" }, { outline: "2px solid transparent", outlineOffset: "-2px" }], { duration: 2200 });

      // URL에서 scrollTo 제거(다른 쿼리는 유지)
      const next = new URLSearchParams(sp.toString());
      next.delete("scrollTo");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };

    requestAnimationFrame(tick);

    return () => {
      cancelled = true;
    };
  }, [sp, pathname, router, offset, onTargetRequested]);

  return null;
}
