"use client";

import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { errorText } from "./workspace-data";
import WorkspaceDrawer from "./workspace-drawer";

export default function InspectionMemo({ siteId, type, preview = false }: { siteId: string; type: string; preview?: boolean }) {
  const id = useId();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const path = `/workspace/planning/${encodeURIComponent(siteId)}/memo/${type}`;
  const queryKey = ["inspection-memo", siteId, type];
  const query = useQuery({
    queryKey,
    queryFn: () => apiFetch<{ memo: string }>(path),
  });

  function edit() {
    setMemo(query.data?.memo ?? "");
    setError("");
    setOpen(true);
  }

  async function save(value: string) {
    setBusy(true);
    setError("");
    try {
      const saved = await apiFetch<{ memo: string }>(path, {
        method: "PUT",
        body: JSON.stringify({ memo: value }),
      });
      client.setQueryData(queryKey, saved);
      setOpen(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return <>
    {!preview && <div className="inspection-memo-trigger">
      <button type="button" className="work-secondary" disabled={query.isPending || query.isError} onClick={edit}>메모</button>
      {query.isError && <button type="button" className="work-secondary" onClick={() => void query.refetch()}>메모 다시 불러오기</button>}
    </div>}
      {preview && query.data?.memo && <button type="button" className="inspection-memo-preview" onClick={edit} title={query.data.memo}>
        {query.data.memo}
      </button>}
    {open && <WorkspaceDrawer title="점검 메모" onClose={() => { if (!busy) setOpen(false); }} className="inspection-memo-dialog">
      <div className="inspection-memo-editor">
        <label htmlFor={id}>메모 내용</label>
        <textarea id={id} rows={5} maxLength={2000} value={memo} disabled={busy} onChange={e => setMemo(e.target.value)} placeholder="간단한 메모를 입력해주세요." />
        <small>회사 구성원과 공유되는 메모입니다.</small>
        {error && <p role="alert" className="work-error">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {query.data?.memo && <button type="button" className="work-secondary action-danger mr-auto" disabled={busy} onClick={() => {
            if (window.confirm("이 메모를 삭제할까요?")) void save("");
          }}>삭제</button>}
          <button type="button" className="work-secondary" disabled={busy} onClick={() => setOpen(false)}>취소</button>
          <button type="button" className="work-primary" disabled={busy} onClick={() => void save(memo)}>{busy ? "저장 중…" : "저장"}</button>
        </div>
      </div>
    </WorkspaceDrawer>}
  </>;
}
