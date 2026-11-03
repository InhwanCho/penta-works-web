"use client";

import { useState } from "react";
import CircleLoader from "@/components/icons/circle-loader";

import Link from "@/components/common/app-link";
import { useAuth } from "@/components/provider/auth-provider";
import { useInfiniteQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { OfficeMaintenance } from "@/hooks/use-office-assets-query";
import type { WorkRecord } from "./workspace-data";
import { MaintenanceRow } from "@/components/site/office-assets-panel";
import { RecordList, ErrorState } from "./workspace-pages";
export function useHospitalHistory(siteId: string, category: "all" | "general" | "coldhead" = "all") {
  const { session } = useAuth();
  return useInfiniteQuery({
    queryKey: ["workspace-records", "hospital-history", session?.id, siteId, category],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiFetch<{
        items: {
          key: string;
          record?: WorkRecord;
          maintenance?: OfficeMaintenance;
        }[];
        total: number;
        failedSites: string[];
      }>(
        `/workspace/hospital-history/${encodeURIComponent(siteId)}?page=${pageParam}&size=10&category=${category}`,
      ),
    getNextPageParam: (last, pages) =>
      pages.reduce((n, p) => n + p.items.length, 0) < last.total
        ? pages.length + 1
        : undefined,
    enabled: !!session && !!siteId,
  });
}
export default function HospitalWork({ siteId }: { siteId: string }) {
  const { session } = useAuth();
  const [category, setCategory] = useState<"general" | "coldhead">("general");
  const history = useHospitalHistory(siteId, category);
  if (!session) return null;
  const rows = history.data?.pages.flatMap((p) => p.items) || [];
  const partial = history.data?.pages.some((p) => p.failedSites.length);
  return (
    <section className="work-panel hospital-assets hospital-detail-card">
      <div className="work-section hospital-card-heading hospital-history-heading">
        <div>
          <h2>병원 정비이력</h2>
          <p className="work-hint">
            이 병원에서 진행한 서비스와 장비·부품 변경 기록입니다.
          </p>
        </div>
        <Link
          className="work-secondary hospital-register hospital-record-create"
          href={`/work/new?site=${encodeURIComponent(siteId)}`}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m16 3 5 5-12 12-6 1 1-6Z" />
            <path d="m14 5 5 5" />
          </svg>
          업무기록 작성
        </Link>
      </div>
      <div className="work-pills hospital-history-tabs" role="group" aria-label="정비이력 종류">
        <button type="button" className={category === "general" ? "active" : ""} aria-pressed={category === "general"} onClick={() => setCategory("general")}>일반 정비이력</button>
        <button type="button" className={category === "coldhead" ? "active" : ""} aria-pressed={category === "coldhead"} onClick={() => setCategory("coldhead")}>Cold Head 교체 이력</button>
      </div>
      {history.error && (
        <ErrorState
          error={history.error}
          retry={() => {
            void history.refetch();
          }}
        />
      )}
      {partial && (
        <p className="work-error">
          이전 정비이력을 불러오지 못했습니다.{" "}
          <button
            type="button"
            onClick={() => {
              void history.refetch();
            }}
          >
            다시 시도
          </button>
        </p>
      )}
      {history.isPending && (
        <p
          className="work-hint"
          role="status"
        ><CircleLoader size="xs" /></p>
      )}
      <div className="hospital-timeline">
        {rows.map((r) => (
          <div key={r.key}>
            {r.record ? (
              <RecordList rows={[r.record]} showRelativeDate />
            ) : r.maintenance ? (
              <MaintenanceRow
                item={r.maintenance}
                showRelativeDate
                siteId={siteId}
              />
            ) : null}
          </div>
        ))}
      </div>
      {!rows.length && !history.isPending && !history.error && !partial && (
        <p className="work-empty">{category === "coldhead" ? "등록된 Cold Head 교체 이력이 없습니다." : "등록된 일반 정비이력이 없습니다."}</p>
      )}
      {history.hasNextPage && (
        <button
          className="work-secondary"
          disabled={history.isFetchingNextPage}
          onClick={() => {
            void history.fetchNextPage();
          }}
        >
          {history.isFetchingNextPage ? <CircleLoader size="xs" inline /> : "이전 이력 더 보기"}
        </button>
      )}
    </section>
  );
}
