"use client";

import { useRef, type ReactNode } from "react";

/** Two pointer clicks/taps open a photo; native keyboard activation stays accessible. */
export default function PhotoPreviewLink({ href, label, onOpen, className, children }: {
  href: string;
  label: string;
  onOpen?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const previousClick = useRef<number | null>(null);
  return <a href={href} target="_blank" rel="noreferrer" className={`photo-preview-link ${className || ""}`} aria-label={`${label} · 두 번 눌러 확대`} title="두 번 클릭하거나 탭하면 확대됩니다"
    onClick={event => {
      event.preventDefault();
      const previous = previousClick.current;
      const twice = event.detail === 2 || (previous !== null && event.timeStamp >= previous && event.timeStamp - previous <= 500);
      if (event.detail === 0 || twice) {
        previousClick.current = null;
        if (onOpen) onOpen();
        else window.open(href, "_blank", "noopener,noreferrer");
      } else previousClick.current = event.timeStamp;
    }}
    onDoubleClick={event => event.preventDefault()}
  >{children}</a>;
}
