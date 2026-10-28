"use client";

import { type ReactNode } from "react";

/** Open on a single click, tap or native keyboard activation. */
export default function PhotoPreviewLink({ href, label, onOpen, className, children }: {
  href: string;
  label: string;
  onOpen?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return <a href={href} target="_blank" rel="noreferrer" className={`photo-preview-link ${className || ""}`} aria-label={`${label} · 확대`} title="클릭하거나 탭하면 확대됩니다"
    onClick={event => {
      event.preventDefault();
      if (event.detail > 1) return;
      if (onOpen) onOpen();
      else window.open(href, "_blank", "noopener,noreferrer");
    }}
  >{children}</a>;
}
