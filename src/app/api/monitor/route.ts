import { NextResponse } from "next/server";
import { getDashboardData } from "../dashboard/service";

export const dynamic = "force-dynamic";

// 각 병원별 기준값 세팅 (실제 API 데이터의 name 기준)
const BASELINE_MAP: Record<string, number> = {
  순천향병: 1.0,
  일등병원: 1.0,
  휴내과: 0.5,
  더퍼스트: 1.0,
  서울프라: 1.0,
  연세고든: 3.4,
  강북우리: 1.0,
  신당서울: 1.0,
  으랏차: 1.0,
  // "수원참": x (제외)
  새길병원: 1.0,
  강동참: 1.0,
  수원SS: 2.2,
  S신경2: 2.0,
  S신경1: 1.0,
  대구동물: 0.5,
  신사우리: 1.0,
};

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    // fetch 대신 함수 직접 실행!
    const data = await getDashboardData();

    const rows = data.rows ?? [];
    const alerts: string[] = [];

    for (const r of rows) {
      if (!r.name) continue;

      const baseline = BASELINE_MAP[r.name];
      // 매핑된 기준값이 없는 병원(수원참 등)은 건너뜀
      if (baseline === undefined) continue;

      const v = r.hePsi;
      if (v == null) continue;

      // 기준값에서 +/- 20% 계산
      const min = baseline * 0.8;
      const max = baseline * 1.2;

      // 허용 범위를 벗어난 경우 알림 메시지 생성
      if (v < min || v > max) {
        alerts.push(
          `!! *${r.name} 이상 감지*\n !!` +
            `• 현재 hePsi: *${v}*\n` +
            `• 기준값: ${baseline}\n` +
            `• 허용범위: ${min.toFixed(2)} ~ ${max.toFixed(2)}`,
        );
      }
    }

    // 알림 전송
    if (alerts.length > 0) {
      await fetch(process.env.SLACK_WEBHOOK_URL!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: alerts.join("\n\n---\n\n"), // 여러 병원 알림 시 구분선 추가
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
