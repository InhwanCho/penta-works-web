export function orderHospitalDirectory<T extends { siteDb: string; name: string | null }>(sites: T[], monitoringIds: Set<string>): T[] {
  return [...sites].sort((a, b) => Number(monitoringIds.has(b.siteDb)) - Number(monitoringIds.has(a.siteDb)) ||
    (a.name || a.siteDb).localeCompare(b.name || b.siteDb, "ko", { numeric: true }) || a.siteDb.localeCompare(b.siteDb));
}
