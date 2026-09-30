import { METRICS, type MetricDef, type MetricKey } from "@/lib/metrics";

export type CompanyMetric = { key: MetricKey; displayName: string; unit: string | null; sortOrder: number; visible: boolean };

export function companyMetrics(config?: CompanyMetric[]): MetricDef[] {
  if (!config?.length) return [...METRICS];
  const byKey = new Map(config.map((metric) => [metric.key, metric]));
  return METRICS.filter((metric) => byKey.get(metric.key)?.visible !== false)
    .map((metric) => {
      const setting = byKey.get(metric.key);
      return setting ? { ...metric, label: setting.displayName, unit: setting.unit } : metric;
    })
    .sort((a, b) => (byKey.get(a.key)?.sortOrder ?? 0) - (byKey.get(b.key)?.sortOrder ?? 0));
}

export function defaultCompanyMetrics(): CompanyMetric[] {
  return METRICS.map((metric, index) => ({ key: metric.key, displayName: metric.label ?? metric.code, unit: metric.unit, sortOrder: index, visible: true }));
}
