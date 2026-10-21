import type { Metadata } from "next";
import LegalPage from "@/components/legal/legal-page";
export const metadata: Metadata = { title: "개인정보 처리방침", alternates: { canonical: "/privacy" } };
export default function PrivacyPage() {
  return <LegalPage title="개인정보 처리방침" description="MReyes에서 개인정보를 처리하는 목적과 이용자의 권리를 안내합니다." draft>
    <section><h2>1. 적용 범위와 처리 주체</h2><p>이 문서는 MReyes 웹 서비스와 휴대폰에서 사용하는 서비스에 적용됩니다. 운영사와 고객 회사는 서비스 운영 및 회사 업무 관리 과정에서 각각의 역할에 따라 개인정보를 처리합니다.</p><p className="legal-pending">확인할 사항: 운영사의 정식 명칭·소재지, 고객 회사와의 개인정보 처리 위탁 관계 및 책임 범위.</p></section>
    <section><h2>2. 처리하는 정보와 목적</h2><div className="legal-table-wrap"><table><caption className="sr-only">정보 종류별 처리 항목과 목적</caption><thead><tr><th>구분</th><th>항목과 이용 목적</th></tr></thead><tbody>
      <tr><th>계정·회사</th><td>이름, 이메일, 전화번호, 소속 회사, 역할 및 접근 권한을 가입·로그인, 사용자 식별, 회사별 업무 접근 및 알림 수신에 사용합니다. 비밀번호는 해시 형태로 저장합니다.</td></tr>
      <tr><th>회사 등록</th><td>회사를 등록하는 관리자가 입력한 회사 정보, 사업자등록번호 및 사업자등록증 파일을 회사 등록과 확인에 사용합니다. 파일에 포함된 개인정보도 처리 대상이 될 수 있습니다.</td></tr>
      <tr><th>업무 관리</th><td>병원 연락 담당자·연락처, 업무기록 작성자·담당자, 일정, 내용 및 첨부 사진을 현장 서비스와 이력 관리에 사용합니다.</td></tr>
      <tr><th>알림·이용 기록</th><td>알림 수신처, 개인 알림 기준, 확인·중지 이력, 발송 결과, 로그인 세션과 주요 변경 기록을 알림 제공, 계정 보호 및 운영 관리에 사용합니다.</td></tr>
      <tr><th>구글캘린더</th><td>사용자가 연결한 경우 Google 연동 인증 정보, 전용 캘린더 ID, 일정 연결 정보 및 반영 상태를 저장해 일정 자동 반영에 사용합니다. 재연결에 사용하는 인증 토큰은 암호화해 저장합니다.</td></tr>
    </tbody></table></div><p>업무기록과 사진에 환자 정보 등 서비스 목적에 필요하지 않은 개인정보를 입력하지 않도록 유의해 주세요.</p></section>
    <section><h2>3. Google 계정과 캘린더 연동</h2><p>연동은 사용자가 선택한 경우에만 활성화됩니다. MReyes는 Google의 <code>calendar.app.created</code> 권한을 요청하며, 앱이 만든 보조 캘린더와 그 안의 일정을 관리합니다.</p><p>업무기록·일정·점검 기한의 제목, 날짜·시간, 내용, 병원명과 관련 링크가 Google에 전송됩니다. 연결한 사용자가 MReyes에서 볼 수 있는 범위의 정보를 반영합니다. 기존 개인 캘린더의 일정을 조회하거나 가져오지는 않습니다.</p><p>설정에서 연결을 해제하면 추가 전송을 중단합니다. 이미 Google에 반영된 전용 캘린더와 일정은 남으므로, 필요한 경우 Google Calendar에서 직접 삭제할 수 있습니다. Google 계정의 연결된 앱 관리에서도 접근 권한을 철회할 수 있습니다.</p><p>Google API로 받은 정보는 캘린더 연동 기능 제공에 사용하며, 광고 목적으로 이용하거나 판매하지 않습니다. 해당 정보의 이용 및 전송은 <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>와 Limited Use 요건을 따릅니다.</p></section>
    <section><h2>4. 보유기간과 파기</h2><p>처리 목적이 달성되거나 보유기간이 끝난 개인정보는 관련 법령에 따른 보존 사유가 있는 경우를 제외하고 파기해야 합니다. 업무 이력과 계정 정보의 처리 범위는 고객 회사와의 계약 및 업무 관리 권한에 따라 확인이 필요합니다.</p><p className="legal-pending">확인할 사항: 계정·업무기록·사진·접속 및 감사 기록·연동 인증 정보의 항목별 보유기간, 이용 종료 후 삭제 절차, 백업에서의 삭제 주기.</p></section>
    <section><h2>5. 처리 위탁·제3자 제공·국외 이전</h2><p>알림 발송, 이메일 전송, 서버 운영 및 Google Calendar 연동에 외부 서비스가 사용될 수 있습니다. 실제 계약과 운영 환경에 맞춰 아래 사항을 확정한 뒤 공개합니다.</p><p className="legal-pending">확인할 사항: 수탁자와 재수탁자, 위탁 업무, 제3자 제공 여부 및 근거. Google 연동 등 국외 이전에 해당하는 경우에는 수령자·국가·항목·목적·시기와 방법·보유기간·법적 근거·거부 방법 및 영향을 함께 기재합니다.</p></section>
    <section><h2>6. 이용자의 권리</h2><p>이용자는 자신의 개인정보에 대한 열람, 정정·삭제, 처리정지 또는 동의 철회 등을 요청할 수 있습니다. 회사 업무기록이나 다른 이용자의 정보가 포함된 경우에는 요청자의 권한과 관련 법령을 확인하여 처리합니다.</p><p>Google 연동은 설정에서 해제할 수 있고, 계정 및 업무 데이터에 관한 요청은 소속 회사 관리자와 운영사 문의처를 통해 접수하도록 구성합니다.</p><p className="legal-pending">확인할 사항: 개인정보 보호책임자·담당 부서·공식 문의 이메일 및 권리 행사 접수·처리 절차.</p></section>
    <section><h2>7. 안전성 확보와 저장 장치</h2><p>MReyes는 계정 인증, 회사·사용자별 접근 권한, 비밀번호 해시, 연동 토큰 암호화 등으로 정보를 보호합니다. 로그인 세션과 화면 설정 유지를 위해 쿠키 및 브라우저 저장소를 사용합니다. 브라우저에서 저장 정보를 지우면 로그인이나 화면 설정이 초기화될 수 있습니다.</p><p className="legal-pending">확인할 사항: 실제 운영 중인 접속 기록 보관, 접근 통제·백업·파기 체계와 추가 분석 도구 또는 자동 수집 항목.</p></section>
    <section><h2>8. 시행과 변경 안내</h2><p>이 페이지는 검토용 초안입니다. 시행일과 변경 이력은 운영 정보와 정책을 확정한 뒤 게시합니다.</p></section>
  </LegalPage>;
}
