"use client";

import { type ComponentProps, useLayoutEffect, useRef } from "react";
import { formatPhone, phoneDigits } from "@/lib/phone";

type Props = Omit<ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type" | "inputMode" | "maxLength"> & {
  value: string | null | undefined;
  onValueChange: (digits: string) => void;
};

export default function PhoneInput({ value, onValueChange, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const formatted = formatPhone(value);

  useLayoutEffect(() => {
    if (pendingCaret.current !== null && input.current) {
      input.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  });

  function change(raw: string, digitsBeforeCaret: number) {
    const digits = phoneDigits(raw);
    const display = formatPhone(digits);
    let caret = 0, count = 0;
    while (caret < display.length && count < digitsBeforeCaret) {
      if (/[0-9]/.test(display[caret])) count++;
      caret++;
    }
    pendingCaret.current = caret;
    // Restore the cursor even when stripping letters leaves the value unchanged.
    if (input.current) {
      input.current.value = display;
      input.current.setSelectionRange(caret, caret);
    }
    onValueChange(digits);
  }

  return <input {...props} ref={input} type="tel" inputMode="numeric" autoComplete={props.autoComplete ?? "tel"} value={formatted}
    onChange={event => change(event.target.value, phoneDigits(event.target.value.slice(0, event.target.selectionStart ?? event.target.value.length)).length)}
    onKeyDown={event => {
      props.onKeyDown?.(event);
      if (event.defaultPrevented) return;
      const { selectionStart: start, selectionEnd: end } = event.currentTarget;
      if (start === null || start !== end) return;
      if (event.key === "Backspace" && formatted[start - 1] === "-") {
        event.preventDefault();
        change(formatted.slice(0, start - 2) + formatted.slice(start), phoneDigits(formatted.slice(0, start - 2)).length);
      } else if (event.key === "Delete" && formatted[start] === "-") {
        event.preventDefault();
        change(formatted.slice(0, start) + formatted.slice(start + 2), phoneDigits(formatted.slice(0, start)).length);
      }
    }} />;
}
