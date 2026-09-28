"use client";

import SiteSearchModal from "@/components/common/site-search-modal";
import SearchIcon from "@/components/icons/search-icon";
import { useModal } from "@/components/provider/modal-provider";
import { useAuth } from "@/components/provider/auth-provider";
import { useTheme } from "@/components/provider/theme-provider";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const ICON_BUTTON =
  "inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-white/85 transition hover:bg-white/12 hover:text-white focus-visible:bg-white/12";

export default function Navbar() {
  const { isDark, isLargeText, toggleTheme, toggleLargeText } = useTheme();
  const { session, isAdmin, logout } = useAuth();
  const { open: openSearchModal } = useModal("SearchModal");
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    function close(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  const initial = session?.name?.trim().charAt(0) || session?.email?.charAt(0).toUpperCase() || "나";

  return (
    <>
      <header className="mobile-safe-header sticky top-0 z-50 h-14 w-full border-b border-white/8 bg-[linear-gradient(110deg,#123b5d_0%,#18557b_58%,#1c668a_100%)] shadow-[0_8px_30px_rgba(13,42,63,0.12)] dark:bg-[linear-gradient(110deg,#1d303f_0%,#243f52_100%)]">
        <div className="mobile-safe-nav mx-auto flex h-full w-full max-w-7xl items-center justify-between px-3 sm:px-4 lg:px-6">
          <Link href="/" className="group flex shrink-0 cursor-pointer items-center gap-2.5 text-white">
            <Image src="/favicon/android-chrome-192x192.png" alt="MrEyes" width={32} height={32} priority
              className="h-8 w-8 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.16)] transition-transform group-hover:-rotate-3 group-hover:scale-105" />
            <span className="hidden text-[15px] font-bold tracking-[-0.02em] sm:inline">MrEyes</span>
          </Link>

          <nav className="flex items-center gap-1.5">
            {session && (
              <button type="button" className={ICON_BUTTON} onClick={openSearchModal} aria-label="병원 검색">
                <SearchIcon className="h-5 w-5" />
              </button>
            )}

            {session ? (
              <div className="relative" ref={menuRef}>
                <button type="button" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}
                  className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/10 py-1 pr-2 pl-1 text-white transition hover:border-white/25 hover:bg-white/16 sm:pr-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-extrabold text-[#174d70] shadow-sm">
                    {initial}
                  </span>
                  <span className="hidden min-w-0 text-left sm:block">
                    <span className="block max-w-28 truncate text-xs font-bold leading-4">{session.name}</span>
                    <span className="block text-[10px] leading-3 text-white/65">{roleLabel(session.role)}</span>
                  </span>
                  <ChevronIcon className={`hidden h-4 w-4 text-white/70 transition sm:block ${menuOpen ? "rotate-180" : ""}`} />
                </button>

                {menuOpen && (
                  <div role="menu" className="absolute top-[calc(100%+10px)] right-0 w-[min(19rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-black/5 bg-white p-2 text-text-major shadow-[0_20px_60px_rgba(12,37,54,0.22)] dark:border-white/10 dark:bg-background-dark-card dark:text-text-dark-primary">
                    <div className="px-3 pt-2 pb-3">
                      <p className="truncate text-sm font-bold">{session.name}</p>
                      <p className="text-text-secondary dark:text-text-dark-primary/55 mt-0.5 truncate text-xs">{session.email}</p>
                    </div>
                    <div className="h-px bg-slate-100 dark:bg-white/8" />
                    <div className="py-1.5">
                      <MenuLink href="/" icon={<HomeIcon />}>대시보드</MenuLink>
                      <MenuLink href="/baselines" icon={<GaugeIcon />}>알림 관리</MenuLink>
                      {isAdmin && <MenuLink href="/admin" icon={<UsersIcon />}>사용자 관리</MenuLink>}
                      <MenuLink href="/account" icon={<PersonIcon />}>내 계정</MenuLink>
                    </div>
                    <div className="h-px bg-slate-100 dark:bg-white/8" />
                    <div className="grid grid-cols-2 gap-2 p-2">
                      <PreferenceButton active={isLargeText} onClick={toggleLargeText} icon={<TextIcon />}>큰 글씨</PreferenceButton>
                      <PreferenceButton active={isDark} onClick={toggleTheme} icon={isDark ? <SunIcon /> : <MoonIcon />}>
                        {isDark ? "밝게" : "어둡게"}
                      </PreferenceButton>
                    </div>
                    <button type="button" role="menuitem" onClick={async () => {
                      setMenuOpen(false);
                      await logout();
                      router.replace("/login");
                    }} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30">
                      <LogoutIcon /> 로그아웃
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="cursor-pointer rounded-full bg-white px-4 py-2 text-sm font-bold text-[#174d70] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                로그인
              </Link>
            )}
          </nav>
        </div>
      </header>
      <SiteSearchModal />
    </>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <Link role="menuitem" href={href} className="text-text-major dark:text-text-dark-primary flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-slate-100/80 dark:hover:bg-white/7">
    <span className="text-brand-primary dark:text-sky-300 flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/35">{icon}</span>{children}
  </Link>;
}

function PreferenceButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${active ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-text-dark-primary/70 dark:hover:bg-white/5"}`}>{icon}{children}</button>;
}

function roleLabel(role: string) { return role === "SUPER_ADMIN" ? "최고관리자" : role === "ADMIN" ? "관리자" : "사용자"; }
const iconClass = "h-[18px] w-[18px]";
function ChevronIcon({ className }: { className?: string }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>; }
function HomeIcon() { return <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg>; }
function GaugeIcon() { return <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19a8 8 0 1 1 16 0"/><path d="m12 15 4-4"/><path d="M8 19h8"/></svg>; }
function UsersIcon() { return <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6M16 5a3 3 0 0 1 0 6M17 14c2.7.4 4 2.3 4 5"/></svg>; }
function PersonIcon() { return <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>; }
function TextIcon() { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>; }
function MoonIcon() { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>; }
function SunIcon() { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>; }
function LogoutIcon() { return <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg>; }
