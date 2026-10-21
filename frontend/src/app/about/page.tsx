import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal/legal-page";
export const metadata: Metadata = { title: "서비스 소개", description: "MReyes 병원 장비 모니터링 및 현장 서비스 관리", alternates: { canonical: "/about" } };
export default function AboutPage() {
  return <LegalPage title="병원 장비와 업무를 한곳에서" description="MReyes는 장비 상태를 살피고, 현장 서비스와 팀 일정을 함께 관리하는 업무 서비스입니다.">
    <section><h2>장비 모니터링</h2><p>병원별 측정값과 수집 상태를 확인하고, 사용자가 설정한 기준에 따른 알림을 관리합니다.</p></section>
    <section><h2>현장 서비스 관리</h2><p>병원별 업무기록, 장비·부품 이력, 점검 기준과 팀 일정을 관리합니다. 회사와 사용자 권한에 따라 접근할 수 있는 병원과 정보가 달라집니다.</p></section>
    <section><h2>선택해서 사용하는 구글캘린더 연동</h2><p>Google 계정을 연결하면 MReyes 업무 일정 전용 캘린더를 만들어, 접근 권한이 있는 업무기록·일정·점검 기한을 반영합니다. MReyes에서 변경하면 자동 반영하며, 10분마다 다시 확인합니다.</p><p>기존 개인 캘린더의 일정을 가져오는 기능은 아닙니다. 연결은 설정에서 해제할 수 있습니다.</p></section>
    <section><h2>초대받은 계정으로 이용하세요</h2><p>회사 관리자의 초대를 받아 가입한 뒤 로그인할 수 있습니다.</p><Link href="/login" className="legal-login">MReyes 로그인 →</Link></section>
  </LegalPage>;
}
