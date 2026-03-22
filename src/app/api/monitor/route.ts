export async function GET() {
  try {
    const baseUrl =
      process.env.NODE_ENV === "production"
        ? "https://너의-도메인.vercel.apphttps://penta-works-web.vercel.app"
        : "http://localhost:3000";

    const res = await fetch(`${baseUrl}/api/dashboard`, {
      cache: "no-store",
    });

    // 🔥 JSON 안전 파싱
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("❌ JSON 파싱 실패");
      console.error("응답 내용:", text);

      return Response.json(
        { ok: false, error: "dashboard API is not returning JSON" },
        { status: 500 }
      );
    }

    const rows = data.rows ?? [];

    // 🎯 타겟 병원
    const targetNames = ["순천향병", "일등병원"];

    // 🎯 조건 범위
    const MIN = 0.95;
    const MAX = 1.05;

    const alerts: string[] = [];

    for (const r of rows) {
      // 이름 매칭 (더 안전하게)
      if (!targetNames.some((name) => r.name?.includes(name))) continue;

      const v = r.hePsi;

      if (v == null) continue;

      if (v < MIN || v > MAX) {
        alerts.push(
          `🚨 ${r.name} 이상 감지\nhePsi: ${v}\n범위: ${MIN} ~ ${MAX}`
        );
      }
    }

    // 🔥 슬랙 알림
    if (alerts.length > 0) {
      await fetch(process.env.SLACK_WEBHOOK_URL!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: "🚨 병원 이상 감지",
          blocks: alerts.map((msg) => ({
            type: "section",
            text: {
              type: "mrkdwn",
              text: msg,
            },
          })),
        }),
      });
    }

    return Response.json({ ok: true, alerts });
  } catch (e) {
    console.error("❌ monitor error:", e);

    return Response.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
