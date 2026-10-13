import type { SiteRow } from "@/hooks/use-dashboard-query";

export function visibleDashboardSites(rows: SiteRow[], hiddenSites: string[]): SiteRow[] {
  const hidden = new Set(hiddenSites);
  return rows.filter(row => !hidden.has(row.siteDb));
}
