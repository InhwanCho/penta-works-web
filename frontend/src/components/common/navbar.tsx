"use client";

import LogoutControls from "@/components/account/logout-controls";
import { useUnreadAlerts } from "@/hooks/use-unread-alerts";
import UnreadAlertDot from "./unread-alert-dot";
import dynamic from "next/dynamic";
import SearchIcon from "@/components/icons/search-icon";
import { useModal } from "@/components/provider/modal-provider";
import { useAuth } from "@/components/provider/auth-provider";
import { useTheme } from "@/components/provider/theme-provider";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const ICON_BUTTON =
  "inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white/85 transition hover:bg-white/12 hover:text-white focus-visible:bg-white/12";

const SiteSearchModal = dynamic(
  () => import("@/components/common/site-search-modal"),
  { ssr: false },
);

export default function Navbar() {
  const { isDark, isLargeText, toggleTheme, toggleLargeText } = useTheme();
  const { session, isAdmin } = useAuth();
  const { open: openSearchModal, isOpen: searchOpen } = useModal("SearchModal");
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    function close(event: MouseEvent) {
      if (document.querySelector("[data-logout-dialog][open]")) return;
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (document.querySelector("[data-logout-dialog][open]")) return;
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("click", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const smallScreen = window.matchMedia("(max-width: 1023px)");
    const content = document.getElementById("app-content");
    const previousOverflow = document.body.style.overflow;
    const previousInert = content?.inert ?? false;
    const sync = () => {
      if (content) content.inert = smallScreen.matches || previousInert;
      document.body.style.overflow = smallScreen.matches
        ? "hidden"
        : previousOverflow;
    };
    sync();
    smallScreen.addEventListener("change", sync);
    return () => {
      smallScreen.removeEventListener("change", sync);
      if (content) content.inert = previousInert;
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const close = () => {
      if (media.matches) setMenuOpen(false);
    };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);
  const unread = useUnreadAlerts();
  const goToAll = () => {
    setMenuOpen(false);
    window.dispatchEvent(new Event("dashboard-show-all"));
  };

  const initial =
    session?.name?.trim().charAt(0) ||
    session?.email?.charAt(0).toUpperCase() ||
    "나";

  return (
    <>
      {menuOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-[45] bg-slate-900/25 backdrop-blur-sm lg:hidden"
        />
      )}
      <header className="mobile-safe-header sticky top-0 z-50 h-14 w-full border-b border-white/8 bg-[linear-gradient(110deg,#123b5d_0%,#18557b_58%,#1c668a_100%)] shadow-[0_4px_18px_rgba(13,42,63,0.09)] dark:bg-[linear-gradient(110deg,#1d303f_0%,#243f52_100%)]">
        <div className="mobile-safe-nav mx-auto flex h-full w-full max-w-7xl items-center justify-between px-3 sm:px-4 lg:px-6">
          <Link
            href="/"
            onClick={goToAll}
            className="group flex shrink-0 cursor-pointer items-center gap-2.5 text-white"
          >
            <Image
              src="/favicon/android-chrome-192x192.png"
              alt="MReyes"
              width={32}
              height={32}
              priority
              className="h-8 w-8 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.16)] transition-transform group-hover:scale-105 group-hover:-rotate-3"
            />
            <span className="text-[15px] font-bold tracking-[-0.02em]">
              MReyes
            </span>
            {process.env.NEXT_PUBLIC_DEPLOY_ENV === "development" && (
              <span className="rounded border border-white/25 px-1.5 py-0.5 text-[10px] text-white/80">개발</span>
            )}
          </Link>

          <nav className="flex shrink-0 items-center gap-1.5">
            {session && (
              <Link
                href="/baselines?view=events"
                aria-label="알림 확인 및 관리"
                className={`${ICON_BUTTON} hidden lg:inline-flex`}
              >
                <BellIcon />
                {unread && <UnreadAlertDot />}
              </Link>
            )}
            {session && (
              <button
                type="button"
                className={ICON_BUTTON}
                onClick={() => {
                  setMenuOpen(false);
                  openSearchModal();
                }}
                aria-label="병원 검색"
              >
                <SearchIcon className="h-5 w-5" />
              </button>
            )}

            {session ? (
              <div
                className="relative hidden lg:block"
                ref={menuRef}
              >
                <button
                  type="button"
                  aria-label="내 계정 및 설정"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((value) => !value)}
                  className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/10 p-1 text-white transition hover:border-white/25 hover:bg-white/16 sm:w-auto sm:gap-2 sm:pr-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-extrabold text-[#174d70] shadow-sm">
                    {initial}
                  </span>
                  <span className="hidden min-w-0 text-left sm:block">
                    <span className="block max-w-28 truncate text-xs leading-4 font-bold">
                      {session.name}
                    </span>
                    <span className="block text-[10px] leading-3 text-white/65">
                      {roleLabel(session.role)}
                    </span>
                  </span>
                  <ChevronIcon
                    className={`hidden h-4 w-4 text-white/70 transition sm:block ${menuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="text-text-major dark:bg-background-dark-card dark:text-text-dark-primary absolute top-[calc(100%+10px)] right-0 w-[min(19rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-black/5 bg-white p-2 shadow-[0_12px_36px_rgba(12,37,54,0.16)] dark:border-white/10"
                  >
                    <div className="px-3 pt-2 pb-3">
                      <p className="truncate text-sm font-bold">
                        {session.name}
                      </p>
                      <p className="text-text-secondary dark:text-text-dark-primary/55 mt-0.5 truncate text-xs">
                        {session.email}
                      </p>
                    </div>
                    <div className="h-px bg-slate-100 dark:bg-white/8" />
                    <div className="py-1.5">
                      {session.role === "PLATFORM_ADMIN" && (
                        <MenuLink
                          onSelect={() => setMenuOpen(false)}
                          href="/companies"
                          icon={<CompanyIcon />}
                        >
                          회사 관리
                        </MenuLink>
                      )}
                      {isAdmin && (
                        <MenuLink
                          onSelect={() => setMenuOpen(false)}
                          href="/admin"
                          icon={<UsersIcon />}
                        >
                          관리 설정
                        </MenuLink>
                      )}
                      <MenuLink
                        onSelect={() => setMenuOpen(false)}
                        href="/account"
                        icon={<PersonIcon />}
                      >
                        내 계정
                      </MenuLink>
                    </div>
                    <div className="h-px bg-slate-100 dark:bg-white/8" />
                    <div className="grid grid-cols-2 gap-2 p-2">
                      <PreferenceButton
                        active={isLargeText}
                        onClick={toggleLargeText}
                        icon={<TextIcon />}
                      >
                        큰 글씨
                      </PreferenceButton>
                      <PreferenceButton
                        active={isDark}
                        onClick={toggleTheme}
                        icon={isDark ? <SunIcon /> : <MoonIcon />}
                      >
                        {isDark ? "밝게" : "어둡게"}
                      </PreferenceButton>
                    </div>
                    <LogoutControls compact />
                  </div>
                )}
              </div>
            ) : pathname !== "/accept-invite" ? (
              <Link
                href="/login"
                className="cursor-pointer rounded-full bg-white px-4 py-2 text-sm font-bold text-[#174d70] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                로그인
              </Link>
            ) : null}
          </nav>
        </div>
      </header>
      {searchOpen && <SiteSearchModal />}
    </>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onSelect,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Link
      role="menuitem"
      href={href}
      onClick={onSelect}
      className="text-text-major dark:text-text-dark-primary flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-slate-100/80 dark:hover:bg-white/7"
    >
      <span className="text-brand-primary flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/35 dark:text-sky-300">
        {icon}
      </span>
      {children}
    </Link>
  );
}

function PreferenceButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${active ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200" : "dark:text-text-dark-primary/70 border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"}`}
    >
      {icon}
      {children}
    </button>
  );
}

function roleLabel(role: string) {
  return role === "PLATFORM_ADMIN"
    ? "플랫폼 관리자"
    : role === "SUPER_ADMIN"
      ? "최고관리자"
      : role === "ADMIN"
        ? "관리자"
        : "사용자";
}
const iconClass = "h-[18px] w-[18px]";
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle
        cx="9"
        cy="8"
        r="3"
      />
      <path d="M3 20c0-4 2-6 6-6s6 2 6 6M16 5a3 3 0 0 1 0 6M17 14c2.7.4 4 2.3 4 5" />
    </svg>
  );
}
function CompanyIcon() {
  return (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 21V5l8-3 8 3v16M8 8h2M14 8h2M8 12h2M14 12h2M9 21v-5h6v5" />
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg
      className={iconClass}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle
        cx="12"
        cy="8"
        r="4"
      />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  );
}
function TextIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 7V4h16v3M9 20h6M12 4v16" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle
        cx="12"
        cy="12"
        r="4"
      />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
