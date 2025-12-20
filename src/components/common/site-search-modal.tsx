"use client";

import CustomModal from "@/components/common/custom-modal";
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
        recalls: {
          /* no-op */
        }

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
    // 모달 먼저 닫고 이동(전역 모달이라 라우트 변경에도 상태가 남을 수 있음)
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
            placeholder="site(슬러그/DB) 또는 name으로 검색"
            className="dark:border-background-dark-secondary dark:bg-background-dark-card w-full rounded-xl border px-3 py-2 text-sm outline-none"
          />

          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              className="dark:border-background-dark-secondary hover:bg-background-tertiary dark:hover:bg-background-dark-secondary inline-flex items-center rounded-lg border px-3 py-2 text-xs font-medium"
              disabled={loading}
            >
              이동
            </button>

            <button
              type="button"
              onClick={() => {
                setQ("");
                inputRef.current?.focus();
              }}
              className="dark:border-background-dark-secondary hover:bg-background-tertiary dark:hover:bg-background-dark-secondary inline-flex items-center rounded-lg border px-3 py-2 text-xs font-medium"
            >
              초기화
            </button>

            <button
              type="button"
              onClick={() => {
                closeSearchModal();
              }}
              className="dark:border-background-dark-secondary hover:bg-background-tertiary dark:hover:bg-background-dark-secondary ml-auto inline-flex items-center rounded-lg border px-3 py-2 text-xs font-medium"
            >
              취소
            </button>
          </div>
        </form>

        <div className="dark:border-background-dark-secondary mt-4 max-h-[50vh] overflow-auto rounded-xl border">
          {loading && (
            <div className="text-text-secondary dark:text-text-dark-primary/70 p-4 text-sm">
              불러오는 중...
            </div>
          )}

          {!loading && errorMsg && (
            <div className="p-4">
              <div className="text-error text-sm font-semibold">오류</div>
              <div className="text-text-secondary dark:text-text-dark-primary/70 mt-1 text-sm">
                {errorMsg}
              </div>
            </div>
          )}

          {!loading && !errorMsg && results.length === 0 && (
            <div className="text-text-secondary dark:text-text-dark-primary/70 p-4 text-sm">
              검색 결과가 없습니다.
            </div>
          )}

          {!loading && !errorMsg && results.length > 0 && (
            <ul className="dark:divide-background-dark-secondary divide-y">
              {results.map((it) => (
                <li key={it.siteDb}>
                  <button
                    type="button"
                    onClick={() => goToDashboardAndScroll(it.siteSlug)}
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
          결과를 선택하면 대시보드로 이동 후 해당 사이트 위치로 스크롤됩니다.
        </div>
      </div>
    </CustomModal>
  );
}
