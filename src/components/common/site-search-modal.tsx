"use client";

import CustomModal from "@/components/common/custom-modal";
import ChevronRightIcon from "@/components/icons/chevron-right-icon";
import SearchIcon from "@/components/icons/search-icon";
import { useModal } from "@/components/provider/modal-provider";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type SiteItem = {
  siteDb: string;
  siteSlug: string;
  name: string;
};

function toSlug(siteDb: string) {
  if (/^\d+$/.test(siteDb)) return String(Number(siteDb));
  return siteDb;
}

function norm(s: string) {
  return (s ?? "").trim().toLowerCase();
}

export default function SiteSearchModal() {
  const router = useRouter();
  const { close: closeSearchModal } = useModal("SearchModal");

  const [q, setQ] = useState("");
  const [items, setItems] = useState<SiteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const res = await fetch("/api/sites", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to fetch sites: ${res.status}`);
        }

        const data: { siteDb: string; name: string | null }[] =
          await res.json();

        const mapped: SiteItem[] = data.map((x) => ({
          siteDb: x.siteDb,
          siteSlug: toSlug(x.siteDb),
          name: x.name ?? "",
        }));

        if (!mounted) return;
        setItems(mapped);
      } catch (e) {
        if (!mounted) return;
        setErrorMsg(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  const results = useMemo(() => {
    if (loading) return [];
    const query = norm(q);
    if (!query) return items.slice(0, 30);

    const scored = items
      .map((it) => {
        const slug = norm(it.siteSlug);
        const db = norm(it.siteDb);
        const name = norm(it.name);

        let score = 0;
        if (slug === query || db === query) score += 100;
        if (slug.startsWith(query) || db.startsWith(query)) score += 60;
        if (name.startsWith(query)) score += 40;
        if (slug.includes(query) || db.includes(query) || name.includes(query))
          score += 10;

        return { it, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((x) => x.it);

    return scored;
  }, [q, items, loading]);

  const goToDashboardAndScroll = (siteSlug: string) => {
    closeSearchModal();

    const qs = new URLSearchParams();
    qs.set("scrollTo", siteSlug);

    router.push(`/?${qs.toString()}`);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const first = results[0];
    if (first) goToDashboardAndScroll(first.siteSlug);
  };

  return (
    <CustomModal id="SearchModal" showCloseButton={false}>
      <div className="flex flex-col">
        {/* Command palette 스타일 검색창 */}
        <form onSubmit={onSubmit} className="border-b border-border dark:border-background-dark-secondary">
          <div className="relative flex items-center">
            <SearchIcon className="text-text-secondary/70 dark:text-text-dark-primary/50 absolute left-4 h-4 w-4 pointer-events-none" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="사이트 또는 병원명으로 검색..."
              className="w-full border-0 bg-transparent px-11 py-4 text-sm outline-none placeholder:text-text-secondary/70 dark:placeholder:text-text-dark-primary/40 dark:text-text-dark-primary"
              inputMode="search"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => closeSearchModal()}
              aria-label="닫기"
              className="text-text-secondary hover:bg-background-tertiary dark:text-text-dark-primary/60 dark:hover:bg-background-dark-secondary absolute right-3 inline-flex h-7 items-center justify-center rounded border border-border px-1.5 text-[11px] font-semibold dark:border-background-dark-secondary"
            >
              ESC
            </button>
          </div>
        </form>

        <div className="max-h-[60vh] overflow-auto p-2">
          {loading && (
            <div className="text-text-secondary dark:text-text-dark-primary/60 p-6 text-center text-sm">
              불러오는 중...
            </div>
          )}

          {!loading && errorMsg && (
            <div className="p-6">
              <div className="text-red-600 dark:text-red-400 text-sm font-semibold">
                오류
              </div>
              <div className="text-text-secondary dark:text-text-dark-primary/60 mt-1 text-xs">
                {errorMsg}
              </div>
            </div>
          )}

          {!loading && !errorMsg && results.length === 0 && (
            <div className="text-text-secondary dark:text-text-dark-primary/60 p-6 text-center text-sm">
              검색 결과가 없습니다.
            </div>
          )}

          {!loading && !errorMsg && results.length > 0 && (
            <ul className="space-y-0.5">
              {results.map((it) => (
                <li key={it.siteDb}>
                  <button
                    type="button"
                    onClick={() => goToDashboardAndScroll(it.siteSlug)}
                    className="group hover:bg-background-tertiary dark:hover:bg-background-dark-secondary flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors"
                  >
                    <span className="text-text-secondary dark:text-text-dark-primary/60 w-10 shrink-0 text-xs font-semibold tabular-nums">
                      {it.siteSlug}
                    </span>
                    <span className="text-text-major dark:text-text-dark-primary min-w-0 flex-1 truncate text-sm font-medium">
                      {it.name || "-"}
                    </span>
                    <ChevronRightIcon className="text-text-secondary/40 dark:text-text-dark-primary/30 h-4 w-4 shrink-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border/60 bg-background-primary/50 px-4 py-2.5 text-[11px] text-text-secondary dark:border-background-dark-secondary/60 dark:bg-background-dark-secondary/30 dark:text-text-dark-primary/60">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-white px-1.5 py-0.5 text-[10px] font-semibold dark:border-background-dark-secondary dark:bg-background-dark-card">
              ↵
            </kbd>
            선택
          </span>
          <span className="mx-2">·</span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-white px-1.5 py-0.5 text-[10px] font-semibold dark:border-background-dark-secondary dark:bg-background-dark-card">
              ESC
            </kbd>
            닫기
          </span>
        </div>
      </div>
    </CustomModal>
  );
}
