// 관리자 화면 목업 데이터.
//
// 주의: 실제 DB(alert_settings / alert_log / users)와 아직 연결되지 않았습니다.
// UI 껍데기 검증용 고정 데이터이므로 prisma 조회로 교체할 때 이 파일만 걷어내면 됩니다.
//
// 날짜는 반드시 하드코딩된 ISO 문자열을 사용합니다.
// (모듈 최상단에서 new Date() / Date.now() 를 부르면 SSR-CSR hydration 불일치가 납니다.)

/* ---------------------------------------------------------------- */
/* 1. 알림 임계값 — alert_settings                                    */
/* ---------------------------------------------------------------- */

/** 임계값을 설정할 수 있는 측정 항목 키 */
export type AlertMetricKey =
  | "he"
  | "psi"
  | "si410"
  | "chtemp"
  | "rou"
  | "actemp"
  | "achumi"
  | "gctemp"
  | "gcflow"
  | "cctemp"
  | "ccflow";

export type AlertThreshold = {
  /** DB 컬럼명과 동일한 키 */
  key: AlertMetricKey;
  /** 화면 표기용 한국어 이름 */
  label: string;
  /** 값의 단위 (없으면 빈 문자열) */
  unit: string;
  /** 하한값 — 이 값 미만이면 알림 */
  min: number;
  /** 상한값 — 이 값 초과면 알림 */
  max: number;
  /** 사용 여부 */
  enabled: boolean;
};

export const MOCK_ALERT_THRESHOLDS: readonly AlertThreshold[] = [
  {
    key: "he",
    label: "헬륨 잔량",
    unit: "%",
    min: 70,
    max: 999,
    enabled: true,
  },
  {
    key: "psi",
    label: "헬륨 압력",
    unit: "psi",
    min: 1,
    max: 999,
    enabled: true,
  },
  {
    key: "si410",
    label: "SI-410 수위",
    unit: "",
    min: 0,
    max: 999,
    enabled: false,
  },
  {
    key: "chtemp",
    label: "콜드헤드 온도",
    unit: "℃",
    min: 0,
    max: 999,
    enabled: false,
  },
  {
    key: "rou",
    label: "실내 습도",
    unit: "%",
    min: 0,
    max: 999,
    enabled: false,
  },
  {
    key: "actemp",
    label: "공조기 온도",
    unit: "℃",
    min: 0,
    max: 999,
    enabled: false,
  },
  {
    key: "achumi",
    label: "공조기 습도",
    unit: "%",
    min: 0,
    max: 999,
    enabled: false,
  },
  {
    key: "gctemp",
    label: "GC 냉각수 온도",
    unit: "℃",
    min: 0,
    max: 999,
    enabled: false,
  },
  {
    key: "gcflow",
    label: "GC 냉각수 유량",
    unit: "LPM",
    min: 0,
    max: 999,
    enabled: false,
  },
  {
    key: "cctemp",
    label: "CC 냉각수 온도",
    unit: "℃",
    min: 0,
    max: 999,
    enabled: false,
  },
  {
    key: "ccflow",
    label: "CC 냉각수 유량",
    unit: "LPM",
    min: 0,
    max: 999,
    enabled: false,
  },
] as const;

/* ---------------------------------------------------------------- */
/* 2. 알림 발송 이력 — alert_log                                      */
/* ---------------------------------------------------------------- */

/** 알림 유형 — 심각도 톤 매핑에 사용 */
export type AlertLogKind = "critical" | "warning" | "recovery";

export type AlertLogRow = {
  id: string;
  /** 병원명 — site 테이블의 name 값 */
  site: string;
  kind: AlertLogKind;
  /** 어떤 항목 때문에 발송됐는지 */
  metric: AlertMetricKey;
  message: string;
  /** 알림을 유발한 값 (단위 포함 문자열) */
  triggeredValue: string;
  /** 발송 시각 — 고정 ISO 문자열 */
  sentAt: string;
};

