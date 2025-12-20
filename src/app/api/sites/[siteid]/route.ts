import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function findSiteBySlug(slug: string) {
  const isNumeric = /^\d+$/.test(slug);
  const candidates = isNumeric ? [slug, slug.padStart(3, "0")] : [slug];

  return prisma.site.findFirst({
    where: { site: { in: candidates } },
    select: { site: true, name: true },
  });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ siteid: string }> },
) {
  const { siteid: slug } = await ctx.params;

  const url = new URL(req.url);

  const takeParam = url.searchParams.get("take");
  const takeRaw = Number(takeParam ?? 200);
  const take = Math.min(
    Math.max(Number.isFinite(takeRaw) ? takeRaw : 200, 50),
    1000,
  );

  const site = await findSiteBySlug(slug);
  if (!site) {
    return NextResponse.json(
      { message: "Not Found" },
      {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const rows = await prisma.mrtb.findMany({
    where: { siteid: site.site, date: { not: null } },
    orderBy: { date: "desc" },
    take,
    select: {
      index: true,
      date: true,
      hepres: true,
      heleve: true,
      actemp: true,
      achumi: true,
    },
  });

  return NextResponse.json(
    {
      slug,
      site: { siteDb: site.site, name: site.name },
      take,
      lastAt: rows[0]?.date ? rows[0]!.date!.toISOString() : null,
      rows: rows.map((r) => ({
        index: r.index,
        date: r.date ? r.date.toISOString() : null,
        hepres: toNumber(r.hepres),
        heleve: toNumber(r.heleve),
        actemp: toNumber(r.actemp),
        achumi: toNumber(r.achumi),
      })),
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
