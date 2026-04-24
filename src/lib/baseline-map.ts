// 각 병원별 hePsi 기준값(±20% 허용범위) 매핑
// monitor/route.ts, /baselines 페이지 등에서 공유해 사용합니다.

export const BASELINE_MAP: Record<string, number> = {
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

export const BASELINE_TOLERANCE = 0.2; // ±20%

export type BaselineEntry = {
  name: string;
  baseline: number;
  min: number;
  max: number;
};

export function getBaselineEntries(): BaselineEntry[] {
  return Object.entries(BASELINE_MAP).map(([name, baseline]) => ({
    name,
    baseline,
    min: Number((baseline * (1 - BASELINE_TOLERANCE)).toFixed(2)),
    max: Number((baseline * (1 + BASELINE_TOLERANCE)).toFixed(2)),
  }));
}

export function getBaselineRange(baseline: number) {
  return {
    min: baseline * (1 - BASELINE_TOLERANCE),
    max: baseline * (1 + BASELINE_TOLERANCE),
  };
}
