"use client";

import { useLayoutEffect, useRef } from "react";
import CircleLoader from "@/components/icons/circle-loader";

/** Center within the usable page area, below any heading and above mobile navigation. */
export default function PageLoader({ as: Tag = "div" }: { as?: "main" | "div" }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const navigation = document.querySelector<HTMLElement>(".workspace-bottom");
    const parent = element.parentElement;
    const measure = () => {
      const top = Math.max(0, element.getBoundingClientRect().top + window.scrollY);
      const bottom = navigation?.getBoundingClientRect().height ?? 0;
      const padding = parent ? parseFloat(getComputedStyle(parent).paddingBottom) || 0 : 0;
      element.style.setProperty("--page-loader-top", `${top}px`);
      element.style.setProperty("--page-loader-bottom", `${bottom + padding}px`);
    };
    const observer = new ResizeObserver(measure);
    if (navigation) observer.observe(navigation);
    if (parent) observer.observe(parent);
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, []);
  return <Tag ref={ref} className="page-loading-region" aria-busy="true"><CircleLoader size="m" inline /></Tag>;
}
