"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/provider/auth-provider";
import { useOfficeAssetsQuery } from "@/hooks/use-office-assets-query";
import { MaintenanceRow } from "@/components/site/office-assets-panel";
import { useWorkspace } from "./workspace-data";
import { RecordList, ErrorState } from "./workspace-pages";
export default function HospitalWork({ siteId }: { siteId: string }) {
  const { session } = useAuth();
  const { records } = useWorkspace();
  const old = useOfficeAssetsQuery(siteId, !!session);
  const [count, setCount] = useState(10);
  if (!session) return null;
  const rows = [
    ...(records.data || [])
      .filter((r) => r.siteId === siteId)
      .map((r) => ({
        key: `new-${r.id}`,
        date: r.workDate,
        view: <RecordList rows={[r]} />,
      })),
    ...(old.data?.maintenanceHistory || []).map((r) => ({
      key: `old-${r.id}`,
      date: r.workDate || "",
      view: (
        <MaintenanceRow
          item={r}
          siteId={siteId}
        />
      ),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="work-panel hospital-assets hospital-detail-card">
      <div className="work-section">
        <div>
          <h2>병원 정비이력</h2>
          <p className="work-hint">
            이 병원에서 진행한 서비스와 장비·부품 변경 기록입니다.
          </p>
        </div>
        <Link
          className="work-primary"
          href={`/work/new?site=${encodeURIComponent(siteId)}`}
        >
          ＋ 업무기록
        </Link>
      </div>
      {records.error && (
        <ErrorState
          error={records.error}
          retry={() => void records.refetch()}
        />
      )}
      {old.error && (
        <p className="work-hint">
          이전 정비이력을 불러오지 못했습니다.{" "}
          <button onClick={() => void old.refetch()}>다시 시도</button>
        </p>
      )}
      <div className="hospital-timeline">
        {rows.slice(0, count).map((r) => (
          <div key={r.key}>{r.view}</div>
        ))}
      </div>
      {!rows.length && !records.isPending && !old.isPending && (
        <p className="work-empty">아직 등록된 정비이력이 없습니다.</p>
      )}
      {rows.length > count && (
        <button
          className="work-secondary"
          onClick={() => setCount(count + 20)}
        >
          이전 이력 더 보기 ({rows.length - count}건)
        </button>
      )}
    </section>
  );
}
