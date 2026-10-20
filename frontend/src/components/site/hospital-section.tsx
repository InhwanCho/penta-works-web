"use client";
import { useEffect, useState, type ReactNode } from "react";

/** Collapsed on narrow screens; desktop retains the full detail layout. */
export default function HospitalSection({ title, anchor, children }: { title: string; anchor: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const reveal = () => { if (window.location.hash === `#${anchor}`) setOpen(true); };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, [anchor]);
  return <section className="hospital-mobile-section">
    <button type="button" className="hospital-section-toggle" aria-expanded={open} aria-controls={`section-${anchor}`} onClick={() => setOpen(!open)}>
      <span>{title}</span><span aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
    <div id={`section-${anchor}`} className="hospital-section-content" data-open={open}>{children}</div>
  </section>;
}
