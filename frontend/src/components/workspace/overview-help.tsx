"use client";
import { useId, useRef } from "react";
export default function OverviewHelp({ title, body }: { title: string; body: string }) {
 const id = useId();
 const button = useRef<HTMLButtonElement>(null);
 const bubbleRef = useRef<HTMLSpanElement>(null);
 return <span className="overview-help-wrap" onClick={event => event.stopPropagation()}>
  <button ref={button} type="button" className="overview-list-help work-help-button" aria-label={title} aria-controls={id} onClick={event => {
   event.preventDefault();
   const bubble = bubbleRef.current;
   if (!bubble) return;
   if (bubble.matches(":popover-open")) { bubble.hidePopover(); return; }
   bubble.showPopover();
   const rect = event.currentTarget.getBoundingClientRect();
   bubble.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - bubble.offsetWidth - 16))}px`;
   bubble.style.top = `${Math.max(8, rect.bottom + bubble.offsetHeight + 16 > window.innerHeight ? rect.top - bubble.offsetHeight - 8 : rect.bottom + 8)}px`;
  }}><span className="work-help-symbol" aria-hidden="true">?</span></button>
  <span ref={bubbleRef} id={id} popover="auto" className="overview-help-bubble"><strong>{title}</strong><span>{body}</span></span>
 </span>;
}
