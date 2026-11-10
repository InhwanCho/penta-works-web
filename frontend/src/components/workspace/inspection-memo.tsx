"use client";

import { useId, useState } from "react";
import { apiFetch } from "@/lib/api";
import { errorText } from "./workspace-data";

export default function InspectionMemo({ siteId, type }: { siteId: string; type: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const path = `/workspace/planning/${encodeURIComponent(siteId)}/memo/${type}`;

  async function edit() {
    setBusy(true);
    setError("");
    try {
      const saved = await apiFetch<{ memo: string }>(path);
      setMemo(saved.memo);
      setOpen(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      await apiFetch(path, { method: "PUT", body: JSON.stringify({ memo }) });
      setOpen(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" className="work-secondary" disabled={busy} onClick={() => void edit()}>메모</button>
    {open && <div className="inspection-memo-editor">
      <label htmlFor={id}>점검 메모</label>
      <textarea id={id} autoFocus rows={3} maxLength={2000} value={memo} disabled={busy} onChange={e => setMemo(e.target.value)} placeholder="간단한 메모를 입력해주세요." />
      <small>같은 병원의 해당 점검 유형에 저장되며 회사 구성원과 공유됩니다.</small>
      <div className="flex justify-end gap-2">
        <button type="button" className="work-secondary" disabled={busy} onClick={() => setOpen(false)}>취소</button>
        <button type="button" className="work-primary" disabled={busy} onClick={() => void save()}>{busy ? "저장 중…" : "저장"}</button>
      </div>
    </div>}
    {error && <p role="alert" className="work-error">{error}</p>}
  </>;
}
