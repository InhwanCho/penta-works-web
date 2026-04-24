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
 * 허용 범위를 벗어난 경우 Slack Block Kit 메시지를 생성합니다.
 * 가독성을 위해 header / section(fields) / context 구조로 구성합니다.
 */
function buildSlackBlocks(alerts: AlertPayload[]) {
  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `hePsi 이상 감지 (${alerts.length}건)`,
        emoji: false,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `기준값 대비 ±20% 허용범위를 벗어난 병원 목록입니다. · ${new Date().toLocaleString(
            "ko-KR",
            { timeZone: "Asia/Seoul" },
          )}`,
        },
      ],
    },
    { type: "divider" },
  ];

  for (const a of alerts) {
    const arrow = a.direction === "high" ? "▲" : "▼";
    const sign = a.direction === "high" ? "+" : "-";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${a.name}*  ${arrow} *${a.current}*  (_기준 ${a.baseline} · ${sign}${a.diffPct.toFixed(1)}%_)`,
      },
      fields: [
        {
          type: "mrkdwn",
          text: `*현재값*\n\`${a.current}\``,
        },
        {
          type: "mrkdwn",
          text: `*허용범위*\n\`${a.min.toFixed(2)} ~ ${a.max.toFixed(2)}\``,
        },
      ],
    });
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "문의: 운영팀 · 대시보드에서 상세 값을 확인하세요.",
      },
    ],
  });

  return blocks;
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
