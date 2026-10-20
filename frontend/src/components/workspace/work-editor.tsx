"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
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
import HospitalPicker from "./hospital-picker";
import { ChoiceGroup } from "./choice-group";
import ServiceFields from "./service-fields";
import {
  initialDetails,
  parseDetails,
  computedDetails,
  type WorkDetails,
} from "./service-form-model";
import {
  PhotoAttachments,
  PhotoGallery,
  type PhotoAttachmentApi,
} from "./work-photos";
import { AssetSelection, AssetRecordSummary } from "./hospital-assets";
const generalTypes: [string, string][] = [
  ["office", "사무실 업무"],
  ["education", "교육 · 세미나"],
  ["leave", "휴가"],
  ["annual", "연차"],
  ["etc", "기타 일정"],
];
export default function WorkEditor({ id }: { id?: string }) {
  const attachmentApi = useRef<PhotoAttachmentApi>(null);
  const router = useRouter(),
    search = useSearchParams(),
    qc = useQueryClient();
  const { session, isAdmin } = useAuth();
  const { sites, records, schedules } = useWorkspace();
  const [form, setForm] = useState({
    kind: "FIELD",
    siteId: search.get("site") || "",
    serviceType: "PM",
    title: "",
    body: "",
    workDate: search.get("date") || dayString(),
    status: "COMPLETED",
  });
  const [details, setDetails] = useState<WorkDetails>(() => ({
      ...initialDetails(),
      assetIds:
        search.get("asset") && /^\d+$/.test(search.get("asset")!)
          ? [Number(search.get("asset"))]
          : [],
    })),
    [photoIds, setPhotoIds] = useState<number[] | null>(null),
    [photoBusy, setPhotoBusy] = useState(false);
  const [loadedId, setLoadedId] = useState<string | undefined>(),
    [editing, setEditing] = useState(!id),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const record = records.data?.find((r) => String(r.id) === id);
  useEffect(() => {
    if (record && loadedId !== id) {
      setForm({
        kind: record.kind,
        siteId: record.siteId || "",
        serviceType: record.serviceType || "PM",
        title: record.title,
        body: record.body,
        workDate: record.workDate,
        status: record.status,
      });
      setDetails({
        ...parseDetails(record.detailsJson),
        scheduleId: record.scheduleId || null,
        engineer:
          record.engineerName ?? parseDetails(record.detailsJson).engineer,
      });
      setPhotoIds(null);
      setLoadedId(id);
    }
  }, [record, loadedId, id]);
  const linkedFromQuery = useRef(false);
  useEffect(() => {
    if (
      id ||
      linkedFromQuery.current ||
      !search.get("schedule") ||
      !schedules.data
    )
      return;
    const schedule = schedules.data.find(
      (s) => String(s.id) === search.get("schedule"),
    );
    linkedFromQuery.current = true;
    if (!schedule) {
      setError("연결할 일정을 찾을 수 없습니다. 일정을 다시 선택해주세요.");
      return;
    }
    setForm((f) => ({
      ...f,
      kind: schedule.siteId ? "FIELD" : "GENERAL",
      siteId: schedule.siteId || "",
      serviceType: schedule.serviceType || "ETC",
      workDate: schedule.startAt.slice(0, 10),
    }));
    setDetails((d) => ({
      ...d,
      scheduleId: schedule.id,
      personalKind: schedule.personalKind === "edu" ? "education" : schedule.personalKind || d.personalKind,
    }));
  }, [id, search, schedules.data]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (photoBusy) return;
    setSaving(true);
    setError("");
    try {
      if (form.kind === "FIELD" && !form.siteId)
        throw Error("병원을 선택해주세요.");
      const computed = computedDetails({
        ...details,
        engineer: details.engineer || session?.name || "",
        assetIds: form.kind === "FIELD" ? details.assetIds : [],
      });
      const title =
        form.title.trim() ||
        (form.kind === "FIELD"
          ? form.serviceType === "COLDHEAD"
            ? `Cold Head ${details.coldheadPosition}`
            : serviceLabels[form.serviceType]
          : "일반 업무");
      const body =
        form.body.trim() ||
        (["PM", "ACR"].includes(form.serviceType) && form.kind === "FIELD"
          ? `${title} 점검표`
          : form.body);
      const result = await apiFetch<{ id?: number }>(
        id ? `/workspace/records/${id}` : "/workspace/records",
        {
          method: id ? "PUT" : "POST",
          body: JSON.stringify({
            ...form,
            title,
            body,
            details: computed,
            photoIds,
          }),
        },
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["workspace-records"] }),
        qc.invalidateQueries({ queryKey: ["workspace-planning"] }),
        qc.invalidateQueries({ queryKey: ["workspace-photos"] }),
        qc.invalidateQueries({ queryKey: ["workspace-assets"] }),
      ]);
      if (id) setEditing(false);
      else router.replace(`/work/${result.id}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!window.confirm("이 작업일지를 삭제할까요?")) return;
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
    return <main className="work-page">작업일지를 불러오는 중…</main>;
  if (id && !record)
    return (
      <main className="work-page">
        <Empty>기록을 찾을 수 없거나 접근 권한이 없습니다.</Empty>
        <Link href="/work">목록으로</Link>
      </main>
    );
  const canEdit = !record || record.authorId === session?.id || isAdmin;
  const field = form.kind === "FIELD",
    type = form.serviceType;
  return (
    <main className="work-page work-editor">
      <Link
        href="/work"
        className="work-back"
      >
        ← 작업일지
      </Link>
      <PageHeading
        title={id ? (editing ? "작업일지 수정" : "작업일지") : "새 작업일지"}
        description={
          editing
            ? "작업 구분에 맞는 점검·서비스 기록을 작성하세요."
            : `${record?.workDate} · 작성자 ${record?.authorName}`
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
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) e.preventDefault();
          }}
          onDrop={(e) => {
            if (e.dataTransfer.files.length) {
              e.preventDefault();
              attachmentApi.current?.addFiles(Array.from(e.dataTransfer.files));
            }
          }}
          onPaste={(e) => {
            if (e.clipboardData.files.length) {
              e.preventDefault();
              attachmentApi.current?.addFiles(
                Array.from(e.clipboardData.files),
              );
            }
          }}
          onSubmit={save}
          className="work-panel work-form"
        >
          <ChoiceGroup
            legend="대상"
            value={form.kind}
            onChange={(kind) => setForm({ ...form, kind })}
            options={[
              ["FIELD", "병원 · 현장 서비스"],
              ["GENERAL", "병원 외 · 일반 업무"],
            ]}
          />
          {field ? (
            <>
              <ChoiceGroup
                legend="작업 구분"
                value={type}
                onChange={(serviceType) =>
                  setForm({
                    ...form,
                    serviceType,
                    status: serviceType === "CALL" ? "COMPLETED" : form.status,
                  })
                }
                options={Object.entries(serviceLabels)}
              />
              <label>
                병원 <span aria-hidden="true">*</span>
                <HospitalPicker
                  sites={sites.data || []}
                  value={form.siteId}
                  onChange={(siteId) => {
                    setForm({ ...form, siteId });
                    setDetails({ ...details, assetIds: [] });
                  }}
                />
                {sites.error && (
                  <span role="alert">병원 목록을 불러오지 못했습니다.</span>
                )}
              </label>
            </>
          ) : (
            <ChoiceGroup
              legend="업무 분류"
              value={details.personalKind}
              onChange={(personalKind) =>
                setDetails({ ...details, personalKind })
              }
              options={generalTypes}
            />
          )}
          <div className="work-form-row">
            <label>
              작업일 *
              <input
                className="work-input"
                type="date"
                required
                value={form.workDate}
                onChange={(e) => setForm({ ...form, workDate: e.target.value })}
              />
            </label>
            {(!field || type !== "CALL") && (
              <label>
                담당자
                <input
                  className="work-input"
                  maxLength={100}
                  value={details.engineer || session?.name || ""}
                  onChange={(e) =>
                    setDetails({ ...details, engineer: e.target.value })
                  }
                />
              </label>
            )}
          </div>
          {field && type !== "CALL" && (
            <label>
              장비 (모델)
              <input
                className="work-input"
                maxLength={200}
                value={details.model}
                onChange={(e) =>
                  setDetails({ ...details, model: e.target.value })
                }
                placeholder="예: Signa HDxt 1.5T"
              />
            </label>
          )}
          {field && (
            <AssetSelection
              siteId={form.siteId}
              value={details.assetIds}
              onChange={(assetIds) => setDetails({ ...details, assetIds })}
            />
          )}
          <details className="work-schedule-link" key={details.scheduleId ? "linked" : "unlinked"} open={details.scheduleId ? true : undefined}>
            <summary>{details.scheduleId ? "연결된 일정" : "예정된 일정과 연결 (선택)"}</summary>
            <p className="work-hint">일정에 대한 작업 결과라면 연결해주세요. 일정 없이도 일지를 작성할 수 있습니다.</p>
          <label>
            연결할 일정
            <select
              className="work-input"
              value={details.scheduleId || ""}
              onChange={(e) =>
                setDetails({
                  ...details,
                  scheduleId: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">일정 없이 작성</option>
              {(schedules.data || [])
                .filter(
                  (s) =>
                    s.siteId === (form.kind === "FIELD" ? form.siteId : null) ||
                    s.id === details.scheduleId,
                )
                .map((s) => (
                  <option
                    key={s.id}
                    value={s.id}
                  >
                    {s.startAt.slice(0, 10)} · {s.siteName || s.title} ·{" "}
                    {s.title}
                  </option>
                ))}
              {details.scheduleId &&
                !schedules.data?.some((s) => s.id === details.scheduleId) && (
                  <option value={details.scheduleId}>
                    기존 연결 일정 (삭제되었거나 조회 불가)
                  </option>
                )}
            </select>
          </label>
          </details>
          <label>
            제목
            <input
              className="work-input"
              maxLength={200}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={
                field
                  ? type === "COLDHEAD"
                    ? `Cold Head ${details.coldheadPosition}`
                    : serviceLabels[type]
                  : "어떤 업무를 진행했나요?"
              }
            />
          </label>
          {field &&
            ["REPAIR", "COLDHEAD", "ACR", "ETC", "INSTALL"].includes(type) && (
              <label className="work-check">
                <input
                  type="checkbox"
                  checked={details.countsAsPm}
                  onChange={(e) =>
                    setDetails({ ...details, countsAsPm: e.target.checked })
                  }
                />
                이 방문을 PM 정기점검 주기에도 포함
              </label>
            )}
          {field && (
            <ServiceFields
              type={type}
              details={details}
              onChange={setDetails}
            />
          )}
          <label>
            {field
              ? type === "CALL"
                ? "콜 내용"
                : type === "PM"
                  ? "점검 내용 / 특이사항"
                  : "조치 내용 / 특이사항"
              : "업무 내용"}
            <textarea
              className="work-input"
              rows={6}
              required={!field || !["PM", "ACR"].includes(type)}
              maxLength={100000}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder={
                type === "CALL" && field
                  ? "문의 내용과 안내 사항을 기록하세요."
                  : "작업 내용, 결과와 특이사항을 기록하세요."
              }
            />
          </label>
          {(!field || type !== "CALL") && (
            <ChoiceGroup
              legend="진행 상태"
              value={form.status}
              onChange={(status) => setForm({ ...form, status })}
              options={Object.entries(statusLabels)}
            />
          )}
          {form.status !== "COMPLETED" && (
            <label>
              후속 조치 / 재방문 계획
              <textarea
                className="work-input"
                value={details.followUp}
                onChange={(e) =>
                  setDetails({ ...details, followUp: e.target.value })
                }
              />
            </label>
          )}
          <PhotoAttachments
            attachmentApi={attachmentApi}
            key={id || "new"}
            recordId={id ? Number(id) : undefined}
            onChange={setPhotoIds}
            onBusy={setPhotoBusy}
          />
          <label>
            방문 전 확인사항
            <textarea
              className="work-input"
              maxLength={10000}
              rows={3}
              value={details.prepItems}
              onChange={(e) =>
                setDetails({ ...details, prepItems: e.target.value })
              }
              placeholder="부품 챙기기, 병원에 연락하기 등 방문 전에 확인할 일을 한 줄에 하나씩 입력하세요."
            />
            <small className="work-hint">
              업무 현황의 ‘방문 전 확인사항’에 표시됩니다.
            </small>
          </label>
          <div className="work-form-actions">
            <Link
              className="work-secondary"
              href="/work"
            >
              취소
            </Link>
            <button
              className="work-primary"
              disabled={saving || photoBusy}
            >
              {saving
                ? "저장 중…"
                : photoBusy
                  ? "사진 처리 중…"
                  : id
                    ? "변경 저장"
                    : "작업일지 저장"}
            </button>
          </div>
        </form>
      ) : (
        record && <ReadRecord record={record} />
      )}
      {!editing && canEdit && !record?.assetChange && (
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
  const d = parseDetails(r.detailsJson);
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
  const showBody = !!r.body.trim() && ![d.symptom, d.parts, d.followUp].some((text) => !!text.trim() && normalize(text) === normalize(r.body));
  return (
    <article className="work-panel work-form">
      <div>
        <span
          className={`work-badge service-${r.serviceType?.toLowerCase() || "general"}`}
        >
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
      <dl className="work-details">
        {[
          ["장비", d.model],
          ["담당자", d.engineer],
          ["증상 / 요청", d.symptom],
          ["교체 부품", d.parts],
          [
            "작업 시간",
            d.startTime || d.endTime ? `${d.startTime} ~ ${d.endTime}` : "",
          ],
          ["헬륨 레벨", d.heLevel ? d.heLevel + "%" : ""],
          [
            "Cold Head",
            r.serviceType === "COLDHEAD"
              ? `${d.coldheadPosition} · ${d.coldheadSerial} · 입고 ${d.coldheadInDate}`
              : "",
          ],
          ["후속 조치", d.followUp],
          ["방문 전 확인사항", d.prepItems],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd className="work-prewrap">{v}</dd>
            </div>
          ))}
      </dl>
      {r.scheduleId && (
        <Link
          className="work-back"
          href={`/schedule?date=${r.scheduleDate || r.workDate}`}
        >
          연결된 일정 보기 →
        </Link>
      )}
      {showBody && <p className="work-prewrap">{r.body}</p>}
      {r.serviceType === "PM" && (
        <section>
          <h2>PM 점검표</h2>
          {d.pm.map((item) => (
            <div
              className="work-pm-read"
              key={item.name}
            >
              <strong>{item.name}</strong>
              <span>
                {item.options.find((o) => o.v === item.result)?.l || "미입력"}
              </span>
              {item.fields.map((f) => (
                <p key={f.label}>
                  {f.label}:{" "}
                  {f.type === "check"
                    ? f.value === "Y"
                      ? "확인"
                      : "미확인"
                    : f.value || "—"}{" "}
                  {f.suffix}
                </p>
              ))}
              {item.comment && <p>{item.comment}</p>}
            </div>
          ))}
        </section>
      )}
      {r.serviceType === "ACR" && (
        <section>
          <h2>
            ACR{" "}
            {
              (
                { doc: "서류", full: "정밀", pretest: "사전 TEST" } as Record<
                  string,
                  string
                >
              )[d.acrKind]
            }
          </h2>
          <fieldset
            disabled
            className="work-readonly"
          >
            <ServiceFields
              type="ACR"
              details={d}
              onChange={() => {}}
            />
          </fieldset>
        </section>
      )}
      {r.siteId && (
        <AssetRecordSummary
          siteId={r.siteId}
          recordId={r.id}
        />
      )}
      <PhotoGallery recordId={r.id} />
    </article>
  );
}
