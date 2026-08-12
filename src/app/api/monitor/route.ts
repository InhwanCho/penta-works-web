import { getPsiThresholdMap, judgePsi } from "@/lib/alert-settings";
import { NextResponse } from "next/server";
import { getDashboardData } from "../dashboard/service";

export const dynamic = "force-dynamic";

type AlertPayload = {
  siteid: string;
  name: string;
  current: number;
  min: number | null;
  max: number | null;
  direction: "low" | "high";
};

/** 임계값 표기. 한쪽만 설정된 경우도 읽히도록 처리합니다. */
function fmtRange(min: number | null, max: number | null) {
  if (min != null && max != null) return `${min} ~ ${max}`;
  if (min != null) return `${min} 이상`;
  return `${max} 이하`;
}

/**
 * 허용 범위를 벗어난 병원을 하나의 섹션에 컴팩트하게 나열합니다.
 */
function buildSlackBlocks(alerts: AlertPayload[]) {
  const lines = alerts.map((a) => {
    return (
      `!! *${a.name} 이상 감지* !!\n` +
      `• 현재 hePsi: *${a.current}*\n` +
      `• 허용범위: ${fmtRange(a.min, a.max)}`
    );
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
        // 각 항목 구분을 위해 줄바꿈 두 번 적용
        text: lines.join("\n\n"),
      },
    },
  ];
}

/** Slack 알림이 실패해도 fallback text만 보여줄 수 있도록 요약 문자열 생성 */
function buildFallbackText(alerts: AlertPayload[]) {
  const lines = alerts.map((a) => {
    const arrow = a.direction === "high" ? "▲" : "▼";
    return `${arrow} ${a.name}: ${a.current} (범위 ${fmtRange(a.min, a.max)})`;
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
    const [data, thresholds] = await Promise.all([
      getDashboardData(),
      getPsiThresholdMap(),
    ]);

    const rows = data.rows ?? [];
    const alerts: AlertPayload[] = [];

    for (const r of rows) {
      if (!r.name) continue;

      const v = r.hePsi;
      // 수치가 0이거나 null이면 제외
      if (v == null || v === 0) continue;

      // 임계값은 병원명이 아니라 siteid 로 찾습니다.
      // (병원명은 바뀔 수 있고, alert_settings 도 siteid 를 키로 씁니다)
      const threshold = thresholds.get(r.siteDb);

      // 설정이 없거나 psi_active = 0 이면 감시 대상이 아닙니다.
      const direction = judgePsi(v, threshold);
      if (!direction || !threshold) continue;

      alerts.push({
        siteid: r.siteDb,
        name: r.name,
        current: v,
        min: threshold.min,
        max: threshold.max,
        direction,
      });
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
