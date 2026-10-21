import PolicyLinks from "./policy-links";
export default function SiteFooter() {
  return <footer className="site-footer">
    <div><strong>MReyes</strong><span>병원 장비 모니터링 · 현장 서비스 관리</span></div>
    <PolicyLinks />
    <p>© {new Date().getFullYear()} PENTAWORKS</p>
  </footer>;
}
