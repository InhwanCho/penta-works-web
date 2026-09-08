"use client";

import CustomModal from "@/components/common/custom-modal";
import { useMemo, useRef, useState } from "react";

type Item = {
  siteSlug: string;
  siteDb: string;
  name: string;
};

export default function DashboardSearchModal({ items }: { items: Item[] }) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const normalized = (s: string) => s.trim().toLowerCase();

  const results = useMemo(() => {
    const query = normalized(q);
    if (!query) return items.slice(0, 20);

    const scored = items
      .map((it) => {
        const slug = normalized(it.siteSlug);
        const db = normalized(it.siteDb);
        const name = normalized(it.name);

        // 간단 스코어링: exact > prefix > includes
        let score = 0;
        if (slug === query || db === query) score += 100;
        if (slug.startsWith(query) || db.startsWith(query)) score += 50;
        if (name.startsWith(query)) score += 30;
        if (slug.includes(query) || db.includes(query) || name.includes(query))
          score += 10;

        return { it, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((x) => x.it);

    return scored;
  }, [q, items]);

  const scrollTo = (siteSlug: string) => {
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    const id = isDesktop ? `site-d-${siteSlug}` : `site-m-${siteSlug}`;
    const el = document.getElementById(id);

    if (!el) return;

    const TOP_OFFSET = 120; // 원하는 여백(px)

    const y = el.getBoundingClientRect().top + window.scrollY - TOP_OFFSET;

    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const first = results[0];
    if (first) scrollTo(first.siteSlug);
  };

  return (
    <CustomModal
      id="SearchModal"
      showCloseButton={false}
    >
      <div className="p-6">
        <div className="text-text-major dark:text-text-dark-primary text-sm font-semibold">
          사이트 검색
        </div>

        <form
          onSubmit={onSubmit}
          className="mt-3"
        >
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="site 또는 name으로 검색"
            className="dark:border-background-dark-secondary dark:bg-background-dark-card w-full rounded-xl border px-3 py-2 text-sm outline-none"
          />
        </form>

        <div className="dark:border-background-dark-secondary mt-4 max-h-[50vh] overflow-auto rounded-xl border">
          {results.length === 0 ? (
            <div className="text-text-secondary dark:text-text-dark-primary/70 p-4 text-sm">
              검색 결과가 없습니다.
            </div>
          ) : (
            <ul className="dark:divide-background-dark-secondary divide-y">
              {results.map((it) => (
                <li key={it.siteDb}>
                  <button
                    type="button"
                    onClick={() => scrollTo(it.siteSlug)}
                    className="hover:bg-background-tertiary dark:hover:bg-background-dark-secondary w-full px-4 py-3 text-left"
                  >
                    <div className="text-text-major dark:text-text-dark-primary text-sm font-semibold">
                      {it.siteSlug}
                      <span className="text-text-secondary dark:text-text-dark-primary/70 ml-2 text-xs">
                        (DB: {it.siteDb})
                      </span>
                    </div>
                    <div className="text-text-secondary dark:text-text-dark-primary/70 mt-0.5 text-xs">
                      {it.name || "-"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="text-text-secondary dark:text-text-dark-primary/70 mt-3 text-xs">
          Enter로 첫 번째 결과로 이동하거나, 목록에서 선택하세요.
        </div>
      </div>
    </CustomModal>
  );
}
