"use client";

import type { CtrlRange, SiteRow } from "@/hooks/use-dashboard-query";
import { METRICS, isMetricOutOfRange } from "@/lib/metrics";
import type React from "react";

/**
 * 고정(freeze) 열: 병원명 + 상태.
 * 상태 열의 sticky left 오프셋(STATUS_LEFT)은 병원명 열 너비(COL_NAME)와
 * 반드시 같아야 하므로 한곳에서 관리합니다.
 * 모바일 병원명 104px -> 상태 left-[104px], sm 이상 184px -> left-[184px].
 * 셋(COL_NAME / STATUS_LEFT / *_INNER)의 브레이크포인트를 항상 같이 바꿔야 합니다.
 *
 * table-layout: auto 에서는 셀의 min/max-width 가 무시되고 내용 길이가
 * 열 너비를 결정합니다. 그러면 병원명 열이 지정 너비를 넘겨 상태 열의
 * left 오프셋과 어긋나므로, 내용은 고정 너비 래퍼(*_INNER)로 감싸
 * 열 너비가 항상 상수와 일치하도록 강제합니다.
 * (INNER 너비 = 열 너비 - 좌우 패딩 px-3 * 2 = 24px)
 */
const COL_NAME =
  "w-[104px] min-w-[104px] max-w-[104px] sm:w-[184px] sm:min-w-[184px] sm:max-w-[184px]";
const COL_NAME_INNER = "block w-[80px] truncate sm:w-[160px]";
const COL_STATUS =
  "w-[88px] min-w-[88px] max-w-[88px] sm:w-[96px] sm:min-w-[96px] sm:max-w-[96px]";
const COL_STATUS_INNER = "block w-[64px] sm:w-[72px]";
/** 두 번째 고정열(상태)의 좌측 오프셋 = 병원명 열 너비 */
const STATUS_LEFT = "left-[104px] sm:left-[184px]";

/**
 * z-index 레이어링
 * 코너셀(40) > 헤더행(30) > 고정열(20) > 일반셀(기본)
 */
const Z_CORNER = "z-40";
const Z_HEAD = "z-30";
const Z_FIXED = "z-20";

/** 셀 공통 보더. border-collapse 대신 border-separate 를 쓰므로 셀마다 지정합니다. */
const CELL_BORDER = "dark:border-background-dark-secondary border-b border-r";

/** sticky 셀은 반드시 불투명 배경이어야 아래 셀이 비치지 않습니다. */
const HEAD_BG = "bg-background-primary dark:bg-background-dark-secondary";
const FIXED_BG =
  "bg-white group-hover:bg-background-primary dark:bg-background-dark-card dark:group-hover:bg-background-dark-secondary";

function parseIso(iso: string | null) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

