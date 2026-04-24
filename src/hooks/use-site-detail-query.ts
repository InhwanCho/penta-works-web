"use client";

import { useQuery } from "@tanstack/react-query";

export type SiteDetailRow = {
  index: number;
  date: string | null; // ISO
  hepres: number | null;
  heleve: number | null;
  actemp: number | null;
  achumi: number | null;
};

export type SiteDetailResponse = {
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
): Promise<SiteDetailResponse> {
  const res = await fetch(
    `/api/sites/${encodeURIComponent(slug)}?take=${take}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json();
}

/**
 * 사이트 상세 시계열 조회 훅.
 * - staleTime 10초 — 짧은 시간 내 재방문 시 캐시 히트
 */
export function useSiteDetailQuery(slug: string, take: number) {
  return useQuery({
    queryKey: ["siteDetail", slug, take] as const,
    queryFn: () => fetchSiteDetail(slug, take),
    staleTime: 10_000,
  });
}
