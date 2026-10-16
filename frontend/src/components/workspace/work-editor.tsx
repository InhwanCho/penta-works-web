"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/provider/auth-provider";
import {
  useWorkspace,
  dayString,
  errorText,
  statusLabels,
  serviceLabels,
  type WorkRecord,
} from "./workspace-data";
import { Empty, ErrorState, PageHeading } from "./workspace-pages";
export default function WorkEditor({ id }: { id?: string }) {
  const router = useRouter(),
    search = useSearchParams(),
    qc = useQueryClient();
  const { session, isAdmin } = useAuth();
  const { sites, records } = useWorkspace();
  const [form, setForm] = useState({
    kind: "FIELD",
    siteId: search.get("site") || "",
    serviceType: "REPAIR",
    title: "",
    body: "",
    workDate: dayString(),
    status: "COMPLETED",
  });
  const [loaded, setLoaded] = useState(false),
    [editing, setEditing] = useState(!id),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const record = records.data?.find((r) => String(r.id) === id);
  useEffect(() => {
    if (record && !loaded) {
      setForm({
        kind: record.kind,
        siteId: record.siteId || "",
        serviceType: record.serviceType || "REPAIR",
        title: record.title,
        body: record.body,
        workDate: record.workDate,
        status: record.status,
      });
      setLoaded(true);
    }
  }, [record, loaded]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await apiFetch<{ id?: number }>(
        id ? `/workspace/records/${id}` : "/workspace/records",
        { method: id ? "PUT" : "POST", body: JSON.stringify(form) },
      );
      await qc.invalidateQueries({ queryKey: ["workspace-records"] });
      if (id) setEditing(false);
      else router.replace(`/work/${result.id}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!window.confirm("이 업무 기록을 삭제할까요?")) return;
    setSaving(true);
    try {
      await apiFetch(`/workspace/records/${id}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["workspace-records"] });
      router.replace("/work");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  if (id && records.error)
    return (
      <main className="work-page">
        <ErrorState
          error={records.error}
          retry={() => void records.refetch()}
        />
      </main>
    );
  if (id && records.isPending)
    return <main className="work-page">업무를 불러오는 중…</main>;
  if (id && !record)
    return (
      <main className="work-page">
        <Empty>기록을 찾을 수 없거나 접근 권한이 없습니다.</Empty>
        <Link href="/work">업무 목록으로</Link>
      </main>
    );
  const canEdit = !record || record.authorId === session?.id || isAdmin;
  return (
    <main className="work-page work-editor">
      <Link
        href="/work"
        className="work-back"
      >
        ← 업무 기록
      </Link>
      <PageHeading
        title={id ? (editing ? "업무 수정" : "업무 기록") : "업무 기록 작성"}
        description={
          editing
            ? "업무 구분과 내용을 한 페이지에서 작성하세요."
            : `${record?.workDate} · ${record?.authorName}`
        }
        action={
          !editing && canEdit ? (
            <button
              className="work-secondary"
              onClick={() => setEditing(true)}
            >
              수정
            </button>
          ) : undefined
        }
      />
      {error && (
        <p
          className="work-error"
          role="alert"
        >
          {error}
        </p>
      )}
      {editing ? (
        <form
          onSubmit={save}
          className="work-panel work-form"
        >
          <fieldset>
            <legend>업무 구분</legend>
            <div className="work-kind-choice">
              {[
                ["FIELD", "현장 서비스", "병원 방문 · 정비 · PM · ACR · 콜"],
                ["GENERAL", "일반 업무", "출장 준비 · 사내 작업 · 업무 공유"],
              ].map(([value, title, desc]) => (
                <label
                  key={value}
                  className={form.kind === value ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={value}
                    checked={form.kind === value}
                    onChange={() => setForm({ ...form, kind: value })}
                  />
                  <span>
                    <strong>{title}</strong>
                    <small>{desc}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {form.kind === "FIELD" && (
            <div className="work-form-row">
              <label>
                병원
                <select
                  className="work-input"
                  required
                  value={form.siteId}
                  onChange={(e) => setForm({ ...form, siteId: e.target.value })}
                >
                  <option value="">병원을 선택해주세요</option>
                  {sites.data?.map((s) => (
                    <option
                      key={s.siteDb}
                      value={s.siteDb}
                    >
                      {s.name || s.siteDb}
                    </option>
                  ))}
                </select>
                {sites.error && (
                  <span role="alert">병원 목록을 불러오지 못했습니다.</span>
                )}
              </label>
              <label>
                서비스 유형
                <select
                  className="work-input"
                  value={form.serviceType}
                  onChange={(e) =>
                    setForm({ ...form, serviceType: e.target.value })
                  }
                >
                  {Object.entries(serviceLabels).map(([v, t]) => (
                    <option
                      key={v}
                      value={v}
                    >
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <label>
            제목
            <input
              required
              maxLength={200}
              className="work-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="어떤 업무를 진행했나요?"
            />
          </label>
          <div className="work-form-row">
            <label>
              작업일
              <input
                type="date"
                className="work-input"
                required
                value={form.workDate}
                onChange={(e) => setForm({ ...form, workDate: e.target.value })}
              />
            </label>
            <label>
              진행 상태
              <select
                className="work-input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {Object.entries(statusLabels).map(([v, t]) => (
                  <option
                    key={v}
                    value={v}
                  >
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            업무 내용
            <textarea
              required
              className="work-input"
              rows={10}
              maxLength={100000}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder={
                form.kind === "FIELD"
                  ? "증상, 작업 내용, 결과와 후속 조치를 기록하세요."
                  : "진행한 업무와 결과를 기록하세요."
              }
            />
          </label>
          <div className="work-form-actions">
            <Link
              href="/work"
              className="work-secondary"
            >
              취소
            </Link>
            <button
              className="work-primary"
              disabled={saving}
            >
              {saving ? "저장 중…" : "기록 저장"}
            </button>
          </div>
        </form>
      ) : (
        record && <ReadRecord record={record} />
      )}
      {!editing && canEdit && (
        <button
          className="work-delete"
          disabled={saving}
          onClick={() => void remove()}
        >
          기록 삭제
        </button>
      )}
    </main>
  );
}
function ReadRecord({ record: r }: { record: WorkRecord }) {
  return (
    <article className="work-panel work-form">
      <div>
        <span className="work-badge">
          {r.kind === "GENERAL"
            ? "일반 업무"
            : serviceLabels[r.serviceType || ""]}
        </span>
        <span className="work-status">{statusLabels[r.status]}</span>
      </div>
      <h2>{r.title}</h2>
      {r.siteId && (
        <Link
          href={`/sites/${Number(r.siteId) || r.siteId}`}
          className="work-back"
        >
          {r.siteName} →
        </Link>
      )}
      <p className="work-prewrap">{r.body}</p>
    </article>
  );
}
