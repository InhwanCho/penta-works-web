"use client";
import { useEffect, useId, useRef } from "react";

export type ActionMenuItem = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};
export default function ActionMenu({ label, items }: { label: string; items: ActionMenuItem[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const id = useId();
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (ref.current?.open && event.target instanceof Node && !ref.current.contains(event.target)) ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        event.preventDefault();
        event.stopPropagation();
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    const another = (event: Event) => {
      if ((event as CustomEvent).detail !== id && ref.current) ref.current.open = false;
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    document.addEventListener("workspace-action-menu", another);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("workspace-action-menu", another);
    };
  }, [id]);
  return <details ref={ref} className="action-menu" onToggle={() => {
    if(ref.current?.open) document.dispatchEvent(new CustomEvent("workspace-action-menu", { detail: id }));
  }}>
    <summary aria-label={label}>⋮</summary>
    <div className="action-menu-items">
      {items.map((item) => <button key={item.label} type="button" disabled={item.disabled} className={item.danger ? "is-danger" : undefined} onClick={() => {
        if (ref.current) ref.current.open = false;
        item.onSelect();
      }}>{item.label}</button>)}
    </div>
  </details>;
}
