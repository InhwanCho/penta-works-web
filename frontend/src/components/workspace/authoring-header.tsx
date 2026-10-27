import Link from "@/components/common/app-link";

export default function AuthoringHeader({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  return <header className="work-authoring-header">
    <Link href={backHref} className="work-authoring-back" aria-label={backLabel}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12" /></svg>
    </Link>
    <h1>{title}</h1>
  </header>;
}
