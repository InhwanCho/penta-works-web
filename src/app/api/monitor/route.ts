import { NextResponse } from "next/server";
import { getDashboardData } from "../dashboard/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 🚀 fetch 대신 함수 직접 실행!
    const data = await getDashboardData();

    const rows = data.rows ?? [];

    // 타겟 병원
    const targetNames = ["순천향병", "일등병원"];

    // 조건 범위
    const MIN = 0.95;
    const MAX = 1.05;

    const alerts: string[] = [];

    for (const r of rows) {
      if (!r.name || !targetNames.includes(r.name)) continue;

      const v = r.hePsi;

      if (v == null) continue;

      if (v < MIN || v > MAX) {
        alerts.push(`${r.name} 이상 감지\nhePsi: ${v}\n범위: ${MIN} ~ ${MAX}`);
      }
    }

    // 알림 전송
    if (alerts.length > 0) {
      await fetch(process.env.SLACK_WEBHOOK_URL!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: alerts.join("\n\n"),
        }),
      });
    }

    return NextResponse.json({ ok: true, alerts });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
