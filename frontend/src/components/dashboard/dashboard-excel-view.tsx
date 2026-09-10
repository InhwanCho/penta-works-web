"use client";

import type { CtrlRange, SiteRow } from "@/hooks/use-dashboard-query";
import { METRICS, isMetricOutOfRange } from "@/lib/metrics";
import Link from "next/link";
import type React from "react";

/**
 * 고정(freeze) 열: 병원명.
 *
 * table-layout: auto 에서는 내용 길이가 열 너비를 결정하므로 병원명은
 * 고정 너비 래퍼로 감싸 가로 스크롤 중에도 첫 열 너비를 유지합니다.
 * 모바일에서는 큰글씨 모드에서도 여백이 함께 커지지 않도록 px 단위를 씁니다.
 */
const COL_NAME =
  "w-[100px] min-w-[100px] max-w-[100px] sm:w-[190px] sm:min-w-[190px] sm:max-w-[190px]";
const COL_NAME_INNER = "block w-[88px] truncate sm:w-[166px]";

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
}: {
  rows: SiteRow[];
  ctrl: Record<string, CtrlRange>;
}) {
  return (
    <section className="dark:border-background-dark-secondary dark:bg-background-dark-card rounded-md border bg-white shadow-[0_1px_2px_0_rgb(0_0_0_/_0.03)] sm:rounded-lg">
      {/* 헤더 + 범례 */}
      <div className="dark:border-background-dark-secondary flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 border-b px-[8px] py-[6px] sm:gap-x-3 sm:gap-y-1 sm:px-4 sm:py-2.5">
        <h2 className="text-text-major dark:text-text-dark-primary text-base font-extrabold tracking-tight">
          관리자 뷰
        </h2>
        <p className="text-text-secondary dark:text-text-dark-primary/70 text-sm font-medium">
          <span className="font-semibold text-red-600 dark:text-red-400">
            빨간 값
          </span>
          은 허용 범위를 벗어난 값입니다.
          <span className="sm:hidden"> 좌우로 밀어 확인하세요.</span>
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="text-text-secondary dark:text-text-dark-primary/60 py-12 text-center text-sm">
          데이터가 없습니다.
        </div>
      ) : (
        // sticky 는 이 스크롤 컨테이너를 기준으로 동작합니다.
        <div className="max-h-[calc(100dvh-210px)] overflow-auto rounded-b-md sm:max-h-[70vh] sm:rounded-b-lg">
          <table className="w-full min-w-[1250px] border-separate border-spacing-0 text-sm sm:min-w-[1380px]">
            <caption className="sr-only">
              사이트별 최신 수집값 전체 지표 표
            </caption>
            <thead>
              <tr>
                {/* 코너셀: 세로 + 가로 양방향 고정 */}
                <th
                  scope="col"
                  className={[
                    "text-text-secondary dark:text-text-dark-primary/80 sticky top-0 left-0 px-[6px] py-[5px] text-left align-bottom text-sm leading-tight font-bold tracking-wide sm:px-3 sm:py-2.5",
                    COL_NAME,
                    CELL_BORDER,
                    HEAD_BG,
                    Z_CORNER,
                  ].join(" ")}
                >
                  <span className={COL_NAME_INNER}>병원명</span>
                </th>
                {METRICS.map((m) => {
                  const sub = metricSubLabel(m.label, m.unit);
                  return (
                    <th
                      key={m.key}
                      scope="col"
                      className={[
                        "sticky top-0 min-w-[76px] px-[6px] py-[5px] text-right whitespace-nowrap sm:min-w-[104px] sm:px-3 sm:py-2",
                        sub ? "align-top" : "align-middle",
                        CELL_BORDER,
                        HEAD_BG,
                        Z_HEAD,
                      ].join(" ")}
                    >
                      <span className="text-text-major dark:text-text-dark-primary block text-sm font-bold">
                        {m.code}
                      </span>
                      {sub ? (
                        <span className="text-text-secondary dark:text-text-dark-primary/70 mt-0.5 hidden text-xs font-medium sm:block">
                          {sub}
                        </span>
                      ) : null}
                    </th>
                  );
                })}

                <HeadCell className="w-[72px] min-w-[72px] text-right sm:w-[96px] sm:min-w-[96px]">
                  1시간 건수
                </HeadCell>
                <HeadCell className="w-[72px] min-w-[72px] text-right sm:w-[96px] sm:min-w-[96px]">
                  24시간 건수
                </HeadCell>
                <HeadCell className="w-[108px] min-w-[108px] text-left sm:w-[128px] sm:min-w-[128px]">
                  최신 시각
                </HeadCell>
                <HeadCell className="w-[64px] min-w-[64px] text-left sm:w-[84px] sm:min-w-[84px]">
                  사이트
                </HeadCell>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
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
                        "text-text-major dark:text-text-dark-primary sticky left-0 px-[6px] py-[5px] font-medium sm:px-3 sm:py-2",
                        COL_NAME,
                        CELL_BORDER,
                        FIXED_BG,
                        Z_FIXED,
                      ].join(" ")}
                      title={row.name ?? undefined}
                    >
                      <Link
                        className="text-text-major dark:text-text-dark-primary font-bold underline decoration-transparent underline-offset-4 hover:decoration-current"
                        href={`/sites/${row.siteSlug}`}
                      >
                        <span className={COL_NAME_INNER}>
                          {row.name ?? "-"}
                        </span>
                      </Link>
                    </td>

                    {METRICS.map((m) => {
                      const value = row.metrics?.[m.key] ?? null;
                      const alert = isMetricOutOfRange(value, m.bound, range);

                      return (
                        <td
                          key={m.key}
                          className={[
                            "px-[6px] py-[5px] text-right leading-tight whitespace-nowrap tabular-nums sm:px-3 sm:py-2",
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
                        "text-text-major dark:text-text-dark-primary/90 px-[6px] py-[5px] text-right leading-tight whitespace-nowrap tabular-nums sm:px-3 sm:py-2",
                        CELL_BORDER,
                      ].join(" ")}
                    >
                      {fmtNum(row.count1h)}
                    </td>
                    <td
                      className={[
                        "text-text-major dark:text-text-dark-primary/90 px-[6px] py-[5px] text-right leading-tight whitespace-nowrap tabular-nums sm:px-3 sm:py-2",
                        CELL_BORDER,
                      ].join(" ")}
                    >
                      {fmtNum(row.count24h)}
                    </td>

                    <td
                      className={[
                        "text-text-secondary dark:text-text-dark-primary/70 px-[6px] py-[5px] whitespace-nowrap tabular-nums sm:px-3 sm:py-2",
                        CELL_BORDER,
                      ].join(" ")}
                    >
                      <span className="block text-xs leading-tight font-medium">
                        {fmtYmd(lastAtDate)}
                      </span>
                      <span className="mt-0.5 block text-xs leading-tight opacity-70">
                        {fmtHms(lastAtDate)}
                      </span>
                    </td>

                    <td
                      className={[
                        "text-text-major dark:text-text-dark-primary px-[6px] py-[5px] text-sm leading-tight font-semibold whitespace-nowrap tabular-nums sm:px-3 sm:py-2",
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
        "text-text-secondary dark:text-text-dark-primary/80 sticky top-0 px-[6px] py-[5px] align-bottom text-sm leading-tight font-bold tracking-wide whitespace-nowrap sm:px-3 sm:py-2.5",
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
