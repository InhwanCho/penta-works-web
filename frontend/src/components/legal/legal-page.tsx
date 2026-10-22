import Link from "@/components/common/app-link";
import PolicyLinks from "./policy-links";
import type { ReactNode } from "react";

export default function LegalPage({ title, description, draft = false, document = false, effectiveDate, children }: {
  title: string; description: string; draft?: boolean; document?: boolean; effectiveDate?: string; children: ReactNode;
}) {
  return <div className={document ? "legal-document-surface" : undefined}><main className={`legal-page${document ? " legal-document" : ""}`}>
    <header>
      {!document && <Link href="/about" className="legal-brand">MReyes</Link>}
      <h1>{title}</h1>
      <p>{description}</p>
      {effectiveDate && <p className="legal-effective-date">시행일: <time dateTime={effectiveDate}>{effectiveDate.replaceAll("-", ". ")}</time></p>}
    </header>
    {draft && <aside className="legal-draft" role="note"><p>※ 최종 시행 전 검토용 초안입니다.</p></aside>}
    <article>{children}</article>
    <div className="legal-page-end"><PolicyLinks /></div>
  </main></div>;
}
