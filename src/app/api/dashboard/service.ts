import {
  CTRL_BOUNDS,
  type CtrlRange,
  METRIC_KEYS,
  type MetricKey,
} from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { toSiteSlug } from "@/lib/site";
import { Prisma } from "@/generated/prisma/client";

export type { CtrlRange };

/** mrtb 최신 1건의 지표값 묶음 */
export type MetricValues = Record<MetricKey, number | null>;

export type DashboardRow = {
  siteDb: string;
  siteSlug: string;
  name: string | null;
  lastAt: string | null;
  lagMin: number | null;
  count1h: number;
  count24h: number;
  hePsi: number | null;
  hePct: number | null;
  /** 관리자 뷰(엑셀 뷰)용 전체 지표. 최신 1건 기준. */
  metrics: MetricValues;
};

/** $queryRaw 결과 행 (mrtb 컬럼은 전부 varchar 이므로 문자열로 들어옵니다) */
type LatestMetricRow = { siteid: string | null } & Record<
  MetricKey,
  string | null
>;

function emptyMetrics(): MetricValues {
  return Object.fromEntries(METRIC_KEYS.map((k) => [k, null])) as MetricValues;
}

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
  rows: DashboardRow[];
  ctrl: Record<string, CtrlRange>;
  ctrlDefault: CtrlRange | null;
};

function parseNumberLoose(v: string | null | undefined): number | null {
  if (!v) return null;
  const cleaned = v.trim().replace(/[^\d.+-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export async function getDashboardData(): Promise<DashboardResponse> {
  const nowMs = Date.now();
  const since24h = new Date(nowMs - 24 * 60 * 60 * 1000);
  const since1h = new Date(nowMs - 1 * 60 * 60 * 1000);

  // 1) 사이트 마스터
  const sites = await prisma.site.findMany({
    select: { site: true, name: true },
    orderBy: { site: "asc" },
  });

  // 2) 최근 시각/카운트 (groupBy)
  const [lastBySite, count24hBySite, count1hBySite] = await Promise.all([
    prisma.mrtb.groupBy({
      by: ["siteid"],
      where: { siteid: { not: null }, date: { not: null } },
      _max: { date: true },
    }),
    prisma.mrtb.groupBy({
      by: ["siteid"],
      where: { siteid: { not: null }, date: { not: null, gte: since24h } },
      _count: { _all: true },
    }),
    prisma.mrtb.groupBy({
      by: ["siteid"],
      where: { siteid: { not: null }, date: { not: null, gte: since1h } },
      _count: { _all: true },
    }),
  ]);

  const lastMap = new Map<string, Date>();
  for (const r of lastBySite) {
    if (r.siteid && r._max.date) lastMap.set(r.siteid, r._max.date);
  }

  const c24Map = new Map<string, number>();
  for (const r of count24hBySite) {
    if (r.siteid) c24Map.set(r.siteid, r._count._all);
  }

  const c1Map = new Map<string, number>();
  for (const r of count1hBySite) {
    if (r.siteid) c1Map.set(r.siteid, r._count._all);
  }

  // 3) siteid별 최신 레코드 1건씩 조회.
  //    2)에서 이미 구한 (siteid, max(date)) 쌍을 그대로 찍어 가져옵니다.
  //    mrtb 전체를 받아 JS에서 추리던 이전 방식은 15만 행을 전송했는데,
  //    이 방식은 사이트 수(=22행)만 받으면서 전 지표를 함께 가져옵니다.
  const latestPairs = [...lastMap.entries()];

  const latestRows = latestPairs.length
    ? await prisma.$queryRaw<LatestMetricRow[]>`
        SELECT siteid, recosi, coldtp, recoru, hepres, heleve,
               actemp, achumi, gctemp, gcflow, cctemp, ccflow
        FROM mrtb
        WHERE (siteid, date) IN (${Prisma.join(
          latestPairs.map(([sid, d]) => Prisma.sql`(${sid}, ${d})`),
        )})
      `
    : [];

  const metricMap = new Map<string, MetricValues>();
  for (const r of latestRows) {
    const sid = r.siteid ?? "";
    if (!sid || metricMap.has(sid)) continue;

    metricMap.set(
      sid,
      Object.fromEntries(
        METRIC_KEYS.map((k) => [k, parseNumberLoose(r[k])]),
      ) as MetricValues,
    );
  }

  // 4) ctrl 범위: 8개 지표의 하한/상한을 모두 조회 (26행짜리 작은 테이블)
  const ctrlRows = await prisma.ctrl.findMany();

  const ctrl: Record<string, CtrlRange> = {};
  for (const r of ctrlRows) {
    ctrl[r.site] = Object.fromEntries(
      CTRL_BOUNDS.flatMap((b) => [
        [`${b}l`, parseNumberLoose(r[`${b}l`])],
        [`${b}h`, parseNumberLoose(r[`${b}h`])],
      ]),
    ) as CtrlRange;
  }

  const ctrlDefault: CtrlRange | null = ctrl["000"] ?? null;

  // 5) rows 구성
  const rows: DashboardRow[] = sites.map((s) => {
    const lastAtDate = lastMap.get(s.site) ?? null;
    const lagMin = lastAtDate
      ? Math.max(0, Math.floor((nowMs - lastAtDate.getTime()) / 60000))
      : null;

    const metrics = metricMap.get(s.site) ?? emptyMetrics();

    return {
      siteDb: s.site,
      siteSlug: toSiteSlug(s.site),
      name: s.name,
      lastAt: lastAtDate ? lastAtDate.toISOString() : null,
      lagMin,
      count1h: c1Map.get(s.site) ?? 0,
      count24h: c24Map.get(s.site) ?? 0,
      // 기존 기본 뷰가 쓰는 두 값은 metrics에서 그대로 파생시킵니다.
      hePsi: metrics.hepres,
      hePct: metrics.heleve,
      metrics,
    };
  });

  // 기존: lastAt 최신순 정렬
  rows.sort((a, b) => {
    const atA = a.lastAt ? Date.parse(a.lastAt) : 0;
    const atB = b.lastAt ? Date.parse(b.lastAt) : 0;
    return atB - atA;
  });

  // stats
  const totalSites = rows.length;
  const active1h = rows.filter(
    (r) => r.lastAt && Date.parse(r.lastAt) >= since1h.getTime(),
  ).length;

  const active24h = rows.filter(
    (r) => r.lastAt && Date.parse(r.lastAt) >= since24h.getTime(),
  ).length;

  const stale24h = totalSites - active24h;
  const total24hRecords = rows.reduce((acc, r) => acc + r.count24h, 0);

  return {
    meta: {
      nowMs,
      since1hMs: since1h.getTime(),
      since24hMs: since24h.getTime(),
    },
    stats: {
      totalSites,
      active1h,
      stale24h,
      total24hRecords,
    },
    rows,
    ctrl,
    ctrlDefault,
  };
}
