/** Month rows follow the overview calendar: Sunday–Saturday, including the first partial week. */
export function groupRecentWorkByWeek<T extends { id: number; workDate: string }>(records: T[]) {
  const groups = new Map<string, { key: string; label: string; year: number; records: T[] }>();
  for (const record of [...records].sort((a, b) => b.workDate.localeCompare(a.workDate) || b.id - a.id)) {
    const [year, month, day] = record.workDate.slice(0, 10).split("-").map(Number);
    const offset = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const week = Math.floor((offset + day - 1) / 7) + 1;
    const key = `${year}-${String(month).padStart(2, "0")}-${week}`;
    const group = groups.get(key) || { key, label: `${month}월 ${week}주차`, year, records: [] };
    group.records.push(record);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Current calendar week plus four preceding weeks; independent of the viewed month. */
export function recentWorkWindow(today: string) {
  const date = new Date(today + "T00:00:00Z");
  const sunday = new Date(date);
  sunday.setUTCDate(date.getUTCDate() - date.getUTCDay());
  const from = new Date(sunday);
  from.setUTCDate(from.getUTCDate() - 28);
  const to = new Date(sunday);
  to.setUTCDate(to.getUTCDate() + 6);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}
