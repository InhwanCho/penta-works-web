"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { readStoredSession } from "@/lib/auth";
import { useAuth } from "@/components/provider/auth-provider";
import { readDashboardSnapshot, writeDashboardSnapshot } from "@/lib/dashboard-snapshot";
import type { CtrlRange, MetricKey } from "@/lib/metrics";

export type { CtrlRange };

export type MetricValues = Record<MetricKey, number | null>;

export type SiteRow = {
  siteDb: string;
  siteSlug: string;
  name: string | null;
  lastAt: string | null; // ISO
  lagMin: number | null;
  count1h: number;
  count24h: number;
  hePsi: number | null;
  hePct: number | null;
  /** 관리자 뷰용 전체 지표 (최신 1건) */
  metrics: MetricValues;
  alertStatus: "NORMAL" | "WARNING" | "NO_DATA";
  openAlertCount: number;
  unacknowledgedAlertCount: number;
  alertIssues: {
    id: number;
    metricKey: MetricKey | "__data__";
    eventType: "LOW" | "HIGH" | "NO_DATA";
    message: string;
    occurredAt: string;
    acknowledged: boolean;
  }[];
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
    normalSites: number;
    warningSites: number;
    noDataSites: number;
    openAlerts: number;
  };
  rows: SiteRow[];
  ctrl: Record<string, CtrlRange>;
};

export const DASHBOARD_QUERY_KEY = ["dashboard"] as const;
export const RESTORED_DASHBOARD_UPDATED_AT = 1;

/** 5분 주기 폴링 */
const DASHBOARD_REFETCH_INTERVAL = 5 * 60 * 1000;
/** 1분 경과 시 stale 로 취급 (포커스 복귀 시 1분 이내면 refetch 생략) */
const DASHBOARD_STALE_TIME = 60 * 1000;

async function fetchDashboard(userId: number): Promise<DashboardResponse> {
  const data = await apiFetch<DashboardResponse>("/dashboard", { cache: "no-store" });
  if (readStoredSession()?.id === userId) writeDashboardSnapshot(userId, data);
  return data;
}

/**
 * 대시보드 데이터 조회 훅.
 *
 * - 5분 주기 자동 폴링 (`refetchInterval`)
 * - 창 포커스 / 네트워크 재연결 시 자동 refetch
 * - 백그라운드에서는 폴링을 멈춰 배터리를 절약 (`refetchIntervalInBackground: false`)
 */
export function useDashboardQuery() {
  const { session } = useAuth();
  const userId = session?.id;
  const query = useQuery({
    queryKey: [...DASHBOARD_QUERY_KEY, userId],
    queryFn: () => fetchDashboard(userId!),
    enabled: userId != null,
    initialData: () => userId == null ? undefined : readDashboardSnapshot(userId),
    initialDataUpdatedAt: RESTORED_DASHBOARD_UPDATED_AT,
    staleTime: DASHBOARD_STALE_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: "always",
  });

  return query;
}
