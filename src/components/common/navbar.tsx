"use client";

import SiteSearchModal from "@/components/common/site-search-modal";
import SearchIcon from "@/components/icons/search-icon";
import { useModal } from "@/components/provider/modal-provider";
import { useTheme } from "@/components/provider/theme-provider";
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
      <header className="bg-brand dark:bg-background-dark-secondary sticky top-0 z-10 h-[50px] w-full lg:h-[60px]">
        <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-4 lg:px-8">
          <Link
            href="/"
            className="relative cursor-pointer text-lg font-semibold text-white lg:text-xl"
          >
            PENTA WORKS
            {!process.env.NEXT_PUBLIC_API_URL?.includes("https") && (
              <span className="text-error absolute ml-2">DEV</span>
            )}
          </Link>

          <div className="flex items-center justify-center gap-x-4 lg:gap-x-6">
            <button
              type="button"
              className="mt-0.5 cursor-pointer"
              onClick={() => {
                openSearchModal();
              }}
              aria-label="Open site search"
            >
              <SearchIcon className="text-slate-100" />
            </button>

            <div className="flex items-center gap-3">
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
          </div>
        </div>
      </header>

      {/* SearchModal은 Navbar(=전역)에 1회만 마운트 */}
      <SiteSearchModal />
    </>
  );
}
