"use client";

export default function AlertInboxTabs({ value, onChange }: {
  value: string;
  onChange?: (value: "unacknowledged" | "open" | "all") => void;
}) {
  return <div className="alert-inbox-tabs" aria-label="알림 보기">
    {(["unacknowledged", "open", "all"] as const).map(tab => <button key={tab} type="button"
      aria-pressed={tab === (value === "failed" || value === "skipped" ? "all" : value)}
      disabled={!onChange} onClick={() => onChange?.(tab)}>
      {tab === "unacknowledged" ? "확인 필요" : tab === "open" ? "진행 중" : "전체 기록"}
    </button>)}
  </div>;
}
