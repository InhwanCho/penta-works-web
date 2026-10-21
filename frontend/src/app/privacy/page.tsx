import type { Metadata } from "next";
import LegalPage from "@/components/legal/legal-page";
export const metadata: Metadata = { title: "개인정보 처리방침", alternates: { canonical: "/privacy" } };
export default function PrivacyPage() {
  return <LegalPage title="MReyes(엠알아이즈) 개인정보 처리방침" description="주식회사 펜타웍스는 MReyes 이용자의 개인정보를 보호하고 관련 문의를 처리하기 위해 다음과 같이 개인정보 처리방침을 안내합니다." document effectiveDate="2026-11-02">
    <section><h2>1. 개인정보의 처리 목적과 항목</h2>
      <p>① 계정 관리: 이름, 이메일, 비밀번호 해시, 전화번호, 소속 회사와 권한을 가입·로그인, 접근 권한 관리 및 알림 수신에 사용합니다.</p>
      <p>② 회사 확인: 관리자가 등록한 회사 정보, 사업자등록번호 및 사업자등록증을 회사 등록·확인에 사용합니다.</p>
      <p>③ 업무 관리: 병원 연락 담당자·연락처, 업무 작성자·담당자, 일정, 업무 내용 및 첨부 사진을 현장 서비스와 업무 이력 관리에 사용합니다.</p>
      <p>④ 알림·보안: 수신처, 알림 설정, 확인·발송 이력, 로그인 세션 및 주요 변경 기록을 알림 제공과 계정 보호에 사용합니다.</p>
      <p>⑤ Google 연동: 연결한 경우 인증 토큰, 전용 캘린더 ID, 일정 연결 정보와 반영 상태를 캘린더 자동 반영에 사용합니다.</p>
    </section>
    <section><h2>2. 개인정보의 보유기간과 파기</h2>
      <p>① 계정정보는 서비스 이용 중 보관하며, 이용 종료 등으로 불필요해지면 지체 없이 파기합니다. 법령상 보존 의무가 있는 정보는 해당 기간 동안 분리하여 보관합니다.</p>
      <p>② 회사 업무기록과 사진은 고객 회사의 계약·업무 목적에 필요한 기간 보관합니다. 직원의 계정 종료와 회사 업무기록의 반환·파기는 구분하여 처리합니다.</p>
      <p>③ 만료된 로그인 세션·초대·비밀번호 재설정 토큰은 만료 후 30일이 지난 항목을 매일 정리합니다. Google 재연결용 인증 토큰은 연결 해제 시 삭제합니다.</p>
      <p>④ 파기 대상 전자정보는 복구·재생되지 않는 방법으로 삭제합니다.</p>
    </section>
    <section><h2>3. 개인정보 처리의 위탁</h2>
      <p>– 주식회사 케이넷(바로빌): 알림톡·문자 발송과 결과 확인을 위해 수신 전화번호·알림 내용을 처리합니다. <a href="https://www.barobill.co.kr/join/privacy_rule.asp" target="_blank" rel="noreferrer">바로빌 개인정보처리방침</a></p>
      <p>– 주식회사 다음(Daum 메일): 계정 초대·비밀번호 재설정 메일 발송을 위해 수신 이메일 주소·이름·메일 내용을 처리합니다. <a href="https://daumcorp.com/" target="_blank" rel="noreferrer">서비스 운영사 안내</a></p>
      <p>서비스 서버는 주식회사 펜타웍스가 인천광역시 남동구 호구포로74번길 78 (고잔동) 소재 사업장에서 직접 운영합니다.</p>
    </section>
    <section><h2>4. Google Calendar 연동과 국외 처리</h2>
      <p>① 연동은 선택 기능입니다. 연결한 사용자가 볼 수 있는 업무기록·일정·점검 기한을 앱이 만든 전용 캘린더에 반영합니다. 기존 개인 캘린더의 일정을 가져오지는 않습니다.</p>
      <p>② 전송 항목은 일정 제목, 날짜·시간, 내용, 병원명 및 관련 링크입니다. 내용에 작성된 담당자 이름 등 개인정보도 포함될 수 있습니다. 연동·자동 반영·수동 반영 시 Google Calendar API를 통해 전송합니다.</p>
      <p>③ 이전받는 자는 Google LLC(미국, 1600 Amphitheatre Parkway, Mountain View, CA 94043)입니다. 개인정보 문의는 <a href="mailto:googlekrsupport@google.com">googlekrsupport@google.com</a>으로 할 수 있습니다. 목적은 사용자가 요청한 캘린더 연동과 일정 저장·관리입니다.</p>
      <p>④ Google은 미국을 포함한 여러 국가의 서버에서 정보를 처리한다고 공개하고 있습니다. 일반 Google Calendar 계정별 저장·처리 국가는 공개 문서에서 특정되지 않습니다. 이 서비스는 특정 국가에만 저장된다고 보장하지 않습니다. <a href="https://policies.google.com/privacy?hl=ko" target="_blank" rel="noreferrer">Google의 데이터 이전 안내</a>를 함께 확인할 수 있습니다.</p>
      <p>⑤ Google 계정에 저장된 일정은 사용자가 삭제할 때까지 유지될 수 있으며, 삭제 후 활성 시스템과 백업에서 제거되기까지 시간이 걸릴 수 있습니다. 보안·법적 의무에 따라 더 오래 보관되는 정보가 있을 수 있습니다. <a href="https://policies.google.com/technologies/retention?hl=ko" target="_blank" rel="noreferrer">Google 데이터 보관 안내</a>를 따릅니다.</p>
      <p>⑥ 연결하지 않으면 정보를 전송하지 않습니다. MReyes 설정에서 연결을 해제하거나 Google 계정에서 접근 권한을 철회할 수 있습니다. 해제하면 추가 전송이 중단되며 다른 MReyes 기능은 계속 이용할 수 있습니다. 이미 반영된 일정은 Google Calendar에서 별도로 삭제할 수 있습니다.</p>
      <p>⑦ Google API로 받은 정보는 연동 기능 제공에 사용하며 광고 목적으로 이용하거나 판매하지 않습니다. 해당 정보의 이용·전송은 <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>와 Limited Use 요건을 따릅니다. Google의 처리 방식은 <a href="https://policies.google.com/privacy?hl=ko" target="_blank" rel="noreferrer">Google 개인정보처리방침</a>에서 확인할 수 있습니다.</p>
    </section>
    <section><h2>5. 이용자의 권리와 행사 방법</h2>
      <p>이용자는 자신의 개인정보에 대한 열람, 정정·삭제, 처리정지 또는 동의 철회를 요청할 수 있습니다. 아래 이메일로 접수하면 본인과 요청 권한을 확인하여 관련 법령에 따라 처리합니다. 회사 업무기록에 관한 요청은 해당 회사의 권한과 보존 의무를 함께 확인합니다.</p>
    </section>
    <section><h2>6. 안전성 확보와 쿠키·브라우저 저장소</h2>
      <p>계정 인증과 회사·사용자별 접근 권한을 적용하고, 비밀번호는 해시로, Google 재연결용 토큰은 암호화하여 저장합니다. 로그인과 화면 설정 유지를 위해 쿠키·브라우저 저장소를 사용합니다. 브라우저에서 이를 삭제하거나 제한할 수 있으며, 로그인 또는 화면 설정이 초기화될 수 있습니다.</p>
    </section>
    <section><h2>7. 개인정보 보호책임자와 문의처</h2>
      <p>– 개인정보 보호책임자: 조재영</p>
      <p>– 개인정보 실무 담당자: 조인환</p>
      <p>– 문의 이메일: <a href="mailto:ihcho@pentaworks.net">ihcho@pentaworks.net</a></p>
      <p>– 운영사: 주식회사 펜타웍스 / 사업자등록번호: 675-87-00483</p>
      <p>– 주소: 인천광역시 남동구 호구포로74번길 78 (고잔동)</p>
    </section>
    <section><h2>8. 시행과 변경 안내</h2><p>이 개인정보 처리방침은 2026년 11월 2일부터 시행합니다. 내용이 변경되면 이 페이지에 변경 내용과 시행일을 안내하며, 별도의 고지나 동의가 필요한 경우 관련 법령에 따른 절차를 진행합니다.</p></section>
  </LegalPage>;
}
