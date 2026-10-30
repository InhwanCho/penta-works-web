"use client";
import { useId, useRef } from "react";
export default function OverviewHelp({ title, body }: { title: string; body: string }) {
 const id = useId();
 const button = useRef<HTMLButtonElement>(null);
 return <span className="overview-help-wrap" onClick={event => event.stopPropagation()}>
  <button ref={button} type="button" className="overview-list-help work-help-button" aria-label={title} popoverTarget={id}><span className="work-help-symbol" aria-hidden="true">?</span></button>
  <span id={id} popover="auto" className="overview-help-bubble" onToggle={event => {
   const bubble = event.currentTarget;
   if (!bubble.matches(":popover-open") || !button.current) return;
   const rect = button.current.getBoundingClientRect();
   bubble.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - bubble.offsetWidth - 16))}px`;
   bubble.style.top = `${Math.max(8, rect.bottom + bubble.offsetHeight + 16 > window.innerHeight ? rect.top - bubble.offsetHeight - 8 : rect.bottom + 8)}px`;
  }}><strong>{title}</strong><span>{body}</span></span>
 </span>;
}
