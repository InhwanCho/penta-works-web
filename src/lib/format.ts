export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function fmtDate(v: unknown): string {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : (v as Date);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().replace("T", " ").slice(0, 19);
}

export function fmtTime(date: Date | null | undefined) {
  if (!date) return "-";
  // "yy,mm,dd 제거" → 시간만
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
