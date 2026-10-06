"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Point = { x: number; y: number };
const STORAGE_KEY = "dashboard-mobile-tools-position";

export default function DraggableToolsButton({ children, expanded, onClick }: {
  children: ReactNode;
  expanded: boolean;
  onClick: () => void;
}) {
  const boundsRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<Point | null>(null);
  const gesture = useRef<{ pointerId: number; start: Point; origin: Point; moved: boolean; last: Point } | null>(null);
  const suppressClick = useRef(false);

  function clamp(point: Point): Point {
    const button = buttonRef.current;
    const bounds = boundsRef.current;
    if (!button || !bounds) return point;
    const style = getComputedStyle(bounds);
    const top = parseFloat(style.paddingTop) + 8;
    const bottom = parseFloat(style.paddingBottom);
    return {
      x: Math.max(8, Math.min(point.x, window.innerWidth - button.offsetWidth - 8)),
      y: Math.max(top, Math.min(point.y, window.innerHeight - button.offsetHeight - bottom)),
    };
  }

  useEffect(() => {
    try {
      const saved: Point = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) setPosition(clamp(saved));
    } catch { /* Use the default corner. */ }
    const resize = () => setPosition(current => current ? clamp(current) : null);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (!position) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(position)); } catch { /* Keep the current position. */ }
  }, [position]);

  return <div ref={boundsRef} className="pointer-events-none fixed inset-0 z-[45] pt-[calc(3.5rem+env(safe-area-inset-top,0px))] pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
    <button ref={buttonRef} type="button" aria-controls="dashboard-mobile-tools" aria-expanded={expanded} title="눌러 열기 · 드래그하여 위치 이동"
      style={position ? {left: position.x, top: position.y, right: "auto", bottom: "auto"} : undefined}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        suppressClick.current = false;
        gesture.current = {pointerId: event.pointerId, start: {x:event.clientX,y:event.clientY}, origin: {x:rect.left,y:rect.top}, last: {x:rect.left,y:rect.top}, moved: false};
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const drag = gesture.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.start.x;
        const dy = event.clientY - drag.start.y;
        if (!drag.moved && Math.hypot(dx, dy) < 8) return;
        drag.moved = true;
        drag.last = clamp({x:drag.origin.x+dx,y:drag.origin.y+dy});
        setPosition(drag.last);
      }}
      onPointerUp={event => {
        const drag = gesture.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        suppressClick.current = drag.moved;
        gesture.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { gesture.current = null; suppressClick.current = true; }}
      onClick={event => { if (event.detail === 0 || !suppressClick.current) onClick(); suppressClick.current = false; }}
      className="pointer-events-auto fixed right-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom,0px))] inline-flex w-max min-h-12 whitespace-nowrap touch-none select-none items-center gap-2 rounded-full border border-sky-200 bg-white px-4 text-sm font-bold text-sky-900 shadow-lg dark:border-sky-800 dark:bg-slate-800 dark:text-sky-100">
      {children}
    </button>
  </div>;
}
