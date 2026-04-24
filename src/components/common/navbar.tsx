"use client";

import SiteSearchModal from "@/components/common/site-search-modal";
import SearchIcon from "@/components/icons/search-icon";
import { useModal } from "@/components/provider/modal-provider";
import { useTheme } from "@/components/provider/theme-provider";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();

  const [prefersDark, setPrefersDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const set = () => setPrefersDark(mq.matches);

    set();
    mq.addEventListener?.("change", set);

    return () => {
      mq.removeEventListener?.("change", set);
    };
  }, []);

  const isDarkChecked = theme === "dark" || (theme === "system" && prefersDark);

  // 모달 제어
  const { open: openSearchModal } = useModal("SearchModal");

  return (
    <>
      <header
        className={[
          "sticky top-0 z-10 h-14 w-full lg:h-[60px]",
          // 브랜드 블루슬레이트 그라디언트(오렌지 로고와 보색 대비)
          "bg-gradient-to-r from-brand-primary via-brand to-brand-primary",
          "dark:from-background-dark-secondary dark:via-background-dark-card dark:to-background-dark-secondary",
          // 하단 보더로 경계 정리
          "border-b border-black/10 dark:border-white/5",
          // 깊이감용 미세 섀도우
          "shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,_0_1px_2px_0_rgba(0,0,0,0.08)]",
        ].join(" ")}
      >
        <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-4 lg:px-8">
          <Link
            href="/"
            className="relative flex cursor-pointer items-center gap-2.5 text-base font-semibold tracking-tight text-white lg:text-lg"
          >
            <Image
              src="/favicon/android-chrome-192x192.png"
              alt="PENTA WORKS"
              width={28}
              height={28}
              priority
              className="h-7 w-7 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
            />
            <span className="tracking-[-0.01em]">PENTA WORKS</span>
            {!process.env.NEXT_PUBLIC_API_URL?.includes("https") && (
              <span className="ml-1 rounded-md border border-amber-300/40 bg-amber-300/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-200 backdrop-blur-sm">
                DEV
              </span>
            )}
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/baselines"
              className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="기준값 보기"
            >
              기준값
            </Link>

            <button
              type="button"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/10 hover:text-white"
              onClick={() => {
                openSearchModal();
              }}
              aria-label="Open site search"
            >
              <SearchIcon className="h-5 w-5" />
            </button>

            <div className="ml-1 flex items-center">
              <div className="toggle-switch">
                <label className="switch-label">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={isDarkChecked}
                    onChange={toggleTheme}
                    aria-label="Toggle dark mode"
                  />
                  <span className="slider" />
                </label>
              </div>
            </div>
          </nav>
        </div>
      </header>

      {/* SearchModal은 Navbar(=전역)에 1회만 마운트 */}
      <SiteSearchModal />
    </>
  );
}
