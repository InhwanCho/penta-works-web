// mrtb 지표 컬럼 정의.
// 대시보드 관리자 뷰(엑셀 뷰)의 열 구성과 ctrl 임계값 대응을 한곳에서 관리합니다.

export type MetricKey =
  | "recosi"
  | "coldtp"
  | "recoru"
  | "hepres"
  | "heleve"
  | "actemp"
  | "achumi"
  | "gctemp"
  | "gcflow"
  | "cctemp"
  | "ccflow";

/**
 * ctrl 테이블의 임계값 컬럼 접두사.
 * 실제 컬럼은 `${prefix}l`(하한) / `${prefix}h`(상한) 규칙을 따릅니다.
 * 예) mrple -> mrplel, mrpleh
 */
export type CtrlBound =
  | "mrple"
  | "mrlev"
  | "actmp"
  | "achum"
  | "gctmp"
  | "gcflo"
  | "cctmp"
  | "ccflo";

export type MetricDef = {
  key: MetricKey;
  /** 표에 그대로 노출되는 DB 컬럼명 */
  code: MetricKey;
  /** 의미가 확인된 컬럼만 라벨을 답니다. 확인 안 된 건 null. */
  label: string | null;
  unit: string | null;
  /** 컬럼명을 누르거나 마우스를 올렸을 때 표시할 설명 */
  description: string;
  /** 대응하는 ctrl 임계값. 없으면 범위 이탈 판정을 하지 않습니다. */
  bound: CtrlBound | null;
};

export const METRICS: readonly MetricDef[] = [
  {
    key: "recosi",
    code: "recosi",
    label: "리콘덴서 SI",
    unit: null,
    description: "리콘덴서 SI 값입니다.",
    bound: null,
  },
  {
    key: "coldtp",
    code: "coldtp",
    label: null,
    unit: null,
    description:
      "콜드헤드 또는 콜드칠러 온도로 추정됩니다. 정확한 의미는 확인이 필요합니다.",
    bound: null,
  },
  {
    key: "recoru",
    code: "recoru",
    label: "리콘덴서 RU",
    unit: null,
    description: "리콘덴서 RU 값입니다.",
    bound: null,
  },
  {
    key: "hepres",
    code: "hepres",
    label: "He Pressure",
    unit: "psi",
    description: "헬륨 압력입니다. 단위는 psi입니다.",
    bound: "mrple",
  },
  {
    key: "heleve",
    code: "heleve",
    label: "He Level",
    unit: "%",
    description: "헬륨 잔량입니다. 단위는 %입니다.",
    bound: "mrlev",
  },
  {
    key: "actemp",
    code: "actemp",
    label: "AC Temp",
    unit: "°C",
    description: "AC 온도입니다. 단위는 °C입니다.",
    bound: "actmp",
  },
  {
    key: "achumi",
    code: "achumi",
    label: "AC Humidity",
    unit: "%",
    description: "AC 습도입니다. 단위는 %입니다.",
    bound: "achum",
  },
  {
    key: "gctemp",
    code: "gctemp",
    label: "그라디언트칠러 온도",
    unit: "°C",
    description:
      "GC는 그라디언트칠러이며, 그라디언트칠러 온도입니다. 단위는 °C입니다.",
    bound: "gctmp",
  },
  {
    key: "gcflow",
    code: "gcflow",
    label: "그라디언트칠러 유량",
    unit: null,
    description: "GC는 그라디언트칠러이며, 그라디언트칠러 유량입니다.",
    bound: "gcflo",
  },
  {
    key: "cctemp",
    code: "cctemp",
    label: "콜드칠러 온도",
    unit: "°C",
    description: "CC는 콜드칠러이며, 콜드칠러 온도입니다. 단위는 °C입니다.",
    bound: "cctmp",
  },
  {
    key: "ccflow",
    code: "ccflow",
    label: "콜드칠러 유량",
    unit: null,
    description: "CC는 콜드칠러이며, 콜드칠러 유량입니다.",
    bound: "ccflo",
  },
] as const;

export const METRIC_KEYS: readonly MetricKey[] = METRICS.map((m) => m.key);

/** ctrl 임계값 컬럼명 전체 (하한/상한 쌍) */
export const CTRL_BOUNDS: readonly CtrlBound[] = [
  "mrple",
  "mrlev",
  "actmp",
  "achum",
  "gctmp",
  "gcflo",
  "cctmp",
  "ccflo",
] as const;

export type CtrlRange = {
  [K in `${CtrlBound}${"l" | "h"}`]: number | null;
};

/** 지표값이 ctrl 허용 범위를 벗어났는지 판정합니다. 임계값이 없으면 항상 false. */
export function isMetricOutOfRange(
  value: number | null,
  bound: CtrlBound | null,
  range: CtrlRange | null,
): boolean {
  if (value == null || Number.isNaN(value)) return false;
  if (!bound || !range) return false;

  const low = range[`${bound}l`];
  const high = range[`${bound}h`];

  // 하한 > 상한이면 ctrl 데이터가 잘못 들어간 경우입니다.
  // (현재 achum 이 5개 사이트에서 80 > 4 로 뒤집혀 있음)
  // 이때 그대로 판정하면 모든 값이 이탈로 잡히므로, 범위 없음으로 취급합니다.
  if (low != null && high != null && low > high) return false;

  if (low != null && value < low) return true;
  if (high != null && value > high) return true;
  return false;
}
