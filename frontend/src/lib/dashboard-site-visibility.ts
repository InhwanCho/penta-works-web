import type { SiteRow } from "@/hooks/use-dashboard-query";

export function visibleDashboardSites(rows: SiteRow[], hiddenSites: string[], linkedSite: string | null = null): SiteRow[] {
  const hidden = new Set(hiddenSites);
  return rows.filter(row => {
    const linked = linkedSite != null && (row.siteDb === linkedSite || row.siteSlug === linkedSite ||
      (/^\d+$/.test(linkedSite) && row.siteSlug === String(Number(linkedSite))));
    return linked || !hidden.has(row.siteDb);
  });
}
