"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Native top-layer dialog also opens above an existing detail drawer. */
export default function PhotoModal({ children, onClose, onPrevious, onNext }: { children: ReactNode; onClose: () => void; onPrevious?: () => void; onNext?: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(<dialog ref={ref} className="photo-modal" aria-label="사진 확대"
    onKeyDown={event => {
      if (event.key === "ArrowLeft" && onPrevious) { event.preventDefault(); event.stopPropagation(); onPrevious(); }
      if (event.key === "ArrowRight" && onNext) { event.preventDefault(); event.stopPropagation(); onNext(); }
    }}
    onCancel={event => { event.preventDefault(); closeRef.current(); }}
    onClick={() => closeRef.current()}>
    <button type="button" className="photo-modal-close" aria-label="사진 닫기" onClick={event => { event.stopPropagation(); closeRef.current(); }}>×</button>
    {onPrevious && <button type="button" className="photo-modal-nav photo-modal-prev" aria-label="이전 사진" onClick={event => { event.stopPropagation(); onPrevious(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg></button>}
    {children}
    {onNext && <button type="button" className="photo-modal-nav photo-modal-next" aria-label="다음 사진" onClick={event => { event.stopPropagation(); onNext(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></button>}
  </dialog>, document.body);
}
