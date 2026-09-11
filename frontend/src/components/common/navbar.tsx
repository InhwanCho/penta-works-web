"use client";

import SiteSearchModal from "@/components/common/site-search-modal";
import SearchIcon from "@/components/icons/search-icon";
import { useModal } from "@/components/provider/modal-provider";
import { useTheme } from "@/components/provider/theme-provider";
import Image from "next/image";
import Link from "next/link";

/**
 * 네비게이션 링크/버튼 공통 스타일.
 * 모바일에서 항목이 늘어나도 줄바꿈되지 않도록 whitespace-nowrap + 좁은 패딩을 씁니다.
 */
const NAV_ITEM_CLASS =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-2 text-sm font-semibold whitespace-nowrap text-white/90 transition-colors hover:bg-white/10 hover:text-white sm:px-3";

export default function Navbar() {
  const { isDark, isLargeText, toggleTheme, toggleLargeText } = useTheme();

  // 모달 제어
  const { open: openSearchModal } = useModal("SearchModal");

  return (
    <>
      <header
        className={[
          "mobile-safe-header sticky top-0 z-50 h-14 w-full",
          // 브랜드 블루슬레이트 그라디언트(오렌지 로고와 보색 대비)
          "from-brand-primary via-brand to-brand-primary bg-gradient-to-r",
          "dark:from-background-dark-secondary dark:via-background-dark-card dark:to-background-dark-secondary",
          // 하단 보더로 경계 정리
          "border-b border-black/10 dark:border-white/5",
          // 깊이감용 미세 섀도우
          "shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,_0_1px_2px_0_rgba(0,0,0,0.08)]",
        ].join(" ")}
      >
        <div className="mobile-safe-nav mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-1 px-3 sm:gap-2 sm:px-4 lg:px-6">
          <Link
            href="/"
            className="relative flex shrink-0 cursor-pointer items-center gap-2 text-base font-bold tracking-tight text-white lg:text-lg"
          >
            <Image
              src="/favicon/android-chrome-192x192.png"
              alt="MrEyes"
              width={28}
              height={28}
              priority
              className="h-8 w-8 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
            />
            <span className="hidden tracking-[-0.01em] whitespace-nowrap sm:inline">
              MrEyes
            </span>
          </Link>

          <nav className="flex shrink-0 items-center gap-0.5 lg:gap-1">
            <Link
              href="/baselines"
              className={NAV_ITEM_CLASS}
              aria-label="기준값 보기"
            >
              기준값
            </Link>

            <button
              type="button"
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/10 hover:text-white"
              onClick={() => {
                openSearchModal();
              }}
              aria-label="병원 검색"
            >
              <SearchIcon className="h-5 w-5" />
            </button>

            <button
              type="button"
              className={[
                "inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-bold whitespace-nowrap transition-colors sm:px-3",
                isLargeText
                  ? "text-brand-primary bg-white shadow-sm"
                  : "text-white/90 hover:bg-white/10 hover:text-white",
              ].join(" ")}
              onClick={toggleLargeText}
              aria-label="큰 글씨 모드"
              aria-pressed={isLargeText}
              title="큰 글씨 모드"
            >
              큰글씨
            </button>

            <button
              type="button"
              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-bold whitespace-nowrap text-white/90 transition-colors hover:bg-white/10 hover:text-white sm:px-3"
              onClick={toggleTheme}
              aria-label={
                isDark ? "밝은 화면으로 변경" : "어두운 화면으로 변경"
              }
              title={isDark ? "밝은 화면" : "어두운 화면"}
            >
              {isDark ? "밝게" : "어둡게"}
            </button>
          </nav>
        </div>
      </header>

      {/* SearchModal은 Navbar(=전역)에 1회만 마운트 */}
      <SiteSearchModal />
    </>
  );
}
