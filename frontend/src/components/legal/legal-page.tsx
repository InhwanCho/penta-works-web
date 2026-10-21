import Link from "next/link";
import PolicyLinks from "./policy-links";
import type { ReactNode } from "react";

export default function LegalPage({ title, description, draft = false, document = false, children }: {
  title: string; description: string; draft?: boolean; document?: boolean; children: ReactNode;
}) {
  return <div className={document ? "legal-document-surface" : undefined}><main className={`legal-page${document ? " legal-document" : ""}`}>
    <header>
      {!document && <Link href="/about" className="legal-brand">MReyes</Link>}
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
    {draft && <aside className="legal-draft" role="note"><p>※ 검토용 초안입니다. 보관·파기 절차와 외부 처리업체 정보 등을 확정한 뒤 시행합니다.</p></aside>}
    <article>{children}</article>
    <div className="legal-page-end"><PolicyLinks /><Link href="/login" className="legal-login">로그인으로 이동 →</Link></div>
  </main></div>;
}
