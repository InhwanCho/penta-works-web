"use client";

import { forwardRef, type ComponentProps } from "react";

const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(
  function Select({ className = "", style, ...props }, ref) {
    return <span className="select-control" style={style}>
      <select {...props} ref={ref} className={className} />
      <svg className="select-control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m7 10 5 5 5-5" />
      </svg>
    </span>;
  },
);

export default Select;
