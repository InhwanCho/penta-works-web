"use client";
import { createPortal } from "react-dom";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import HospitalPicker from "./hospital-picker";
import WorkspaceDrawer from "./workspace-drawer";
import { errorText, type Hospital } from "./workspace-data";

export default function PreparationComposer({ sites }: { sites: Hospital[] }) {
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const qc = useQueryClient();
  return <>
    <button ref={trigger} type="button" className="work-secondary overview-preparation-write" onClick={event => { event.preventDefault(); event.stopPropagation(); setError(""); setOpen(true); }}>＋ 작성</button>
    {open && createPortal(<WorkspaceDrawer className="preparation-composer-dialog" title="방문 전 확인사항 작성" onClose={() => { if (!lock.current) setOpen(false); }}>
      <form className="work-form p-4" onSubmit={async event => {
        event.preventDefault();
        if (lock.current) return;
        if (!siteId || !content.trim()) { setError("병원과 확인사항을 입력해주세요."); return; }
        lock.current = true; setBusy(true); setError("");
        try {
          await apiFetch("/workspace/preparations", { method: "POST", body: JSON.stringify({ siteId, content: content.trim() }) });
          await qc.invalidateQueries({ queryKey: ["workspace-planning"] });
          setOpen(false); setSiteId(""); setContent("");
        } catch (cause) { setError(errorText(cause)); }
        finally { lock.current = false; setBusy(false); }
      }}>
        <fieldset disabled={busy} className="grid gap-4">
          <div><p className="mb-2">병원</p><HospitalPicker sites={sites} value={siteId} onChange={setSiteId} /></div>
          <label>확인사항<textarea className="work-input" rows={5} maxLength={1000} required value={content} onChange={event => setContent(event.target.value)} placeholder="방문 전에 확인할 내용을 적어주세요." /></label>
          {error && <p role="alert" className="work-error">{error}</p>}
          <div className="work-form-actions"><button type="button" className="work-secondary" onClick={() => setOpen(false)}>취소</button><button type="submit" className="work-primary">{busy ? "저장 중…" : "저장"}</button></div>
        </fieldset>
      </form>
    </WorkspaceDrawer>, trigger.current!.closest(".workspace-frame")!)}
  </>;
}
