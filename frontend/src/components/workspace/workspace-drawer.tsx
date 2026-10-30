"use client";

import { useEffect, useLayoutEffect, useId, useRef, useState, type ReactNode, type PointerEvent } from "react";

import { isWorkspaceOverlay, openWorkspaceOverlay } from "./overlay-navigation";
import { useMobileWorkspace } from "@/hooks/use-mobile-workspace";

let openDrawers = 0;
let previousBodyOverflow = "";

/** Shared bottom drawer. Native dialogs preserve focus and Escape behavior when stacked. */
export default function WorkspaceDrawer({ title, onClose, onBack, onOpenDetail, scrollKey, children, className = "" }: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  onOpenDetail?: (href: string) => void;
  scrollKey?: string;
  children: ReactNode;
  className?: string;
}) {
  const mobile = useMobileWorkspace();
  const ref = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  const gesture = useRef<{ id: number; y: number; at: number } | null>(null);
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    // A detail link reuses this drawer; reset its scroll containers, not the page behind it.
    for (const node of [ref.current, contentRef.current]) {
      if (node) { node.scrollTop = 0; node.scrollLeft = 0; }
    }
  }, [scrollKey]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    if (openDrawers++ === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    dialog.showModal();
    dialog.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (--openDrawers === 0) document.body.style.overflow = previousBodyOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  // iOS pans the visual viewport when the keyboard opens. Keep the header
  // within that viewport and let only the content area scroll to the field.
  useEffect(() => {
    const dialog = ref.current;
    const viewport = window.visualViewport;
    if (!mobile || !dialog || !viewport) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        dialog.style.setProperty("--drawer-viewport-top", `${viewport.offsetTop + viewport.height * 0.15}px`);
        dialog.style.setProperty("--drawer-viewport-height", `${Math.max(0, viewport.height * 0.85)}px`);
      });
    };
    measure();
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
      dialog.style.removeProperty("--drawer-viewport-top");
      dialog.style.removeProperty("--drawer-viewport-height");
    };
  }, [mobile]);
  useEffect(() => {
    const content = contentRef.current;
    if (!mobile || !content) return;
    let start: { id: number; x: number; y: number; at: number; dragging: boolean } | null = null;
    const reset = () => { start = null; setOffset(0); };
    const touchStart = (event: TouchEvent) => {
      suppressClick.current = false;
      if (event.touches.length !== 1 || content.scrollTop > 0) { reset(); return; }
      const target = event.target;
      if (!(target instanceof Element) || target.closest("button,input,textarea,select,label,summary,[contenteditable=true]")) return;
      // An inner list/table must retain its own scrolling and swipe behavior.
      for (let element = target; element !== content && element.parentElement; element = element.parentElement) {
        if (element.scrollTop > 0 || element.scrollWidth > element.clientWidth + 1) return;
      }
      const touch = event.touches[0];
      start = { id: touch.identifier, x: touch.clientX, y: touch.clientY, at: event.timeStamp, dragging: false };
    };
    const touchMove = (event: TouchEvent) => {
      if (!start) return;
      if (event.touches.length !== 1) { reset(); return; }
      const touch = event.touches[0];
      if (touch.identifier !== start.id) return;
      const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
      if (!start.dragging && (dy < -8 || Math.abs(dx) > Math.max(8, dy))) { reset(); return; }
      if (dy > 8 && Math.abs(dy) > Math.abs(dx)) {
        if (!event.cancelable) { reset(); return; }
        event.preventDefault();
        start.dragging = true;
        suppressClick.current = true;
        setOffset(Math.max(0, dy));
      }
    };
    const touchEnd = (event: TouchEvent) => {
      const touch = Array.from(event.changedTouches).find(touch => touch.identifier === start?.id);
      if (start?.dragging && touch) {
        const distance = touch.clientY - start.y;
        const duration = Math.max(1, event.timeStamp - start.at);
        if (distance >= 40 || (distance >= 18 && distance / duration >= 0.45)) closeRef.current();
      }
      reset();
    };
    content.addEventListener("touchstart", touchStart, { passive: true });
    content.addEventListener("touchmove", touchMove, { passive: false });
    content.addEventListener("touchend", touchEnd);
    content.addEventListener("touchcancel", reset);
    return () => {
      content.removeEventListener("touchstart", touchStart);
      content.removeEventListener("touchmove", touchMove);
      content.removeEventListener("touchend", touchEnd);
      content.removeEventListener("touchcancel", reset);
    };
  }, [mobile]);
  const dragHandlers = {
    onPointerDown(event: PointerEvent<HTMLDivElement | HTMLElement>) {
      if (!mobile) return;
      if (event.target instanceof Element && event.target.closest("button")) return;
      gesture.current = { id: event.pointerId, y: event.clientY, at: event.timeStamp };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLDivElement | HTMLElement>) {
      if (gesture.current?.id === event.pointerId) setOffset(Math.max(0, event.clientY - gesture.current.y));
    },
    onPointerUp(event: PointerEvent<HTMLDivElement | HTMLElement>) {
      const start = gesture.current?.id === event.pointerId ? gesture.current : null;
      const distance = start ? event.clientY - start.y : 0;
      const duration = start ? Math.max(1, event.timeStamp - start.at) : 0;
      gesture.current = null;
      setOffset(0);
      if (distance >= 40 || (distance >= 18 && duration > 0 && distance / duration >= 0.45)) onClose();
    },
    onPointerCancel() { gesture.current = null; setOffset(0); },
  };
  return <dialog ref={ref} className={`work-day-dialog ${mobile ? "workspace-drawer" : "workspace-desktop-dialog"} ${className}`} aria-labelledby={titleId} tabIndex={-1} data-ptr-ignore
    style={{ transform: offset ? `translateY(${offset}px)` : undefined }}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <div className={`workspace-drawer-grip${mobile ? "" : " hidden"}`} {...dragHandlers}><span /></div>
    <header {...dragHandlers}>
      {onBack && <button type="button" className="drawer-back" onClick={onBack} aria-label="이전 상세로">← 뒤로</button>}
      <h2 id={titleId}>{title}</h2>
      <button type="button" className="day-close" onClick={onClose} aria-label={`${title} 닫기`}>×</button>
    </header>
    <div ref={contentRef} className={mobile ? "workspace-drawer-content" : `workspace-dialog-content${className ? "" : " work-day-body"}`} onClickCapture={event => {
      if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); event.stopPropagation(); return; }
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const link = event.target.closest("a");
      const href = link?.getAttribute("href");
      if (!href || link?.target === "_blank") return;
      if (isWorkspaceOverlay(href)) { event.preventDefault(); event.stopPropagation(); openWorkspaceOverlay(href); return; }
      if (!onOpenDetail) return;
      if (/^\/work\/\d+$/.test(href) || /^\/sites\/[^/?#]+(?:#inspection-plan)?$/.test(href) || (/^\/schedule\?/.test(href) && !/[?&](new|edit)=/.test(href))) {
        event.preventDefault();
        event.stopPropagation();
        onOpenDetail(href);
      }
    }}>{children}</div>
  </dialog>;
}
