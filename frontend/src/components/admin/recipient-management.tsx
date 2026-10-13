"use client";
import Link from "next/link";
export default function RecipientManagement({ sites }: { sites: {siteid: string; name: string | null}[] }) {
  return <section className="rounded-xl border p-4 space-y-3">
    <h2 className="font-bold">대시보드와 알림 수신 병원이 연결됩니다</h2>
    <p>별도 수신처 등록 없이, 각 담당자의 계정에 저장된 휴대폰번호로 알림을 보냅니다.</p>
    <p>접근 가능한 병원 중 숨기지 않은 병원이 대상입니다. 숨기면 알림이 중지되고, 다시 표시하면 기존 알림 설정으로 재개합니다. 검색·상태 필터는 수신에 영향을 주지 않습니다.</p>
    <p>관리자는 전체 병원({sites.length}개)이 기본 대상입니다. 병원별 알림 조건과 제외 시간은 그대로 적용됩니다.</p>
    <Link href="/account" className="inline-flex min-h-11 items-center text-sky-700 underline">내 휴대폰번호 확인</Link>
  </section>;
}
