const koreanDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });

/** Calendar-day difference in Korea, independent of browser time zone and time of day. */
export function relativeDayLabel(value: string, now = new Date()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return "";
  const parts = koreanDate.formatToParts(now);
  const part = (key: string) => Number(parts.find(p => p.type === key)?.value);
  const day = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = Date.UTC(part("year"), part("month") - 1, part("day"));
  const days = Math.round((today - day) / 86_400_000);
  return days === 0 ? "(오늘)" : days > 0 ? `(${days}일 전)` : `(${-days}일 후)`;
}
