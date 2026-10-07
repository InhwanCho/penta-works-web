import BaselinesPageClient from "@/components/baselines/baselines-page-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "알림 관리",
  description: "내 병원별 알림 기준과 발송 제외 시간을 설정하고 담당자끼리 알림 설정을 공유합니다.",
};

export default function BaselinesPage() {
  return <BaselinesPageClient />;
}
