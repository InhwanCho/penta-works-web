import { METRICS, type MetricDef, type MetricKey } from "@/lib/metrics";

export type DashboardColumnKey = MetricKey | "lastAt" | "count1h" | "count24h";
export type CompanyMetric = { key: DashboardColumnKey; displayName: string; unit: string | null; sortOrder: number; visible: boolean };
export const DEFAULT_COLUMN_ORDER: DashboardColumnKey[] = ["hepres", "heleve", "gctemp", "cctemp", "ccflow", "actemp", "achumi", "lastAt", "count1h", "count24h", "recosi", "recoru", "coldtp", "gcflow"];

export function dashboardColumns(config?: CompanyMetric[]) {
  const byKey = new Map(config?.map(column => [column.key, column]));
  return defaultCompanyMetrics().map(column => byKey.get(column.key) ?? column)
    .filter(column => column.visible).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function companyMetrics(config?: CompanyMetric[]): MetricDef[] {
  if (!config?.length) config = defaultCompanyMetrics();
  const byKey = new Map(config.map((metric) => [metric.key, metric]));
  return METRICS.filter((metric) => byKey.get(metric.key)?.visible !== false)
    .map((metric) => {
      const setting = byKey.get(metric.key);
      return setting ? { ...metric, label: setting.displayName, unit: setting.unit } : metric;
    })
    .sort((a, b) => (byKey.get(a.key)?.sortOrder ?? 0) - (byKey.get(b.key)?.sortOrder ?? 0));
}

export function defaultCompanyMetrics(): CompanyMetric[] {
  const metadataNames: Partial<Record<DashboardColumnKey, string>> = {lastAt: "최신 시각", count1h: "1시간 건수", count24h: "24시간 건수"};
  return DEFAULT_COLUMN_ORDER.map((key, index) => {
    const metric = METRICS.find(metric => metric.key === key);
    return { key, displayName: metric?.label ?? metadataNames[key] ?? key, unit: metric?.unit ?? null, sortOrder: index, visible: key !== "gcflow" };
  });
}