/** 최신순 정렬된 목업 이력 12건 */
export const MOCK_ALERT_LOGS: readonly AlertLogRow[] = [
  {
    id: "log-012",
    site: "연세고든",
    kind: "critical",
    metric: "psi",
    message: "헬륨 압력이 하한값(1 psi) 아래로 내려갔습니다.",
    triggeredValue: "0.4 psi",
    sentAt: "2026-08-05T09:41:12+09:00",
  },
  {
    id: "log-011",
    site: "순천향병",
    kind: "warning",
    metric: "he",
    message: "헬륨 잔량이 임계값(70%)에 근접했습니다.",
    triggeredValue: "71.2 %",
    sentAt: "2026-08-05T08:15:03+09:00",
  },
  {
    id: "log-010",
    site: "수원SS",
    kind: "critical",
    metric: "he",
    message: "헬륨 잔량이 하한값(70%) 아래로 내려갔습니다.",
    triggeredValue: "63.8 %",
    sentAt: "2026-08-05T06:52:47+09:00",
  },
  {
    id: "log-009",
    site: "강북우리",
    kind: "recovery",
    metric: "psi",
    message: "헬륨 압력이 정상 범위로 복구되었습니다.",
    triggeredValue: "1.9 psi",
    sentAt: "2026-08-04T23:07:30+09:00",
  },
  {
    id: "log-008",
    site: "더퍼스트",
    kind: "warning",
    metric: "chtemp",
    message: "콜드헤드 온도 상승 추세가 감지되었습니다.",
    triggeredValue: "4.6 ℃",
    sentAt: "2026-08-04T19:33:58+09:00",
  },
  {
    id: "log-007",
    site: "일등병원",
    kind: "critical",
    metric: "he",
    message: "헬륨 잔량이 하한값(70%) 아래로 내려갔습니다.",
    triggeredValue: "68.1 %",
    sentAt: "2026-08-04T17:20:11+09:00",
  },
  {
    id: "log-006",
    site: "신당서울",
    kind: "warning",
    metric: "gcflow",
    message: "GC 냉각수 유량이 불안정합니다.",
    triggeredValue: "5.2 LPM",
    sentAt: "2026-08-04T14:02:26+09:00",
  },
  {
    id: "log-005",
    site: "S신경2",
    kind: "critical",
    metric: "psi",
    message: "헬륨 압력이 기준값 대비 20% 이상 벗어났습니다.",
    triggeredValue: "1.5 psi",
    sentAt: "2026-08-04T11:44:09+09:00",
  },
  {
    id: "log-004",
    site: "휴내과",
    kind: "recovery",
    metric: "he",
    message: "헬륨 잔량이 정상 범위로 복구되었습니다.",
    triggeredValue: "78.4 %",
    sentAt: "2026-08-04T09:26:52+09:00",
  },
  {
    id: "log-003",
    site: "대구동물",
    kind: "warning",
    metric: "actemp",
    message: "공조기 온도가 관리 범위 상단에 도달했습니다.",
    triggeredValue: "27.3 ℃",
    sentAt: "2026-08-03T22:18:34+09:00",
  },
  {
    id: "log-002",
    site: "새길병원",
    kind: "critical",
    metric: "he",
    message: "24시간 이상 데이터가 수집되지 않았습니다.",
    triggeredValue: "-",
    sentAt: "2026-08-03T16:05:41+09:00",
  },
  {
    id: "log-001",
    site: "신사우리",
    kind: "warning",
    metric: "cctemp",
    message: "CC 냉각수 온도가 평소보다 높습니다.",
    triggeredValue: "21.7 ℃",
    sentAt: "2026-08-03T13:47:19+09:00",
  },
] as const;

/* ---------------------------------------------------------------- */
/* 3. 사용자 목록 — users                                             */
/* ---------------------------------------------------------------- */

export type AdminUserRole = "admin" | "user";

export type AdminUserRow = {
  id: string;
  /** 로그인 아이디 — 비밀번호는 절대 이 타입에 담지 않습니다. */
  username: string;
  role: AdminUserRole;
  /** 생성일 — 고정 ISO 문자열 */
  createdAt: string;
};

export const MOCK_USERS_ROWS: readonly AdminUserRow[] = [
  {
    id: "user-001",
    username: "admin",
    role: "admin",
    createdAt: "2025-11-03T10:12:00+09:00",
  },
  {
    id: "user-002",
    username: "penta_ops",
    role: "admin",
    createdAt: "2026-01-19T14:40:00+09:00",
  },
  {
    id: "user-003",
    username: "field_kim",
    role: "user",
    createdAt: "2026-03-08T09:05:00+09:00",
  },
  {
    id: "user-004",
    username: "viewer",
    role: "user",
    createdAt: "2026-06-22T16:31:00+09:00",
  },
] as const;

/* ---------------------------------------------------------------- */
/* 표기 헬퍼                                                          */
/* ---------------------------------------------------------------- */

export const ALERT_KIND_LABEL: Record<AlertLogKind, string> = {
  critical: "긴급",
  warning: "주의",
  recovery: "복구",
};

export const USER_ROLE_LABEL: Record<AdminUserRole, string> = {
  admin: "관리자",
  user: "일반",
};

// 아래 포맷터는 Date 를 쓰지 않고 문자열을 그대로 잘라 씁니다.
// 서버와 브라우저의 타임존이 달라도 결과가 동일해야 하기 때문입니다.

/** 고정 ISO 문자열("2026-08-05T09:41:12+09:00")을 "YYYY-MM-DD"로 자릅니다. */
export function formatIsoDate(iso: string): string {
  const date = iso.slice(0, 10);
  return date.length === 10 ? date : "-";
}

/** 고정 ISO 문자열을 "HH:mm"으로 자릅니다. */
export function formatIsoTime(iso: string): string {
  const time = iso.slice(11, 16);
  return time.length === 5 ? time : "-";
}

/** 고정 ISO 문자열을 "YYYY-MM-DD HH:mm"으로 자릅니다. */
export function formatIsoDateTime(iso: string): string {
  const date = formatIsoDate(iso);
  const time = formatIsoTime(iso);
  if (date === "-") return "-";
  return time === "-" ? date : `${date} ${time}`;
}
