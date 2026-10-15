"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Shared column widths keep the independently scrolling header and body aligned. */
export default function PageScrollTable({ heading, body, labels, name, columnWidths }: {heading: ReactNode; body: ReactNode; labels: string[]; name: string; columnWidths: string[]}) {
  const head = useRef<HTMLDivElement>(null), rows = useRef<HTMLDivElement>(null);
  const columnsKey=labels.join("|");
  useLayoutEffect(() => {
    if(head.current && rows.current) head.current.scrollLeft=rows.current.scrollLeft;
  },[columnsKey]);
  const sync = (source: HTMLDivElement, target: HTMLDivElement | null) => {if (target && target.scrollLeft !== source.scrollLeft) target.scrollLeft = source.scrollLeft;};
  const style = {width:`calc(${columnWidths.join(" + ")})`,minWidth:'100%',tableLayout:'fixed' as const};
  const cols = <colgroup>{columnWidths.map((width,index)=><col key={index} style={{width}} />)}</colgroup>;
  return <div className="[--hospital-column:7rem] [--metric-column:9rem] [--policy-column:13rem] [--action-column:7rem] lg:[--hospital-column:11rem] lg:[--metric-column:13rem] lg:[--policy-column:15rem] lg:[--action-column:9rem]">
    <div className="dashboard-sticky-columns sticky z-30 bg-slate-100 dark:bg-slate-800">
      <div data-ptr-ignore ref={head} onScroll={event=>sync(event.currentTarget,rows.current)} aria-label={`${name} 컬럼명`} tabIndex={0} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="border-separate border-spacing-0 text-sm lg:text-base" style={style}>{cols}{heading}</table>
      </div>
    </div>
    <div data-ptr-ignore ref={rows} onScroll={event=>sync(event.currentTarget,head.current)} tabIndex={0} role="region" aria-label={`${name} · 좌우로 스크롤`} className="dashboard-touch-scroll overflow-x-auto">
      <table className="border-separate border-spacing-0 text-sm lg:text-base" style={style}>
        {cols}<caption className="sr-only">{name}</caption><thead className="sr-only"><tr>{labels.map((label,index)=><th key={index} scope="col">{label}</th>)}</tr></thead>{body}
      </table>
    </div>
  </div>;
}
