import type { SiteRow, CtrlRange } from "@/hooks/use-dashboard-query";
import { isMetricOutOfRange, type MetricDef } from "@/lib/metrics";

export function hasRedDashboardValue(row: SiteRow, ctrl: Record<string, CtrlRange>, metrics: readonly MetricDef[]) {
  return metrics.some(metric => isMetricOutOfRange(row.metrics?.[metric.key] ?? null, metric.bound, ctrl[row.siteDb] ?? null));
}

export function dashboardRowStatus(row: SiteRow, ctrl: Record<string, CtrlRange>, metrics: readonly MetricDef[]): SiteRow["alertStatus"] {
  return row.alertStatus === "NORMAL" && hasRedDashboardValue(row, ctrl, metrics) ? "WARNING" : row.alertStatus;
}

function compareSite(a: SiteRow, b: SiteRow) {
  const aSlug = a.siteSlug ?? "", bSlug = b.siteSlug ?? "";
  const aIsNum = /^\d+$/.test(aSlug), bIsNum = /^\d+$/.test(bSlug);
  if (aIsNum && bIsNum) return Number(aSlug) - Number(bSlug);
  if (aIsNum) return -1;
  if (bIsNum) return 1;
  return aSlug.localeCompare(bSlug);
}

/** Use the same bounds as red cells, even before the notification scheduler creates an incident. */
export function sortDashboardRows(rows: readonly SiteRow[], ctrl: Record<string, CtrlRange>, metrics: readonly MetricDef[]) {
  const ranks = new Map(rows.map(row => [row.siteDb,
    hasRedDashboardValue(row, ctrl, metrics) ? 0
      : row.alertIssues.some(issue => issue.eventType === "LOW" || issue.eventType === "HIGH") ? 1
      : row.alertStatus === "NO_DATA" ? 2
      : row.alertStatus === "WARNING" ? 3
      : row.openAlertCount > 0 || row.unacknowledgedAlertCount > 0 ? 4 : 5,
  ]));
  return rows.slice().sort((a, b) => ranks.get(a.siteDb)! - ranks.get(b.siteDb)!
    || b.unacknowledgedAlertCount - a.unacknowledgedAlertCount || compareSite(a, b));
}
