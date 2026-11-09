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
  hospitalId?: number | null;
  monitoringSiteId?: string | null;
  monitoringConnected?: boolean;
  slug: string;
  site: { siteDb: string; name: string | null };
  take: number;
  lastAt: string | null;
  rows: SiteDetailRow[];
  page?: number;
  totalCount?: number;
};

const MEASUREMENT_LIMIT = 100;

export function siteDetailQueryKey(slug: string, from: string | null, to: string | null) {
  return ["siteDetail", slug, MEASUREMENT_LIMIT, from, to] as const;
}

async function fetchSiteDetail(
  slug: string,
  from: string | null,
  to: string | null,
): Promise<SiteDetailResponse> {
  return apiFetch<SiteDetailResponse>(
    `/sites/${encodeURIComponent(slug)}?${new URLSearchParams(from && to ? {from, to, take: String(MEASUREMENT_LIMIT)} : {take: String(MEASUREMENT_LIMIT)})}`,
    { cache: "no-store" },
  );
}

/**
 * 사이트 상세 시계열 조회 훅.
 * - staleTime 10초 — 짧은 시간 내 재방문 시 캐시 히트
 */
export function useSiteDetailQuery(slug: string, from: string | null = null, to: string | null = null) {
  return useQuery({
    queryKey: siteDetailQueryKey(slug, from, to),
    queryFn: () => fetchSiteDetail(slug, from, to),
    staleTime: 10_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}
