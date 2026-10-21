import PolicyLinks from "./policy-links";
export default function SiteFooter() {
  return <footer className="site-footer">
    <div className="site-footer-heading"><strong>MReyes</strong><PolicyLinks /></div>
    <address className="site-footer-company">
      <span>운영사: 주식회사 펜타웍스</span>
      <span>사업자등록번호: 675-87-00483</span>
      <span>주소: 인천광역시 남동구 호구포로74번길 78 (고잔동)</span>
      <span>문의: <a href="mailto:ihcho@pentaworks.net">ihcho@pentaworks.net</a></span>
    </address>
    <p>© {new Date().getFullYear()} PENTAWORKS. All rights reserved.</p>
  </footer>;
}
