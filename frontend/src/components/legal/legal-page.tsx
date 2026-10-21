import Link from "next/link";
import PolicyLinks from "./policy-links";
import type { ReactNode } from "react";

export default function LegalPage({ title, description, draft = false, children }: {
  title: string; description: string; draft?: boolean; children: ReactNode;
}) {
  return <main className="legal-page">
    <header>
      <Link href="/about" className="legal-brand">MReyes</Link>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
    {draft && <aside className="legal-draft" role="note"><strong>검토용 초안</strong><p>운영사 정보, 문의처, 보관기간과 외부 처리업체를 확인 중입니다. 공식 시행 전 검토용 문서이며, Google OAuth 심사용 최종 처리방침으로 사용하지 않습니다.</p></aside>}
    <article>{children}</article>
    <div className="legal-page-end"><PolicyLinks /><Link href="/login" className="legal-login">로그인으로 이동 →</Link></div>
  </main>;
}
