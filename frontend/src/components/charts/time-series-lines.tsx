"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import React from "react";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

let zoomRegistered = false;

export type TimeSeriesPoint = {
  t: string;
  [k: string]: number | string | null | undefined;
};

type Series = {
  key: string;
  name: string;
};

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

function useDarkMode() {
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();

    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return dark;
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/,/g, "");
  if (!s || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function linePaletteBase(): string[] {
  return [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EC4899",
    "#8B5CF6",
    "#06B6D4",
    "#F97316",
    "#22C55E",
  ];
}

function gridColors(dark: boolean) {
  const grid = cssVar(
    "--chart-grid",
    dark ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.16)",
  );
  const border = cssVar(
    "--chart-axis-border",
    dark ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.22)",
  );
  return { grid, border };
}

export function TimeSeriesLines({
  title,
  points,
  series,
  height = 280,
  interactive = true,
}: {
  title: string;
  points: TimeSeriesPoint[];
  series: Series[];
  height?: number;
  interactive?: boolean;
}) {
  const labels = points.map((p) => p.t);

  const dark = useDarkMode();
  const palette = linePaletteBase();
  const { grid, border } = gridColors(dark);

  const [zoomReady, setZoomReady] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = React.useState<number | null>(null);
  const selectedIndex = pinnedIndex ?? activeIndex;
  const selectedPoint = selectedIndex == null ? null : points[selectedIndex];

  React.useEffect(() => {
    setActiveIndex(null);
    setPinnedIndex(null);
  }, [points, series]);

  React.useEffect(() => {
    if (!interactive) return;
    let alive = true;

    (async () => {
      if (zoomRegistered) {
        if (alive) setZoomReady(true);
        return;
      }

      // 브라우저에서만 로드/등록
      const mod = await import("chartjs-plugin-zoom");
      ChartJS.register(mod.default);
      zoomRegistered = true;

      if (alive) setZoomReady(true);
    })();

    return () => {
      alive = false;
    };
  }, [interactive]);

  const maxTicksLimit = Math.min(labels.length, dark ? 18 : 22);

  const data: ChartData<"line"> = {
    labels,
    datasets: series.map((s, idx) => {
      const base = palette[idx % palette.length];

      return {
        label: s.name,
        data: points.map((p) => toNumber(p[s.key])),
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHitRadius: 12,
        tension: 0.25,
        spanGaps: true,
        borderColor: dark ? base : hexToRgba(base, 0.65),
        backgroundColor: "transparent",
      };
    }),
  };

  const options: ChartOptions<"line"> = {
    // Reading values is always available. `interactive` only controls zoom/pan.
    events: ["mousemove", "mouseout", "click", "touchstart", "touchmove", "touchend"],
    onHover: (event, elements) => {
      const index = elements[0]?.index ?? null;
      if (event.native?.type === "touchstart" && index != null) setPinnedIndex(index);
      else if (pinnedIndex == null) setActiveIndex(index);
    },
    onClick: (_event, elements) => {
      const index = elements[0]?.index;
      if (index != null) { setPinnedIndex(index); setActiveIndex(index); }
    },
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: series.length > 1,
        labels: {
          color: cssVar(
            dark ? "--color-text-dark-primary" : "--color-text-major",
            dark ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.90)",
          ),
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
          pointStyle: "line",
        },
      },
      tooltip: {
        enabled: true,
        callbacks: {
          title: items => String(points[items[0]?.dataIndex]?.at ?? items[0]?.label ?? ""),
          label: item => `${item.dataset.label}: ${item.parsed.y == null ? "측정 안됨" : item.parsed.y.toLocaleString("ko-KR", {maximumFractionDigits: 6})}`,
        },
      },

      // zoom 플러그인은 준비된 이후에만 옵션을 넣는 것이 안전합니다.
      ...(zoomReady && interactive
        ? {
            zoom: {
              zoom: {
                wheel: { enabled: true },
                pinch: { enabled: true },
                mode: "x",
              },
              pan: {
                enabled: true,
                mode: "x",
                modifierKey: "shift",
              },
              limits: {
                x: { min: 0, max: Math.max(0, labels.length - 1) },
              },
            },
          }
        : {}),
    },
    scales: {
      x: {
        ticks: {
          color: cssVar(
            dark ? "--color-text-dark-primary" : "--color-text-secondary",
            dark ? "rgba(255,255,255,0.70)" : "rgba(51,65,85,0.72)",
          ),
          minRotation: 45,
          maxRotation: 45,
          align: "end",
          autoSkip: true,
          maxTicksLimit,
          font: { size: 10 },
          padding: 2,
        },
        grid: { color: grid, lineWidth: 1, drawTicks: false },
        border: { color: border },
      },
      y: {
        ticks: {
          color: cssVar(
            dark ? "--color-text-dark-primary" : "--color-text-secondary",
            dark ? "rgba(255,255,255,0.70)" : "rgba(51,65,85,0.72)",
          ),
          font: { size: 10 },
          padding: 4,
        },
        grid: { color: grid, lineWidth: 1, drawTicks: false },
        border: { color: border },
      },
    },
  };

  return (
    <section className="dark:bg-background-dark-card dark:border-background-dark-secondary w-full min-w-0 max-w-full overflow-hidden rounded-lg border bg-white shadow-[0_1px_2px_0_rgb(0_0_0_/_0.03)]">
      <div className="dark:border-background-dark-secondary/60 border-b border-border/60 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <strong className="text-text-major dark:text-text-dark-primary text-sm font-semibold tracking-tight">
            {title}
          </strong>
          {interactive && <span className="text-text-secondary dark:text-text-dark-primary/50 hidden text-[11px] font-medium sm:inline">
            휠/핀치 확대 · Shift + 드래그 이동
          </span>}
        </div>
        <p className="text-text-secondary mt-1 text-[11px] dark:text-text-dark-primary/60">마우스를 올려 값 확인 · 클릭/터치로 값 고정</p>
      </div>

      <div
        style={{ height }}
        className="w-full min-w-0 max-w-full overflow-hidden px-2 py-3"
      >
        <Line
          data={data}
          options={options}
          role="img"
          aria-label={`${title} 측정 그래프. 방향키로 값을 선택하고 Escape로 해제합니다.`}
          tabIndex={0}
          onKeyDown={event => {
            if (event.key === "Escape") {setPinnedIndex(null); setActiveIndex(null);}
            else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              if (points.length) setPinnedIndex(Math.max(0, Math.min(points.length - 1, (selectedIndex ?? 0) + (event.key === "ArrowLeft" ? -1 : 1))));
            }
          }}
        />
      </div>
      <div className="mx-3 mb-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-950 dark:bg-sky-950 dark:text-sky-100" style={{minHeight: 48 + series.length * 24}}>
        {selectedPoint ? <>
          <div className="flex min-h-8 items-center justify-between gap-2"><span>{String(selectedPoint.at ?? selectedPoint.t)}{pinnedIndex != null ? " · 선택 고정" : ""}</span>{pinnedIndex != null && <button type="button" onClick={() => {setPinnedIndex(null); setActiveIndex(null);}} className="min-h-8 shrink-0 cursor-pointer font-bold underline">고정 해제</button>}</div>
          {series.map(item => <p key={item.key} className="mt-1 font-bold">{item.name}: {toNumber(selectedPoint[item.key])?.toLocaleString("ko-KR", {maximumFractionDigits: 6}) ?? "측정 안됨"}</p>)}
        </> : <p className="py-2">그래프의 지점을 선택하면 시각과 측정값이 표시됩니다.</p>}
      </div>
    </section>
  );
}
