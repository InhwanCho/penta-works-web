import { NextResponse } from "next/server";
import { getDashboardData } from "../dashboard/service";
import { BASELINE_MAP, getBaselineRange } from "@/lib/baseline-map";

export const dynamic = "force-dynamic";

type AlertPayload = {
  name: string;
  current: number;
  baseline: number;
  min: number;
  max: number;
  diffPct: number; // 기준값 대비 편차(%)
  direction: "low" | "high";
};

/**
 * 허용 범위를 벗어난 병원을 하나의 섹션에 컴팩트하게 나열합니다.
 */
function buildSlackBlocks(alerts: AlertPayload[]) {
  const lines = alerts.map((a) => {
    const arrow = a.direction === "high" ? "▲" : "▼";
    const sign = a.direction === "high" ? "+" : "-";
    return `${arrow} *${a.name}*  \`${a.current}\`  _(기준 ${a.baseline}, ${sign}${a.diffPct.toFixed(1)}%)_`;
  });

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `hePsi 이상 감지 (${alerts.length}건)`,
        emoji: false,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: lines.join("\n"),
      },
    },
  ];
}

/** Slack 알림이 실패해도 fallback text만 보여줄 수 있도록 요약 문자열 생성 */
function buildFallbackText(alerts: AlertPayload[]) {
  const lines = alerts.map((a) => {
    const arrow = a.direction === "high" ? "▲" : "▼";
    return `${arrow} ${a.name}: ${a.current} (기준 ${a.baseline}, 범위 ${a.min.toFixed(2)}~${a.max.toFixed(2)})`;
  });
  return `[hePsi 이상 감지 ${alerts.length}건]\n${lines.join("\n")}`;
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    // fetch 대신 함수 직접 실행!
    const data = await getDashboardData();

    const rows = data.rows ?? [];
    const alerts: AlertPayload[] = [];

    for (const r of rows) {
      if (!r.name) continue;

      const baseline = BASELINE_MAP[r.name];
      // 매핑된 기준값이 없는 병원(수원참 등)은 건너뜀
      if (baseline === undefined) continue;

      const v = r.hePsi;
      // 수치가 0이거나 null이면 제외
      if (v == null || v === 0) continue;

      const { min, max } = getBaselineRange(baseline);

      // 허용 범위를 벗어난 경우 알림 메시지 생성
      if (v < min || v > max) {
        const direction: "low" | "high" = v > max ? "high" : "low";
        const diffPct = ((v - baseline) / baseline) * 100;
        alerts.push({
          name: r.name,
          current: v,
          baseline,
          min,
          max,
          diffPct: Math.abs(diffPct),
          direction,
        });
      }
    }

    // 알림 전송
    if (alerts.length > 0 && process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: buildFallbackText(alerts),
          blocks: buildSlackBlocks(alerts),
        }),
      });
    }

    return NextResponse.json({ ok: true, count: alerts.length, alerts });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
