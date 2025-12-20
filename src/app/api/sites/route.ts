import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sites = await prisma.site.findMany({
    select: { site: true, name: true },
    orderBy: { site: "asc" },
  });

  return NextResponse.json(
    sites.map((s) => ({
      siteDb: s.site,
      name: s.name,
    })),
  );
}
