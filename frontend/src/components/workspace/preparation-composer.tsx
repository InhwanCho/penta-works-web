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
  const [items, setItems] = useState([""]);
  const itemInputs = useRef<(HTMLInputElement | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const qc = useQueryClient();
  function insertItems(index: number, values: string[]) {
    setItems(current => [...current.slice(0, index), ...values, ...current.slice(index + 1)]);
    requestAnimationFrame(() => itemInputs.current[index + values.length - 1]?.focus());
  }

  return <>
    <button ref={trigger} type="button" className="work-secondary overview-preparation-write" onClick={event => { event.preventDefault(); event.stopPropagation(); setError(""); setOpen(true); }}>＋ 작성</button>
    {open && createPortal(<WorkspaceDrawer className="preparation-composer-dialog" title="방문 전 확인사항 작성" onClose={() => { if (!lock.current) setOpen(false); }}>
      <form className="work-form p-4" onSubmit={async event => {
        event.preventDefault();
        if (lock.current) return;
        const content = items.join("\n");
        if (!siteId || !items.some(item => item.trim().replace(/^(?:[-*+]\s+|•\s*|-$)/, "").trim())) { setError("병원과 확인사항을 입력해주세요."); return; }
        lock.current = true; setBusy(true); setError("");
        try {
          await apiFetch("/workspace/preparations", { method: "POST", body: JSON.stringify({ siteId, content: content.trim() }) });
          await qc.invalidateQueries({ queryKey: ["workspace-planning"] });
          setOpen(false); setSiteId(""); setItems([""]);
        } catch (cause) { setError(errorText(cause)); }
        finally { lock.current = false; setBusy(false); }
      }}>
        <fieldset disabled={busy} className="grid gap-4">
          <div><p className="mb-2">병원</p><HospitalPicker sites={sites} value={siteId} onChange={setSiteId} /></div>
          <div role="group" aria-label="확인사항">
            <p className="mb-2">확인사항</p>
            <ul className="grid list-disc gap-2 pl-5">
              {items.map((item, index) => (
                <li key={index}>
                  <input
                    ref={node => { itemInputs.current[index] = node; }}
                    className="work-input w-full"
                    aria-label={`확인사항 ${index + 1}`}
                    placeholder={index === 0 ? "방문 전에 확인할 내용을 적어주세요." : undefined}
                    value={item}
                    onChange={event => {
                      const value = event.target.value.replace(/^[-*+] +/, "");
                      setItems(current => current.map((text, i) => i === index ? value : text));
                    }}
                    onKeyDown={event => {
                      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                      if (event.key === "Enter") {
                        event.preventDefault();
                        const { selectionStart, selectionEnd } = event.currentTarget;
                        insertItems(index, [item.slice(0, selectionStart ?? item.length), item.slice(selectionEnd ?? item.length)]);
                      } else if (event.key === "Backspace" && !item && items.length > 1) {
                        event.preventDefault();
                        setItems(current => current.filter((_, i) => i !== index));
                        requestAnimationFrame(() => itemInputs.current[Math.max(0, index - 1)]?.focus());
                      }
                    }}
                    onPaste={event => {
                      const pasted = event.clipboardData.getData("text").split(/\r\n|[\r\n]/)
                        .map(line => line.replace(/^\s*(?:[-*+] +|•\s*)/, ""));
                      if (pasted.length < 2) return;
                      event.preventDefault();
                      const { selectionStart, selectionEnd } = event.currentTarget;
                      pasted[0] = item.slice(0, selectionStart ?? item.length) + pasted[0];
                      pasted[pasted.length - 1] += item.slice(selectionEnd ?? item.length);
                      insertItems(index, pasted);
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
          {error && <p role="alert" className="work-error">{error}</p>}
          <div className="work-form-actions"><button type="button" className="work-secondary" onClick={() => setOpen(false)}>취소</button><button type="submit" className="work-primary">{busy ? "저장 중…" : "저장"}</button></div>
        </fieldset>
      </form>
    </WorkspaceDrawer>, trigger.current!.closest(".workspace-frame")!)}
  </>;
}
