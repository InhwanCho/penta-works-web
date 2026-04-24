import BaselinesClient from "@/components/baselines/baselines-client";
import { getBaselineEntries, BASELINE_TOLERANCE } from "@/lib/baseline-map";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "병원 기준값 (hePsi)",
  description: "병원별 hePsi 기준값과 허용범위를 확인합니다.",
};

export default function BaselinesPage() {
  const entries = getBaselineEntries();
  const tolerancePct = Math.round(BASELINE_TOLERANCE * 100);
  return (
    <BaselinesClient
      entries={entries}
      tolerancePct={tolerancePct}
    />
  );
}
