"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Native top-layer dialog also opens above an existing detail drawer. */
export default function PhotoModal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
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
    onCancel={event => { event.preventDefault(); closeRef.current(); }}
    onClick={() => closeRef.current()}>
    <button type="button" className="photo-modal-close" aria-label="사진 닫기" onClick={event => { event.stopPropagation(); closeRef.current(); }}>×</button>
    {children}
  </dialog>, document.body);
}
