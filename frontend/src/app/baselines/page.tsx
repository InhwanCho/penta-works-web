import BaselinesPageClient from "@/components/baselines/baselines-page-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "알림 관리",
  description: "내 병원별 알림 기준과 회원 공통 수신 시간을 설정합니다.",
};

export default function BaselinesPage() {
  return <BaselinesPageClient />;
}
