"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Separate sticky headings from horizontal overflow; page owns vertical scrolling. */
export default function PageScrollTable({ heading, body, labels, name }: {heading: ReactNode; body: ReactNode; labels: string[]; name: string}) {
  const head = useRef<HTMLDivElement>(null), rows = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<number[]>([]);
  useLayoutEffect(() => {
    if (!head.current || !rows.current) return;
    const measure = () => {
      const headings = head.current?.querySelectorAll('th');
      const cells = rows.current?.querySelector('tbody tr')?.children;
      if (!headings || !cells || cells.length !== headings.length) return;
      const next = Array.from(headings, (cell, index) => Math.ceil(Math.max(cell.getBoundingClientRect().width, cells[index].getBoundingClientRect().width)));
      setWidths(old => old.length === next.length && old.every((width, index) => width === next[index]) ? old : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(head.current); observer.observe(rows.current); measure();
    const resize = () => setWidths([]);
    window.addEventListener('resize', resize);
    return () => {observer.disconnect(); window.removeEventListener('resize', resize);};
  }, [heading, body, widths.length]);
  const sync = (source: HTMLDivElement, target: HTMLDivElement | null) => {if (target && target.scrollLeft !== source.scrollLeft) target.scrollLeft = source.scrollLeft;};
  const style = widths.length === labels.length ? {width:widths.reduce((a,b)=>a+b,0),minWidth:'100%',tableLayout:'fixed' as const} : undefined;
  const cols = widths.length === labels.length ? <colgroup>{widths.map((width,index)=><col key={index} style={{width}} />)}</colgroup> : null;
  return <>
    <div className="dashboard-sticky-columns sticky z-30 bg-slate-100 dark:bg-slate-800">
      <div ref={head} onScroll={event=>sync(event.currentTarget,rows.current)} aria-label={`${name} 컬럼명`} tabIndex={0} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full border-separate border-spacing-0 text-sm sm:text-base" style={style}>{cols}{heading}</table>
      </div>
    </div>
    <div ref={rows} onScroll={event=>sync(event.currentTarget,head.current)} tabIndex={0} role="region" aria-label={`${name} · 좌우로 스크롤`} className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm sm:text-base" style={style}>
        {cols}<caption className="sr-only">{name}</caption><thead className="sr-only"><tr>{labels.map((label,index)=><th key={index} scope="col">{label}</th>)}</tr></thead>{body}
      </table>
    </div>
  </>;
}
