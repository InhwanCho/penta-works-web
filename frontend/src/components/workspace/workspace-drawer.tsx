"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type PointerEvent } from "react";

import { useMobileWorkspace } from "@/hooks/use-mobile-workspace";

let openDrawers = 0;
let previousBodyOverflow = "";

/** Shared bottom drawer. Native dialogs preserve focus and Escape behavior when stacked. */
export default function WorkspaceDrawer({ title, onClose, onBack, onOpenDetail, children, className = "" }: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  onOpenDetail?: (href: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const mobile = useMobileWorkspace();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const gesture = useRef<{ id: number; y: number; at: number } | null>(null);
  const [offset, setOffset] = useState(0);
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
      {onBack && <button type="button" className="drawer-back" onClick={onBack} aria-label="이전 상세로">‹</button>}
      <h2 id={titleId}>{title}</h2>
      <button type="button" className="day-close" onClick={onClose} aria-label={`${title} 닫기`}>×</button>
    </header>
    <div className={mobile ? "workspace-drawer-content" : `workspace-dialog-content${className ? "" : " work-day-body"}`} onClickCapture={event => {
      if (!mobile || !onOpenDetail || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const link = event.target.closest("a");
      const href = link?.getAttribute("href");
      if (!href || link?.target === "_blank") return;
      if (/^\/work\/\d+$/.test(href) || /^\/sites\/[^/?#]+(?:#inspection-plan)?$/.test(href) || (/^\/schedule\?/.test(href) && !/[?&](new|edit)=/.test(href))) {
        event.preventDefault();
        event.stopPropagation();
        onOpenDetail(href);
      }
    }}>{children}</div>
  </dialog>;
}
