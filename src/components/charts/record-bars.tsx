"use client";

import { readChartPalette } from "@/lib/css-vars";
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    Tooltip,
} from "chart.js";
import React from "react";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export type RecordMetric = { key: string; value: number | null };

export function RecordBars({
  title,
  metrics,
}: {
  title: string;
  metrics: RecordMetric[];
}) {
  const [palette, setPalette] = React.useState(readChartPalette());

  React.useEffect(() => {
    setPalette(readChartPalette());
  }, []);

  const labels = metrics.map((m) => m.key);
  const values = metrics.map((m) => m.value);

  const data = React.useMemo(() => {
    return {
      labels,
      datasets: [
        {
          label: "value",
          data: values,
          borderColor: palette.customBlue,
          backgroundColor: palette.customBlue,
          borderWidth: 1,
        },
      ],
    };
  }, [labels, values, palette]);

  const options = React.useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          ticks: { color: palette.textMajor },
          grid: { color: palette.borderTable },
        },
        y: {
          ticks: { color: palette.textMajor },
          grid: { color: palette.borderTable },
        },
      },
    };
  }, [palette]);

  return (
    <section
      style={{
        border: `1px solid ${palette.borderTable}`,
        borderRadius: 12,
        overflow: "hidden",
        background: palette.backgroundPrimary,
      }}
    >
      <div style={{ padding: 12, borderBottom: `1px solid ${palette.borderTable}` }}>
        <strong style={{ color: palette.textMajor }}>{title}</strong>
      </div>
      <div style={{ height: 360, padding: 12 }}>
        <Bar data={data as any} options={options as any} />
      </div>
    </section>
  );
}
