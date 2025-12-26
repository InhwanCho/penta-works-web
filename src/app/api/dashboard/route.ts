import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CtrlRange = {
  // ctrl.mrplel/mrpleh = He Pressure(psi) 하한/상한으로 사용
  mrplel: number | null;
  mrpleh: number | null;

  // ctrl.mrlevl/mrlevh = He Level(%) 하한/상한으로 사용
  mrlevl: number | null;
  mrlevh: number | null;
};

type DashboardRow = {
  siteDb: string;
  siteSlug: string;
  name: string | null;
  lastAt: string | null; // ISO string

  // 기존 유지(프론트에서 안 쓰면 무시 가능)
  lagMin: number | null;
  count1h: number;
  count24h: number;

  // 대시보드 표시용
  hePsi: number | null;
  hePct: number | null;
};

type DashboardResponse = {
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

  // ctrl 범위: site별 설정
  ctrl: Record<string, CtrlRange>;

  // ctrl.site="000"을 기본값으로 쓰고 싶을 때
  ctrlDefault: CtrlRange | null;
};

function siteSlug(siteDb: string): string {
  if (/^\d+$/.test(siteDb)) return String(Number(siteDb));
  return siteDb;
}

function parseNumberLoose(v: string | null | undefined): number | null {
  if (!v) return null;
  const cleaned = v.trim().replace(/[^\d.+-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
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

  // 3) siteid별 최신 레코드에서 hepres/heleve 추출
  //    - siteid asc, date desc로 가져오고 siteid별 최초 1건만 사용
  const latestCandidates = await prisma.mrtb.findMany({
    where: { siteid: { not: null }, date: { not: null } },
    select: { siteid: true, date: true, hepres: true, heleve: true },
    orderBy: [{ siteid: "asc" }, { date: "desc" }],
  });

  const heMap = new Map<
    string,
    { hePsi: number | null; hePct: number | null }
  >();
  for (const r of latestCandidates) {
    const sid = r.siteid ?? "";
    if (!sid) continue;
    if (heMap.has(sid)) continue;

    heMap.set(sid, {
      hePsi: parseNumberLoose(r.hepres),
      hePct: parseNumberLoose(r.heleve),
    });
  }

  // 4) ctrl 범위: prisma.ctrl로 직접 조회 (db pull 결과 기준)
  const ctrlRows = await prisma.ctrl.findMany({
    select: {
      site: true,
      mrplel: true,
      mrpleh: true,
      mrlevl: true,
      mrlevh: true,
    },
  });

  const ctrl: Record<string, CtrlRange> = {};
  for (const r of ctrlRows) {
    ctrl[r.site] = {
      mrplel: parseNumberLoose(r.mrplel),
      mrpleh: parseNumberLoose(r.mrpleh),
      mrlevl: parseNumberLoose(r.mrlevl),
      mrlevh: parseNumberLoose(r.mrlevh),
    };
  }

  const ctrlDefault: CtrlRange | null = ctrl["000"] ?? null;

  // 5) rows 구성
  const rows: DashboardRow[] = sites.map((s) => {
    const lastAtDate = lastMap.get(s.site) ?? null;
    const lagMin = lastAtDate
      ? Math.max(0, Math.floor((nowMs - lastAtDate.getTime()) / 60000))
      : null;

    const he = heMap.get(s.site) ?? { hePsi: null, hePct: null };

    return {
      siteDb: s.site,
      siteSlug: siteSlug(s.site),
      name: s.name,
      lastAt: lastAtDate ? lastAtDate.toISOString() : null,
      lagMin,
      count1h: c1Map.get(s.site) ?? 0,
      count24h: c24Map.get(s.site) ?? 0,
      hePsi: he.hePsi,
      hePct: he.hePct,
    };
  });

  // 기존: lastAt 최신순
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

  const body: DashboardResponse = {
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

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
