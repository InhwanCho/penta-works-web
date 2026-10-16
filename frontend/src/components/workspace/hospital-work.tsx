"use client";
import Link from "next/link";
import { useWorkspace } from "./workspace-data";
import { RecordList, ErrorState } from "./workspace-pages";
export default function HospitalWork({ siteId }: { siteId: string }) {
  const { records } = useWorkspace();
  const rows = (records.data || [])
    .filter((r) => r.siteId === siteId)
    .slice(0, 3);
  return (
    <section className="mb-4">
      <div className="work-section">
        <h2>업무 기록</h2>
        <Link href={`/work/new?site=${encodeURIComponent(siteId)}`}>
          ＋ 이 병원 업무 작성
        </Link>
      </div>
      {records.error ? (
        <ErrorState
          error={records.error}
          retry={() => void records.refetch()}
        />
      ) : (
        <RecordList rows={rows} />
      )}
    </section>
  );
}
