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
}: {
  title: string;
  points: TimeSeriesPoint[];
  series: Series[];
  height?: number;
}) {
  const labels = points.map((p) => p.t);

  const dark = useDarkMode();
  const palette = linePaletteBase();
  const { grid, border } = gridColors(dark);

  const [zoomReady, setZoomReady] = React.useState(false);

  React.useEffect(() => {
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
  }, []);

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
        tension: 0.25,
        spanGaps: true,
        borderColor: dark ? base : hexToRgba(base, 0.65),
        backgroundColor: "transparent",
      };
    }),
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: series.length > 1,
        labels: {
          color: cssVar(
            "--color-text-major",
            dark ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.90)",
          ),
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
          pointStyle: "line",
        },
      },
      tooltip: { enabled: true },

      // zoom 플러그인은 준비된 이후에만 옵션을 넣는 것이 안전합니다.
      ...(zoomReady
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
            "--color-text-secondary",
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
            "--color-text-secondary",
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
    <section className="dark:bg-background-dark-card dark:border-background-dark-secondary mt-4 overflow-hidden rounded-xl border bg-white">
      <div className="dark:border-background-dark-secondary border-b px-4 py-3">
        <strong className="text-text-major dark:text-text-dark-primary text-sm">
          {title}
        </strong>
        <div className="text-text-secondary dark:text-text-dark-primary/70 mt-1 text-[11px]">
          확대/축소: 마우스휠 또는 핀치 / 이동: Shift + 드래그
        </div>
      </div>

      <div
        style={{ height }}
        className="px-2 py-3"
      >
        <Line
          data={data}
          options={options}
        />
      </div>
    </section>
  );
}
