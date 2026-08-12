// hePsi 모니터링 임계값을 DB(alert_settings)에서 읽어옵니다.
//
// 이전에는 src/lib/baseline-map.ts 에 병원명 -> 기준값(±20%)을 하드코딩해서 썼는데,
// 그 값이 실제 운영 범위와 크게 어긋나 오탐이 발생해 DB 조회로 전환했습니다.
// 기준값을 바꿀 때 재배포가 필요 없고, alert_settings 에만 있는 사이트도
// 자동으로 감시 대상에 포함됩니다.

import { prisma } from "@/lib/prisma";

/** alert_settings 의 hePsi(psi_*) 임계값 한 건 */
export type PsiThreshold = {
  siteid: string;
  name: string | null;
  min: number | null;
  max: number | null;
  /** psi_active = 0 이면 알림 대상에서 제외합니다. */
  active: boolean;
};

function toFinite(v: number | null): number | null {
  return v != null && Number.isFinite(v) ? v : null;
}

/**
 * 임계값 목록을 siteid 오름차순으로 반환합니다.
 * alert_settings(23행) + site(31행) 모두 작아 전량 조회 후 JS에서 합칩니다.
 */
export async function getPsiThresholds(): Promise<PsiThreshold[]> {
  const [settings, sites] = await Promise.all([
    prisma.alert_settings.findMany({
      select: {
        siteid: true,
        psi_min: true,
        psi_max: true,
        psi_active: true,
      },
      orderBy: { siteid: "asc" },
    }),
    prisma.site.findMany({ select: { site: true, name: true } }),
  ]);

  const nameBySite = new Map(sites.map((s) => [s.site, s.name]));

  return settings.map((s) => ({
    siteid: s.siteid,
    name: nameBySite.get(s.siteid) ?? null,
    min: toFinite(s.psi_min),
    max: toFinite(s.psi_max),
    // 컬럼 기본값이 1(사용)이므로 값이 비어 있으면 사용중으로 봅니다.
    // 모니터링에서는 알림 누락이 오탐보다 위험해 열어두는 쪽을 택했습니다.
    active: (s.psi_active ?? 1) !== 0,
  }));
}

/** siteid 로 임계값을 찾기 위한 Map */
export async function getPsiThresholdMap(): Promise<Map<string, PsiThreshold>> {
  const list = await getPsiThresholds();
  return new Map(list.map((t) => [t.siteid, t]));
}

/**
 * 알림을 보내야 하는지 판정합니다.
 * 임계값이 없거나 비활성이면 판정하지 않습니다(null 반환).
 */
export function judgePsi(
  value: number,
  threshold: PsiThreshold | undefined,
): "low" | "high" | null {
  if (!threshold || !threshold.active) return null;

  const { min, max } = threshold;
  if (min == null && max == null) return null;
  // 하한 > 상한이면 설정이 잘못된 것이므로 판정하지 않습니다.
  if (min != null && max != null && min > max) return null;

  if (min != null && value < min) return "low";
  if (max != null && value > max) return "high";
  return null;
}
