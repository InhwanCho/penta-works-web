import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type DashboardRow = {
  siteDb: string;
  siteSlug: string;
  name: string | null;
  lastAt: string | null; // ISO string
  lagMin: number | null;
  count1h: number;
  count24h: number;
};

function siteSlug(siteDb: string): string {
  if (/^\d+$/.test(siteDb)) return String(Number(siteDb));
  return siteDb;
}

export async function GET() {
  const nowMs = Date.now();
  const since24h = new Date(nowMs - 24 * 60 * 60 * 1000);
  const since1h = new Date(nowMs - 1 * 60 * 60 * 1000);

  const sites = await prisma.site.findMany({
    select: { site: true, name: true },
    orderBy: { site: "asc" },
  });

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

  const rows: DashboardRow[] = sites.map((s) => {
    const lastAtDate = lastMap.get(s.site) ?? null;
    const lagMin = lastAtDate
      ? Math.max(0, Math.floor((nowMs - lastAtDate.getTime()) / 60000))
      : null;

    return {
      siteDb: s.site,
      siteSlug: siteSlug(s.site),
      name: s.name,
      lastAt: lastAtDate ? lastAtDate.toISOString() : null,
      lagMin,
      count1h: c1Map.get(s.site) ?? 0,
      count24h: c24Map.get(s.site) ?? 0,
    };
  });

  rows.sort((a, b) => {
    const atA = a.lastAt ? Date.parse(a.lastAt) : 0;
    const atB = b.lastAt ? Date.parse(b.lastAt) : 0;
    return atB - atA;
  });

  const totalSites = rows.length;
  const active1h = rows.filter(
    (r) => r.lastAt && Date.parse(r.lastAt) >= since1h.getTime(),
  ).length;
  const active24h = rows.filter(
    (r) => r.lastAt && Date.parse(r.lastAt) >= since24h.getTime(),
  ).length;
  const stale24h = totalSites - active24h;
  const total24hRecords = rows.reduce((acc, r) => acc + r.count24h, 0);

  return NextResponse.json(
    {
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
    },
    {
      headers: {
        // 브라우저/프록시 캐시로 인한 “가끔 다른 값” 방지
        "Cache-Control": "no-store",
      },
    },
  );
}
