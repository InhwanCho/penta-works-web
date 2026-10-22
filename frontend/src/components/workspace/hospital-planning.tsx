"use client";

import CircleLoader from "@/components/icons/circle-loader";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";
import { usePlanning, errorText, type HospitalPlan } from "./workspace-data";

export default function HospitalPlanning({ siteId }: { siteId: string }) {
  const { session, isAdmin } = useAuth();
  const query = usePlanning();
  const plan = query.data?.plans.find((p) => p.siteId === siteId);
  const [editing, setEditing] = useState(false);
  if (!session) return null;
  return (
    <section
      className="work-panel hospital-planning hospital-detail-card"
      id="inspection-plan"
    >
      <div className="work-section planning-heading hospital-card-heading hospital-title-heading">
        <h2>점검 주기·지정일</h2>
      </div>
      {query.isPending ? (
        <p role="status"><CircleLoader size="xs" /></p>
      ) : query.isError ? (
        <p className="work-error">
          {errorText(query.error)}{" "}
          <button onClick={() => void query.refetch()}>다시 시도</button>
        </p>
      ) : editing ? (
        <PlanEditor
          siteId={siteId}
          plan={plan}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <>
          <dl className="planning-summary">
            <div>
              <dt>PM 주기</dt>
              <dd>{plan?.pmIntervalMonths || 2}개월</dd>
            </div>
            <div>
              <dt>PM 지정일</dt>
              <dd>{plan?.pmOverride || "자동 계산"}</dd>
            </div>
            <div>
              <dt>ACR 정밀 지정일</dt>
              <dd>{plan?.acrFullOverride || "자동 계산 · 36개월"}</dd>
            </div>
            <div>
              <dt>ACR 서류 지정일</dt>
              <dd>{plan?.acrDocOverride || "자동 계산 · 12개월"}</dd>
            </div>
          </dl>
          <div className="hospital-panel-actions planning-actions">
            <details className="planning-guide">
              <summary><span>점검 기준 안내</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary>
              <p>완료 이력과 점검 주기로 기한을 계산합니다. 지정일은 마지막 점검일보다 이후일 때 우선 적용됩니다. 방문 일정은 달력에서 별도로 등록하며, 이 기준은 회사 내 담당자에게 공통 적용됩니다.</p>
            </details>
            {isAdmin && <button type="button" className="work-secondary hospital-section-action" onClick={() => setEditing(true)}>설정 변경</button>}
          </div>
        </>
      )}
    </section>
  );
}
function PlanEditor({
  siteId,
  plan,
  onSaved,
}: {
  siteId: string;
  plan?: HospitalPlan;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState({
    pmIntervalMonths: plan?.pmIntervalMonths || 2,
    pmOverride: plan?.pmOverride || "",
    acrFullOverride: plan?.acrFullOverride || "",
    acrDocOverride: plan?.acrDocOverride || "",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/workspace/planning/${encodeURIComponent(siteId)}`, {
        method: "PUT",
        body: JSON.stringify({
          ...value,
          pmOverride: value.pmOverride || null,
          acrFullOverride: value.acrFullOverride || null,
          acrDocOverride: value.acrDocOverride || null,
        }),
      });
      await qc.invalidateQueries({ queryKey: ["workspace-planning"] });
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className="work-form planning-editor"
    >
      <fieldset
        disabled={busy}
        className="planning-editor-fields"
      >
        <label>
          PM 주기 (개월)
          <input
            type="number"
            min={1}
            max={120}
            required
            value={value.pmIntervalMonths}
            className="work-input"
            onChange={(e) =>
              setValue({ ...value, pmIntervalMonths: Number(e.target.value) })
            }
          />
        </label>
        {(
          [
            ["pmOverride", "PM 지정일"],
            ["acrFullOverride", "ACR 정밀 지정일"],
            ["acrDocOverride", "ACR 서류 지정일"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              className="work-input"
              type="date"
              value={value[key]}
              onChange={(e) => setValue({ ...value, [key]: e.target.value })}
            />
          </label>
        ))}
        <p className="work-hint">
          지정일을 비우면 완료 이력과 주기로 자동 계산합니다.
        </p>
        {error && (
          <p
            role="alert"
            className="work-error"
          >
            {error}
          </p>
        )}
        <div className="work-form-actions">
          <button
            type="button"
            className="work-secondary"
            onClick={onSaved}
          >
            취소
          </button>
          <button
            className="work-primary"
            disabled={busy}
          >
            {busy ? <CircleLoader size="xs" inline /> : "점검 기준 저장"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
