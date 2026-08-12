import BaselinesClient from "@/components/baselines/baselines-client";
import { type PsiThreshold, getPsiThresholds } from "@/lib/alert-settings";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "병원 기준값 (hePsi)",
  description: "병원별 hePsi 알림 허용범위를 확인합니다.",
};

export default async function BaselinesPage() {
  // 하드코딩 상수를 쓰던 시절에는 실패할 수 없었지만 이제는 DB에 의존합니다.
  // 조회가 실패해도 navbar/돌아가기 링크가 살아있도록 여기서 흡수하고
  // 빈 목록 + 안내 배너로 degrade 시킵니다.
  let entries: PsiThreshold[] = [];
  let loadFailed = false;

  try {
    entries = await getPsiThresholds();
  } catch (e) {
    console.error("[baselines] 임계값 조회 실패", e);
    loadFailed = true;
  }

  return (
    <BaselinesClient
      entries={entries}
      loadFailed={loadFailed}
    />
  );
}