function fmtYmd(d: Date | null) {
  if (!d) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtHms(d: Date | null) {
  if (!d) return "-";
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mi}:${ss}`;
}

function fmtNum(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "-";
  // 원본 mrtb 값은 소수점 3자리까지 있습니다 (예: recosi 3.743, hepres 0.912).
  // 전체 데이터를 살펴보는 화면이므로 반올림으로 정보를 잃지 않게 3자리까지 유지합니다.
  return v.toLocaleString("ko-KR", { maximumFractionDigits: 3 });
}

function metricSubLabel(label: string | null, unit: string | null) {
  if (!label) return null;
  return unit ? `${label} (${unit})` : label;
}

export default function DashboardExcelView({
  rows,
  ctrl,
  since1hMs,
  since24hMs,
}: {
  rows: SiteRow[];
  ctrl: Record<string, CtrlRange>;
  since1hMs: number;
  since24hMs: number;
}) {
  return (
    <section className="dark:border-background-dark-secondary dark:bg-background-dark-card rounded-lg border bg-white shadow-[0_1px_2px_0_rgb(0_0_0_/_0.03)]">
      {/* 헤더 + 범례 */}
      <div className="dark:border-background-dark-secondary flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b px-4 py-3">
        <h2 className="text-text-major dark:text-text-dark-primary text-sm font-semibold tracking-tight lg:text-base">
          관리자 뷰
        </h2>
        <p className="text-text-secondary dark:text-text-dark-primary/60 text-[11px] lg:text-xs">
          <span className="font-semibold text-red-600 dark:text-red-400">
            빨간 값
          </span>
          은 기준값(ctrl) 허용 범위를 벗어난 지표입니다.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="text-text-secondary dark:text-text-dark-primary/60 py-12 text-center text-sm">
          데이터가 없습니다.
        </div>
      ) : (
        // sticky 는 이 스크롤 컨테이너를 기준으로 동작합니다.
        <div className="max-h-[70vh] overflow-auto rounded-b-lg">
          <table className="w-full min-w-[1500px] border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              사이트별 최신 수집값 전체 지표 표
            </caption>
            <thead>
              <tr>
                {/* 코너셀: 세로 + 가로 양방향 고정 */}
                <th
                  scope="col"
                  className={[
                    "text-text-secondary dark:text-text-dark-primary/70 sticky top-0 left-0 px-3 py-2 text-left align-bottom text-[11px] font-semibold tracking-wide",
                    COL_NAME,
                    CELL_BORDER,
                    HEAD_BG,
                    Z_CORNER,
                  ].join(" ")}
                >
                  <span className={COL_NAME_INNER}>병원명</span>
                </th>
                <th
                  scope="col"
                  className={[
                    "text-text-secondary dark:text-text-dark-primary/70 sticky top-0 px-3 py-2 text-left align-bottom text-[11px] font-semibold tracking-wide",
                    STATUS_LEFT,
                    COL_STATUS,
                    CELL_BORDER,
                    HEAD_BG,
                    Z_CORNER,
                  ].join(" ")}
                >
                  <span className={COL_STATUS_INNER}>상태</span>
                </th>

                {METRICS.map((m) => {
                  const sub = metricSubLabel(m.label, m.unit);
                  return (
                    <th
                      key={m.key}
                      scope="col"
                      className={[
                        "sticky top-0 min-w-[104px] px-3 py-2 text-right align-top whitespace-nowrap",
                        CELL_BORDER,
                        HEAD_BG,
                        Z_HEAD,
                      ].join(" ")}
                    >
                      <span className="text-text-major dark:text-text-dark-primary block text-xs font-bold">
                        {m.code}
                      </span>
                      {sub ? (
                        <span className="text-text-secondary dark:text-text-dark-primary/60 mt-0.5 block text-[10px] font-medium">
                          {sub}
                        </span>
                      ) : null}
                    </th>
                  );
                })}

                <HeadCell className="w-[96px] min-w-[96px] text-right">
                  1시간 건수
                </HeadCell>
                <HeadCell className="w-[96px] min-w-[96px] text-right">
                  24시간 건수
                </HeadCell>
                <HeadCell className="w-[128px] min-w-[128px] text-left">
                  최신 시각
                </HeadCell>
                <HeadCell className="w-[84px] min-w-[84px] text-left">
                  사이트
                </HeadCell>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const lastAtMs = row.lastAt ? Date.parse(row.lastAt) : null;
                const isActive1h = !!lastAtMs && lastAtMs >= since1hMs;
                const isActive24h = !!lastAtMs && lastAtMs >= since24hMs;
                const status = isActive1h
                  ? "ok"
                  : isActive24h
                    ? "warn"
                    : "stale";
                const statusLabel = isActive1h
                  ? "정상"
                  : isActive24h
                    ? "주의"
                    : "미수집";

                const lastAtDate = parseIso(row.lastAt);
                const range = ctrl[row.siteDb] ?? null;

                return (
                  <tr
                    key={row.siteDb}
                    // 고정열은 불투명 배경이라 알파 hover 를 쓸 수 없습니다.
                    // 행 전체와 고정열의 hover 색이 어긋나지 않도록 양쪽 모두
                    // 알파 없는 같은 색(FIXED_BG 의 group-hover)을 사용합니다.
                    className="group hover:bg-background-primary dark:hover:bg-background-dark-secondary transition-colors"
                  >
                    {/* 고정열 1 — 병원명 */}
                    <td
                      className={[
                        "text-text-major dark:text-text-dark-primary sticky left-0 px-3 py-2 font-medium",
                        COL_NAME,
                        CELL_BORDER,
                        FIXED_BG,
                        Z_FIXED,
                      ].join(" ")}
                      title={row.name ?? undefined}
                    >
                      <span className={COL_NAME_INNER}>{row.name ?? "-"}</span>
                    </td>

                    {/* 고정열 2 — 상태 */}
                    <td
                      className={[
                        "sticky px-3 py-2 whitespace-nowrap",
                        STATUS_LEFT,
                        COL_STATUS,
                        CELL_BORDER,
                        FIXED_BG,
                        Z_FIXED,
                      ].join(" ")}
                    >
                      <span className={COL_STATUS_INNER}>
                        <StatusBadge variant={status}>
                          {statusLabel}
                        </StatusBadge>
                      </span>
                    </td>

                    {METRICS.map((m) => {
                      const value = row.metrics?.[m.key] ?? null;
                      const alert = isMetricOutOfRange(value, m.bound, range);

                      return (
                        <td
                          key={m.key}
                          className={[
                            "px-3 py-2 text-right whitespace-nowrap tabular-nums",
                            CELL_BORDER,
                            alert
                              ? "bg-red-50 font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-400"
                              : "text-text-major dark:text-text-dark-primary/90",
                          ].join(" ")}
                        >
                          {fmtNum(value)}
                        </td>
                      );
                    })}

                    <td
                      className={[
                        "text-text-major dark:text-text-dark-primary/90 px-3 py-2 text-right whitespace-nowrap tabular-nums",
                        CELL_BORDER,
                      ].join(" ")}
                    >
                      {fmtNum(row.count1h)}
                    </td>
                    <td
                      className={[
                        "text-text-major dark:text-text-dark-primary/90 px-3 py-2 text-right whitespace-nowrap tabular-nums",
                        CELL_BORDER,
                      ].join(" ")}
                    >
                      {fmtNum(row.count24h)}
                    </td>

                    <td
                      className={[
                        "text-text-secondary dark:text-text-dark-primary/70 px-3 py-2 whitespace-nowrap tabular-nums",
                        CELL_BORDER,
                      ].join(" ")}
                    >
                      <span className="block text-xs leading-tight font-medium">
                        {fmtYmd(lastAtDate)}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-tight opacity-70">
                        {fmtHms(lastAtDate)}
                      </span>
                    </td>

                    <td
                      className={[
                        "text-text-major dark:text-text-dark-primary px-3 py-2 text-sm font-semibold whitespace-nowrap tabular-nums",
                        CELL_BORDER,
                      ].join(" ")}
                    >
                      {row.siteSlug}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---- 이하 UI 컴포넌트 ---- */

/**
 * 세로 방향만 고정되는 일반 헤더 셀.
 * text-align 은 기본값을 두지 않고 호출부에서 지정합니다.
 * (기본 text-left 를 두면 className 의 text-right 와 충돌해 승자가
 *  클래스 문자열 순서가 아니라 생성된 CSS 순서에 좌우됩니다.)
 */
function HeadCell({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={[
        "text-text-secondary dark:text-text-dark-primary/70 sticky top-0 px-3 py-2 align-bottom text-[11px] font-semibold tracking-wide whitespace-nowrap",
        CELL_BORDER,
        HEAD_BG,
        Z_HEAD,
        className,
      ].join(" ")}
    >
      {children}
    </th>
  );
}

function StatusBadge({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "ok" | "warn" | "stale";
}) {
  const cls =
    variant === "ok"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : variant === "warn"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        : "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300";

  const dotCls =
    variant === "ok"
      ? "bg-emerald-500"
      : variant === "warn"
        ? "bg-amber-500"
        : "bg-slate-400";

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        cls,
      ].join(" ")}
    >
      <span className={["h-1.5 w-1.5 rounded-full", dotCls].join(" ")} />
      {children}
    </span>
  );
}
