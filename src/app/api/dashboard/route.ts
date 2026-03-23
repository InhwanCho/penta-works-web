import { NextResponse } from "next/server";
import { getDashboardData } from "./service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const body = await getDashboardData();

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "대시보드 데이터를 불러오는데 실패했습니다." },
      { status: 500 },
    );
  }
}
