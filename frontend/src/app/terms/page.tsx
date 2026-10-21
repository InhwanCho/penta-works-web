import type { Metadata } from "next";
import LegalPage from "@/components/legal/legal-page";
export const metadata: Metadata = { title: "이용약관", alternates: { canonical: "/terms" } };
export default function TermsPage() {
  return <LegalPage title="MReyes(엠알아이즈) 이용약관" description="MReyes 이용에 관한 기본 사항입니다." draft document>
    <section><h2>1. 서비스 이용</h2><p>MReyes는 병원 장비 모니터링, 알림, 업무기록 및 일정 관리를 제공합니다. 이용자는 소속 회사의 초대와 부여된 권한에 따라 서비스를 이용합니다.</p></section>
    <section><h2>2. 계정과 권한 관리</h2><p>이용자는 자신의 계정을 안전하게 관리하고 다른 사람과 공유하지 않아야 합니다. 회사 관리자는 소속 직원의 가입·역할·병원 접근 권한을 관리합니다.</p></section>
    <section><h2>3. 업무 정보의 입력과 이용</h2><p>이용자는 업무 수행에 필요한 정보만 입력하고, 타인의 권리를 침해하거나 권한 없이 개인정보를 등록하지 않아야 합니다. 회사 관리자는 업무 정보와 첨부 파일의 접근 범위를 적절히 관리해야 합니다.</p></section>
    <section><h2>4. 모니터링과 알림</h2><p>모니터링 정보와 알림은 수집 상태, 통신 환경 및 사용자의 수신 설정에 따라 달라질 수 있습니다. 이용자는 실제 장비 상태와 현장 상황을 함께 확인하여 업무를 판단해야 합니다.</p></section>
    <section><h2>5. 외부 서비스 연동</h2><p>구글캘린더 연결은 선택 기능입니다. 사용자가 허용하면 접근 가능한 업무 정보가 전용 캘린더에 반영되며, 연결 해제 후에도 이미 반영된 일정은 Google에 남을 수 있습니다. 외부 서비스의 이용에는 해당 제공자의 정책이 함께 적용됩니다.</p></section>
    <section><h2>6. 계약과 서비스 운영</h2><p>서비스명은 MReyes(엠알아이즈)이고 운영사는 주식회사 펜타웍스이며, 문의 이메일은 ihcho@pentaworks.net입니다. 이용 요금, 계약 기간, 서비스 제공 범위 및 이용 종료에 관한 조건은 운영사와 고객 회사의 계약에서 정합니다.</p></section>
  </LegalPage>;
}
