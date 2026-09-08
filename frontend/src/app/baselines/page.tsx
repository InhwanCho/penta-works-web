import BaselinesPageClient from "@/components/baselines/baselines-page-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "병원 기준값 (hePsi)",
  description: "병원별 hePsi 알림 허용범위를 확인합니다.",
};

export default function BaselinesPage() {
  return <BaselinesPageClient />;
}
