"use client";

import { useId, useRef, useState } from "react";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (value: number) => String(value).padStart(2, "0");

/** A calendar owned by the page, independent of the device's native date picker. */
export default function PeriodDateTimePicker({ label, name, value, onChange }: {
  label: string; name: string; value: string; onChange: (value: string) => void;
}) {
  const id = useId();
  const picker = useRef<HTMLDetailsElement>(null);
  const [month, setMonth] = useState(value.slice(0, 7));
  const year = Number(month.slice(0, 4)), monthIndex = Number(month.slice(5, 7)) - 1;
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const dayCount = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const date = value.slice(0, 10), hour = value.slice(11, 13), minute = value.slice(14, 16);
  function moveMonth(offset: number) {
    const next = new Date(Date.UTC(year, monthIndex + offset, 1));
    setMonth(`${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`);
  }
  function selectDay(day: number) {
    onChange(`${month}-${pad(day)}T${hour}:${minute}`);
    if (picker.current) {
      picker.current.open = false;
      picker.current.querySelector("summary")?.focus();
    }
  }
  return <div className="period-date-time-picker">
    <span id={`${id}-label`} className="text-xs font-bold">{label}</span>
    <input type="hidden" name={name} value={value} />
    <details ref={picker} className="period-calendar" onToggle={event => {
      if (event.currentTarget.open) setMonth(value.slice(0, 7));
    }} onKeyDown={event => {
      if (event.key === "Escape" && picker.current) {
        event.preventDefault();
        picker.current.open = false;
        picker.current.querySelector("summary")?.focus();
      }
    }}>
      <summary aria-labelledby={`${id}-label ${id}-date`}>
        <span id={`${id}-date`}>{date.replaceAll("-", ". ")}</span>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/></svg>
      </summary>
      <div className="period-calendar-panel" role="group" aria-label={`${label} 날짜 선택`}>
        <div className="period-calendar-heading">
          <button type="button" aria-label="이전 달" onClick={() => moveMonth(-1)}>‹</button>
          <select aria-label={`${label} 연도`} value={year} onChange={event => setMonth(`${event.target.value}-${pad(monthIndex + 1)}`)}>
            {Array.from({length: 201}, (_, i) => 1900 + i).map(item => <option key={item} value={item}>{item}년</option>)}
          </select>
          <select aria-label={`${label} 월`} value={monthIndex + 1} onChange={event => setMonth(`${year}-${pad(Number(event.target.value))}`)}>
            {Array.from({length: 12}, (_, i) => i + 1).map(item => <option key={item} value={item}>{item}월</option>)}
          </select>
          <button type="button" aria-label="다음 달" onClick={() => moveMonth(1)}>›</button>
        </div>
        <div className="period-calendar-days">
          {weekdays.map(day => <span key={day} className="period-calendar-weekday" aria-hidden="true">{day}</span>)}
          {Array.from({length: firstWeekday}, (_, i) => <span key={`blank-${i}`} />)}
          {Array.from({length: dayCount}, (_, i) => i + 1).map(day => <button type="button" key={day}
            aria-label={`${year}년 ${monthIndex + 1}월 ${day}일`}
            aria-pressed={date === `${month}-${pad(day)}`} onClick={() => selectDay(day)}>{day}</button>)}
        </div>
      </div>
    </details>
    <div className="period-picker-time" role="group" aria-label={`${label} 시간 선택`}>
      <select aria-label={`${label} 시`} value={hour} onChange={event => onChange(`${date}T${event.target.value}:${minute}`)}>
        {Array.from({length: 24}, (_, i) => pad(i)).map(item => <option key={item} value={item}>{item}시</option>)}
      </select>
      <span aria-hidden="true">:</span>
      <select aria-label={`${label} 분`} value={minute} onChange={event => onChange(`${date}T${hour}:${event.target.value}`)}>
        {Array.from({length: 60}, (_, i) => pad(i)).map(item => <option key={item} value={item}>{item}분</option>)}
      </select>
    </div>
  </div>;
}
