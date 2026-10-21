"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/about", label: "서비스 소개" },
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보 처리방침" },
];
export default function PolicyLinks({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  return <nav aria-label="서비스 안내 및 정책" className={`policy-links ${className}`}>
    {links.map(({ href, label }) => <Link key={href} href={href}
      aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
