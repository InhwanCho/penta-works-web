import type { AlertThreshold } from "./api";

export function averageUnavailableMessage(threshold: AlertThreshold): string | null {
  switch (threshold.averageUnavailableReason) {
    case "NO_AVERAGE": return "사용할 수 있는 24시간 평균이 없습니다.";
    case "INSUFFICIENT_SAMPLES": return `유효 표본 ${threshold.averageSampleCount}건 / 최소 12건으로 표본이 부족합니다.`;
    case "AVERAGE_EXPIRED": return "평균 갱신 시각이 2시간 이상 지났거나 올바르지 않습니다.";
    case "MEASUREMENT_EXPIRED": return "마지막 유효 측정이 2시간 이상 지났거나 시각이 올바르지 않습니다.";
    case "INVALID_TOLERANCE": return "허용편차 설정을 확인해주세요.";
    default:
      // Older cached API responses do not include eligibility yet.
      if (threshold.averageValue == null) return "사용할 수 있는 24시간 평균이 없습니다.";
      if (threshold.averageSampleCount < 12) return `유효 표본 ${threshold.averageSampleCount}건 / 최소 12건으로 표본이 부족합니다.`;
      if (threshold.averageUnavailableReason === undefined && threshold.useAverage && !threshold.averageApplied) return "평균 적용 조건을 충족하지 않습니다.";
      return null;
  }
}

export function previewAlertRange(threshold: AlertThreshold) {
  const reason = averageUnavailableMessage(threshold);
  const averageApplied = threshold.useAverage && reason == null && threshold.averageValue != null &&
    Number.isFinite(threshold.tolerancePercent) && threshold.tolerancePercent >= 0.1 && threshold.tolerancePercent <= 100;
  const spread = Math.abs(threshold.averageValue ?? 0) * threshold.tolerancePercent / 100;
  return { averageApplied, reason, min: averageApplied ? threshold.averageValue! - spread : threshold.min,
    max: averageApplied ? threshold.averageValue! + spread : threshold.max };
}

export function averagePeriodMessage(threshold: AlertThreshold): string | null {
  if (!threshold.averageCapturedAt) return null;
  // API timestamps represent Korean local time and do not carry a zone suffix.
  const end = new Date(`${threshold.averageCapturedAt}+09:00`);
  if (!Number.isFinite(end.getTime())) return null;
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const format = (date: Date) => date.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return `계산 구간: ${format(start)} – ${format(end)} (한국 시간)`;
}
