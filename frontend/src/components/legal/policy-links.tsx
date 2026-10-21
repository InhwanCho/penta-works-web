import Link from "next/link";

export default function PolicyLinks({ className = "" }: { className?: string }) {
  return <nav aria-label="서비스 안내 및 정책" className={`policy-links ${className}`}>
    <Link href="/about">서비스 소개</Link>
    <Link href="/terms">이용약관</Link>
    <Link href="/privacy" className="font-bold">개인정보 처리방침</Link>
  </nav>;
}
