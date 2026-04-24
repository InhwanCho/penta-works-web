"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export type CtrlRange = {
  mrprel: number | null; // low psi
  mrpreh: number | null; // high psi
  mrlevl: number | null; // low %
  mrlevh: number | null; // high %
};

export type SiteRow = {
  siteDb: string;
  siteSlug: string;
  name: string | null;
  lastAt: string | null; // ISO
  hePsi: number | null;
  hePct: number | null;
};

export type DashboardResponse = {
  meta: {
    nowMs: number;
    since1hMs: number;
    since24hMs: number;
  };
  stats: {
    totalSites: number;
    active1h: number;
    stale24h: number;
    total24hRecords: number;
  };
  rows: SiteRow[];
  ctrl: Record<string, CtrlRange>;
};

export const DASHBOARD_QUERY_KEY = ["dashboard"] as const;

/** 5분 주기 폴링 */
const DASHBOARD_REFETCH_INTERVAL = 5 * 60 * 1000;
/** 1분 경과 시 stale 로 취급 (포커스 복귀 시 1분 이내면 refetch 생략) */
const DASHBOARD_STALE_TIME = 60 * 1000;

async function fetchDashboard(): Promise<DashboardResponse> {
  const res = await fetch("/api/dashboard", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json();
}

/**
 * 대시보드 데이터 조회 훅.
 *
 * - 5분 주기 자동 폴링 (`refetchInterval`)
 * - 창 포커스 / 네트워크 재연결 시 자동 refetch
 * - 모바일 웹뷰에서 다른 앱 전환 후 복귀 시 즉시 refetch
 *   (`visibilitychange`, `pageshow` 이벤트 보강)
 * - 백그라운드에서는 폴링을 멈춰 배터리를 절약 (`refetchIntervalInBackground: false`)
 */
export function useDashboardQuery() {
  const query = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: fetchDashboard,
    staleTime: DASHBOARD_STALE_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });

  const { refetch } = query;

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refetch();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [refetch]);

  return query;
}
