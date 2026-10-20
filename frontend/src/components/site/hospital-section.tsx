"use client";
import { useEffect, useState, type ReactNode } from "react";

/** Collapsed on narrow screens; desktop retains the full detail layout. */
export default function HospitalSection({ title, anchor, children, allScreens = false }: { title: string; anchor: string; children: ReactNode; allScreens?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const reveal = () => { if (window.location.hash === `#${anchor}`) setOpen(true); };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, [anchor]);
  return <section className={`hospital-mobile-section${allScreens ? " hospital-always-section" : ""}`}>
    <button type="button" className="hospital-section-toggle" aria-expanded={open} aria-controls={`section-${anchor}`} onClick={() => setOpen(!open)}>
      <span>{title}</span><svg className="hospital-section-chevron" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    <div id={`section-${anchor}`} className="hospital-section-content" data-open={open}>{children}</div>
  </section>;
}
