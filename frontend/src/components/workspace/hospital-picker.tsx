"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Hospital } from "./workspace-data";
export default function HospitalPicker({
  sites,
  value,
  onChange,
  optional = false,
}: {
  sites: Hospital[];
  value: string;
  onChange: (id: string) => void;
  optional?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const id = useId(),
    input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { dialog.current?.close(); document.body.style.overflow = previous; };
  }, [open]);
  const filtered = sites.filter((s) =>
    (s.name || s.siteDb).toLowerCase().includes(query.toLowerCase()),
  );
  const options = optional
    ? [{ siteDb: "", name: "병원과 관계없는 업무·일정" }, ...filtered]
    : filtered;
  function choose(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
    setActive(0);
  }
  return (
    <div
      className="work-hospital-picker"
    >
      <button
        type="button"
        className="work-input work-picker-trigger"
        aria-label="병원 선택"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${id}-dialog`}
        onClick={() => {
          setOpen(!open);
          setQuery("");
          setActive(0);
        }}
      >
        {sites.find((s) => s.siteDb === value)?.name ||
          (optional ? "병원과 관계없는 업무·일정" : "병원을 선택해주세요")}
        <span aria-hidden="true">⌄</span>
      </button>
      <dialog id={`${id}-dialog`} ref={dialog} className="work-picker-panel work-picker-dialog" aria-label="병원 선택" data-ptr-ignore
        onCancel={(e) => { e.preventDefault(); setOpen(false); }}
        onClick={(e) => { if(e.target !== e.currentTarget) return; const b=e.currentTarget.getBoundingClientRect(); if(e.clientX<b.left || e.clientX>b.right || e.clientY<b.top || e.clientY>b.bottom) setOpen(false); }}>
        {open && <>
          <div className="work-section picker-heading"><h2>병원 선택</h2><button type="button" aria-label="병원 선택 닫기" onClick={() => setOpen(false)}>×</button></div>
          <input
            autoFocus
            ref={input}
            className="work-input"
            placeholder="병원명 검색"
            aria-label="병원명 검색"
            role="combobox"
            aria-expanded="true"
            aria-controls={id}
            aria-activedescendant={
              options[active] ? `${id}-${active}` : undefined
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) =>
                  Math.max(
                    0,
                    Math.min(
                      options.length - 1,
                      i + (e.key === "ArrowDown" ? 1 : -1),
                    ),
                  ),
                );
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (options[active]) choose(options[active].siteDb);
              }
            }}
          />
          <ul
            id={id}
            role="listbox"
            aria-label="병원 목록"
          >
            {options.map((s, i) => (
              <li
                key={s.siteDb}
                id={`${id}-${i}`}
                role="option"
                aria-selected={s.siteDb === value}
                className={active === i ? "active" : ""}
              >
                <button
                  type="button"
                  onClick={() => choose(s.siteDb)}
                >
                  {s.name || s.siteDb}
                  {s.siteDb === value ? " ✓" : ""}
                </button>
              </li>
            ))}
            {!options.length && (
              <li className="work-hint">검색 결과가 없습니다.</li>
            )}
          </ul>
        </>}
      </dialog>
    </div>
  );
}
