export async function GET() {
  try {
    const baseUrl =
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    
    const res = await fetch(`${baseUrl}/api/dashboard`, {
      cache: "no-store",
    });

    const data = await res.json();

    const rows = data.rows ?? [];

    // 🎯 타겟 병원
    const targetNames = ["순천향병", "일등병원"];

    // 🎯 조건 범위
    const MIN = 0.95;
    const MAX = 1.05;

    const alerts: string[] = [];

    for (const r of rows) {
      if (!targetNames.includes(r.name)) continue;

      const v = r.hePsi;

      if (v == null) continue;

      if (v < MIN || v > MAX) {
        alerts.push(
          `${r.name} 이상 감지\nhePsi: ${v}\n범위: ${MIN} ~ ${MAX}`
        );
      }
    }

    // 🔥 알림 전송
    if (alerts.length > 0) {
      await fetch(process.env.SLACK_WEBHOOK_URL!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: alerts.join("\n\n"),
        }),
      });
    }

    return Response.json({ ok: true, alerts });
  } catch (e) {
    return Response.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
