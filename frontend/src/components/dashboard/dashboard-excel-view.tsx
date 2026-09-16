"use client";

import type { CtrlRange, SiteRow } from "@/hooks/use-dashboard-query";
import { METRICS, isMetricOutOfRange } from "@/lib/metrics";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

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
  const [openMetric, setOpenMetric] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{
    key: string;
    hospital: string;
    column: string;
  } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const showMetricHelp = (key: string, autoClose = false) => {
    clearCloseTimer();
    setOpenMetric(key);
    if (autoClose) {
      closeTimer.current = setTimeout(() => setOpenMetric(null), 3000);
    }
  };

  const hideMetricHelp = () => {
    clearCloseTimer();
    setOpenMetric(null);
  };

  const selectCell = (row: SiteRow, column: string) => {
    if (selectionTimer.current) clearTimeout(selectionTimer.current);
    setSelectedCell({
      key: `${row.siteDb}:${column}`,
      hospital: row.name ?? "병원명 없음",
      column,
    });
    selectionTimer.current = setTimeout(() => setSelectedCell(null), 2000);
  };

  useEffect(
    () => () => {
      clearCloseTimer();
      if (selectionTimer.current) clearTimeout(selectionTimer.current);
    },
    [],
  );

  return (
    <section className="dashboard-grid-height dark:border-background-dark-secondary dark:bg-background-dark-card relative flex flex-col overflow-hidden rounded-md border bg-white shadow-[0_1px_2px_0_rgb(0_0_0_/_0.03)] sm:max-h-[calc(100dvh-180px)] sm:rounded-lg">
      <div className="dark:border-background-dark-secondary hidden shrink-0 border-b px-4 py-2.5 sm:block">
        <h2 className="text-text-major dark:text-text-dark-primary text-base font-extrabold tracking-tight">
          관리자 뷰{" "}
          <span className="text-sm font-medium opacity-70">
            · {rows.length}개 병원
          </span>
        </h2>
        <p className="text-text-secondary dark:text-text-dark-primary/70 text-xs">
          병원명 → 상세 보기 · 수치 → 병원·항목 확인
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="text-text-secondary dark:text-text-dark-primary/60 py-12 text-center text-sm">
          데이터가 없습니다.
        </div>
      ) : (
        // sticky 는 이 스크롤 컨테이너를 기준으로 동작합니다.
        <div
          data-dashboard-scroll
          className="min-h-0 flex-1 overflow-auto overscroll-x-contain"
        >
          <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-sm sm:min-w-[1290px]">
            <caption className="sr-only">
              병원별 최신 수집값 전체 지표 표
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
                        openMetric === m.key ? "z-50" : Z_HEAD,
                      ].join(" ")}
                    >
                      <span className="relative inline-block">
                        <button
                          type="button"
                          title={m.description}
                          aria-expanded={openMetric === m.key}
                          aria-describedby={`metric-help-${m.key}`}
                          className="text-text-major dark:text-text-dark-primary cursor-help text-sm font-bold underline decoration-dotted underline-offset-4"
                          onClick={() => showMetricHelp(m.key, true)}
                          onMouseEnter={() => showMetricHelp(m.key)}
                          onMouseLeave={hideMetricHelp}
                          onFocus={() => showMetricHelp(m.key)}
                          onBlur={hideMetricHelp}
                        >
                          {m.code}
                        </button>
                        {openMetric === m.key ? (
                          <span
                            id={`metric-help-${m.key}`}
                            role="tooltip"
                            className="dark:border-background-dark-secondary dark:bg-background-dark-card dark:text-text-dark-primary fixed top-[112px] right-[8px] left-[8px] z-50 rounded-lg border bg-white px-3 py-2 text-left text-sm leading-snug font-medium whitespace-normal text-slate-700 shadow-lg sm:absolute sm:top-full sm:right-auto sm:left-1/2 sm:mt-2 sm:w-[260px] sm:-translate-x-1/2"
                          >
                            <strong className="text-text-major dark:text-text-dark-primary mr-1 font-extrabold">
                              {m.code}
                            </strong>
                            {m.description}
                          </span>
                        ) : null}
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
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const lastAtDate = parseIso(row.lastAt);
                const range = ctrl[row.siteDb] ?? null;

                return (
                  <tr
                    key={row.siteDb}
                    id={`site-grid-${row.siteSlug}`}
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
                          onClick={() => selectCell(row, m.code)}
                          tabIndex={0}
                          aria-label={`${row.name ?? "병원명 없음"}, ${metricSubLabel(m.label, m.unit) ?? m.code}, ${fmtNum(value)}`}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              selectCell(row, m.code);
                            }
                          }}
                          className={[
                            "cursor-cell px-[6px] py-[5px] text-right leading-tight whitespace-nowrap tabular-nums sm:px-3 sm:py-2",
                            CELL_BORDER,
                            selectedCell?.key === `${row.siteDb}:${m.code}`
                              ? "relative z-10 outline-2 -outline-offset-2 outline-blue-500 dark:outline-sky-400"
                              : "",
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
                      onClick={() => selectCell(row, "1시간 건수")}
                      className={[
                        "text-text-major dark:text-text-dark-primary/90 cursor-cell px-[6px] py-[5px] text-right leading-tight whitespace-nowrap tabular-nums sm:px-3 sm:py-2",
                        CELL_BORDER,
                        selectedCell?.key === `${row.siteDb}:1시간 건수`
                          ? "relative z-10 outline-2 -outline-offset-2 outline-blue-500 dark:outline-sky-400"
                          : "",
                      ].join(" ")}
                    >
                      {fmtNum(row.count1h)}
                    </td>
                    <td
                      onClick={() => selectCell(row, "24시간 건수")}
                      className={[
                        "text-text-major dark:text-text-dark-primary/90 cursor-cell px-[6px] py-[5px] text-right leading-tight whitespace-nowrap tabular-nums sm:px-3 sm:py-2",
                        CELL_BORDER,
                        selectedCell?.key === `${row.siteDb}:24시간 건수`
                          ? "relative z-10 outline-2 -outline-offset-2 outline-blue-500 dark:outline-sky-400"
                          : "",
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-text-secondary dark:border-background-dark-secondary dark:text-text-dark-primary/70 shrink-0 border-t px-[8px] py-[7px] text-sm font-medium sm:px-4 sm:py-2.5">
        <div className="border-border/70 dark:border-background-dark-secondary mb-2 border-b pb-2 sm:hidden">
          <p className="text-text-major dark:text-text-dark-primary font-extrabold">
            관리자 뷰{" "}
            <span className="font-medium opacity-70">
              · {rows.length}개 병원
            </span>
          </p>
          <p className="mt-0.5 text-xs font-medium">
            병원명 → 상세 보기 · 수치 → 병원·항목 확인
          </p>
        </div>
        <p>
          <span className="font-semibold text-red-600 dark:text-red-400">
            빨간 값
          </span>
          은 허용 범위를 벗어난 값입니다.
          <span className="sm:hidden"> 좌우로 밀어 확인하세요.</span>
        </p>
      </div>

      {selectedCell ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute right-3 bottom-16 left-3 z-50 rounded-md bg-slate-900/90 px-3 py-2 text-center text-sm font-semibold break-words text-white shadow-lg dark:bg-white/90 dark:text-slate-900"
        >
          {selectedCell.hospital} · {selectedCell.column}
        </div>
      ) : null}
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
  children?: ReactNode;
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
