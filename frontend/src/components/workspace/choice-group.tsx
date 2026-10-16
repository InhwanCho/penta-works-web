"use client";
import { useId } from "react";
export function ChoiceGroup({
  legend,
  value,
  onChange,
  options,
  compact = false,
}: {
  legend: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  compact?: boolean;
}) {
  const id = useId();
  return (
    <fieldset className={`work-radio-group ${compact ? "compact" : ""}`}>
      <legend>{legend}</legend>
      <div>
        {options.map(([v, label]) => (
          <label
            key={v}
            className={value === v ? "selected" : ""}
          >
            <input
              type="radio"
              name={id}
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
