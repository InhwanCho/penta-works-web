"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { MetricKey } from "@/lib/metrics";
import type { CompanyMetric } from "@/lib/company-metrics";

export type SiteDetailRow = Partial<Record<MetricKey, number | null>> & {
  index: number;
  date: string | null; // ISO
};

export type SiteDetailResponse = {
  metricConfig?: CompanyMetric[];
  slug: string;
  site: { siteDb: string; name: string | null };
  take: number;
  lastAt: string | null;
  rows: SiteDetailRow[];
};

/** take 값을 10~100 사이로 클램프 */
export function clampTake(raw: number) {
  return Math.min(Math.max(Number.isFinite(raw) ? raw : 50, 10), 100);
}

async function fetchSiteDetail(
  slug: string,
  take: number,
  from: string | null,
  to: string | null,
): Promise<SiteDetailResponse> {
  return apiFetch<SiteDetailResponse>(
    `/sites/${encodeURIComponent(slug)}?${new URLSearchParams(from && to ? {from, to} : {take: String(take)})}`,
    { cache: "no-store" },
  );
}

/**
 * 사이트 상세 시계열 조회 훅.
 * - staleTime 10초 — 짧은 시간 내 재방문 시 캐시 히트
 */
export function useSiteDetailQuery(slug: string, take: number, from: string | null = null, to: string | null = null) {
  return useQuery({
    queryKey: ["siteDetail", slug, take, from, to] as const,
    queryFn: () => fetchSiteDetail(slug, take, from, to),
    staleTime: 10_000,
  });
}
