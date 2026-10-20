"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";
import { dayString, errorText } from "./workspace-data";
import { ChoiceGroup } from "./choice-group";
import { ErrorState } from "./workspace-pages";
export const assetTypes: Record<string, string> = {
  MRI: "MRI 장비",
  CHILLER: "그라디언트 칠러",
  COLDHEAD: "콜드헤드",
  OTHER: "기타 부품",
};
const assetStatus: Record<string, string> = {
  ACTIVE: "사용 중",
  REPLACED: "교체됨",
  REMOVED: "사용 종료",
};
export type HospitalAsset = {
  id: number;
  assetType: string;
  name: string;
  model: string;
  version: string;
  serialNumber: string;
  installedAt: string | null;
  status: string;
  notes: string;
  revision: number;
};
type AssetHistory = {
  id: number;
  assetId: number;
  recordId: number;
  snapshotJson: string;
  changeKind: string;
  title: string;
  body: string;
  workDate: string;
  status: string;
  authorName: string;
  engineerName?: string;
  sourceId?: string | null;
};
export function useHospitalAssets(siteId: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["workspace-assets", session?.id, siteId],
    queryFn: () =>
      apiFetch<{ assets: HospitalAsset[]; history: AssetHistory[] }>(
        `/workspace/sites/${encodeURIComponent(siteId)}/assets`,
      ),
    enabled: !!session && !!siteId,
  });
}
const fresh = (type: string) => ({
  assetType: type,
  name: assetTypes[type],
  model: "",
  version: "",
  serialNumber: "",
  installedAt: "",
  status: "ACTIVE",
  notes: "",
  workDate: dayString(),
  changeNote: "",
  revision: 1,
});
export default function HospitalAssets({ siteId }: { siteId: string }) {
  const { session } = useAuth();
  const query = useHospitalAssets(siteId),
    qc = useQueryClient();
  const [editing, setEditing] = useState<number | null | undefined>(undefined);
  const [form, setForm] = useState(fresh("CHILLER")),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const assets = query.data?.assets || [];
  function begin(asset?: HospitalAsset, type = "CHILLER") {
    setError("");
    setEditing(asset?.id ?? null);
    requestAnimationFrame(() =>
      document
        .querySelector(".asset-editor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
    setForm(
      asset
        ? {
            ...asset,
            installedAt: asset.installedAt || "",
            workDate: dayString(),
            changeNote: "",
          }
        : fresh(type),
    );
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch(
        `/workspace/sites/${encodeURIComponent(siteId)}/assets${editing ? `/${editing}` : ""}`,
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify({
            ...form,
            installedAt: form.installedAt || null,
          }),
        },
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["workspace-assets"] }),
        qc.invalidateQueries({ queryKey: ["workspace-records"] }),
      ]);
      setEditing(undefined);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (!session) return null;
  return (
    <section className="work-panel hospital-assets">
      <div className="work-section">
        <div>
          <h2>장비·부품 관리</h2>
          <p className="work-hint">
            사용 중인 장비와 부품의 정보·변경 이력을 관리하세요.
          </p>
        </div>
        <div className="asset-actions">
          <button
            className="work-secondary"
            onClick={() => begin(undefined, "MRI")}
          >
            ＋ 장비
          </button>
          <button
            className="work-primary"
            onClick={() => begin()}
          >
            ＋ 부품
          </button>
        </div>
      </div>
      {query.error && (
        <ErrorState
          error={query.error}
          retry={() => void query.refetch()}
        />
      )}
      {query.isPending && <p role="status">장비·부품을 불러오는 중…</p>}
      {editing !== undefined && (
        <form
          onSubmit={save}
          className="work-form asset-editor"
        >
          <div className="work-section">
            <h3>{editing ? "정보 변경·정비 기록" : "장비·부품 등록"}</h3>
            <button
              type="button"
              className="work-secondary"
              onClick={() => setEditing(undefined)}
            >
              닫기
            </button>
          </div>
          {editing ? (
            <p className="work-badge">{assetTypes[form.assetType]}</p>
          ) : (
            <ChoiceGroup
              legend="종류"
              value={form.assetType}
              options={Object.entries(assetTypes)}
              onChange={(assetType) =>
                setForm({ ...form, assetType, name: assetTypes[assetType] })
              }
            />
          )}
          <label>
            이름 *
            <input
              className="work-input"
              required
              maxLength={200}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 콜드헤드 A2"
            />
          </label>
          <div className="work-form-row">
            {(
              [
                ["model", "모델"],
                ["version", "버전"],
                ["serialNumber", "시리얼 번호"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  className="work-input"
                  maxLength={key === "version" ? 100 : 200}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="work-form-row">
            <label>
              설치일
              <input
                className="work-input"
                type="date"
                value={form.installedAt}
                onChange={(e) =>
                  setForm({ ...form, installedAt: e.target.value })
                }
              />
            </label>
            <label>
              기록일 *
              <input
                required
                className="work-input"
                type="date"
                value={form.workDate}
                onChange={(e) => setForm({ ...form, workDate: e.target.value })}
              />
            </label>
          </div>
          <ChoiceGroup
            legend="사용 상태"
            value={form.status}
            options={Object.entries(assetStatus)}
            onChange={(status) => setForm({ ...form, status })}
          />
          <label>
            관리 메모
            <textarea
              className="work-input"
              maxLength={10000}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <label>
            변경·정비 내용 *
            <textarea
              required
              className="work-input"
              rows={3}
              maxLength={10000}
              value={form.changeNote}
              onChange={(e) => setForm({ ...form, changeNote: e.target.value })}
              placeholder="등록 사유, 버전 변경, 시리얼 교체 또는 정비 내용을 기록하세요."
            />
          </label>
          <p className="work-hint">
            저장하면 변경 전·후 정보가 보관되고 병원 정비이력에도 기록됩니다.
            다른 실물 부품으로 교체했다면 기존 부품은 ‘교체됨’으로 남기고 새
            부품을 등록하세요.
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
              disabled={busy}
              onClick={() => setEditing(undefined)}
            >
              취소
            </button>
            <button
              className="work-primary"
              disabled={busy}
            >
              {busy ? "저장 중…" : "정보와 이력 저장"}
            </button>
          </div>
        </form>
      )}
      {!query.isPending &&
        !query.error &&
        !assets.length &&
        editing === undefined && (
          <p className="work-empty">
            아직 등록한 장비·부품이 없습니다. 모델·버전·시리얼을 추가해 관리를
            시작하세요.
          </p>
        )}
      {[
        {
          title: "MRI 장비",
          items: assets.filter(
            (a) => a.assetType === "MRI" && a.status === "ACTIVE",
          ),
          equipment: true,
        },
        {
          title: "사용 중인 부품",
          items: assets.filter(
            (a) => a.assetType !== "MRI" && a.status === "ACTIVE",
          ),
          equipment: false,
        },
        {
          title: "교체·사용 종료 이력",
          items: assets.filter((a) => a.status !== "ACTIVE"),
          archived: true,
        },
      ].map((group) => {
        if (!group.items.length) return null;
        const cards = (
          <div
            className={`asset-grid ${group.equipment ? "asset-grid-equipment" : ""}`}
          >
            {group.items.map((asset) => (
              <article
                className={`asset-card asset-${asset.assetType.toLowerCase()}`}
                key={asset.id}
              >
                <div className="work-section">
                  <span className="work-badge">
                    {assetTypes[asset.assetType]}
                  </span>
                  <span
                    className={`asset-state ${asset.status === "ACTIVE" ? "active" : ""}`}
                  >
                    {assetStatus[asset.status]}
                  </span>
                </div>
                <h3>{asset.name}</h3>
                <dl className="asset-specs">
                  <div>
                    <dt>모델 · 버전</dt>
                    <dd>
                      {[asset.model, asset.version]
                        .filter(Boolean)
                        .join(" · ") || "미등록"}
                    </dd>
                  </div>
                  <div>
                    <dt>시리얼 번호</dt>
                    <dd>{asset.serialNumber || "미등록"}</dd>
                  </div>
                  <div>
                    <dt>설치일</dt>
                    <dd>{asset.installedAt || "미등록"}</dd>
                  </div>
                </dl>
                {asset.notes && <p className="work-prewrap">{asset.notes}</p>}
                <div className="asset-actions">
                  <button
                    className="work-secondary"
                    onClick={() => begin(asset)}
                  >
                    정보 변경·기록
                  </button>
                  <Link
                    className="work-secondary"
                    href={`/work/new?site=${encodeURIComponent(siteId)}&asset=${asset.id}`}
                  >
                    정비일지 작성 →
                  </Link>
                </div>
                <details className="asset-history">
                  <summary>
                    부품·장비 이력{" "}
                    {
                      (query.data?.history || []).filter(
                        (h) => h.assetId === asset.id,
                      ).length
                    }
                    건
                  </summary>
                  {(query.data?.history || [])
                    .filter((h) => h.assetId === asset.id)
                    .map((h) => (
                      <AssetHistoryRow
                        key={h.id}
                        item={h}
                      />
                    ))}
                </details>
              </article>
            ))}
          </div>
        );
        return group.archived ? (
          <details
            className="asset-archived"
            key={group.title}
          >
            <summary>
              {group.title} · {group.items.length}개
            </summary>
            {cards}
          </details>
        ) : (
          <section key={group.title}>
            <h3 className="asset-group-title">
              {group.title} · {group.items.length}개
            </h3>
            {cards}
          </section>
        );
      })}
    </section>
  );
}
function AssetHistoryRow({ item: h }: { item: AssetHistory }) {
  let snapshot: { before?: HospitalAsset; after?: HospitalAsset } = {};
  try {
    snapshot = JSON.parse(h.snapshotJson);
  } catch {}
  return (
    <div className="asset-history-row">
      <Link href={`/work/${h.recordId}`}>
        <strong>{h.title} →</strong>
      </Link>
      <small>
        {h.workDate} ·{" "}
        {h.engineerName
          ? `담당 ${h.engineerName}`
          : `작성자 ${h.authorName}`}
      </small>
      <p className="work-prewrap">{h.body}</p>
      {snapshot.after && (
        <p className="work-hint">
          기록 당시:{" "}
          {[
            snapshot.after.model,
            snapshot.after.version,
            snapshot.after.serialNumber && `S/N ${snapshot.after.serialNumber}`,
          ]
            .filter(Boolean)
            .join(" · ") || "상세 미등록"}
        </p>
      )}
      {snapshot.before && (
        <details>
          <summary>변경 전 정보</summary>
          <p className="work-hint">
            {snapshot.before.name} · {snapshot.before.model || "모델 미등록"} ·
            버전 {snapshot.before.version || "미등록"} · S/N{" "}
            {snapshot.before.serialNumber || "미등록"} ·{" "}
            {assetStatus[snapshot.before.status]} · 설치{" "}
            {snapshot.before.installedAt || "미등록"}
          </p>
          <p className="work-prewrap">{snapshot.before.notes}</p>
        </details>
      )}
    </div>
  );
}
export function AssetSelection({
  siteId,
  value,
  onChange,
}: {
  siteId: string;
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const query = useHospitalAssets(siteId);
  const components = (query.data?.assets || []).filter((a) => a.assetType !== "MRI");
  if (!siteId) return null;
  return (
    <fieldset className="asset-selection">
      <legend>정비 부품</legend>
      <p className="work-hint">
        칠러·콜드헤드 등 정비한 부품을 선택해주세요. MRI 본체 작업은 병원 정비이력에 남습니다.
      </p>
      {query.error ? (
        <ErrorState
          error={query.error}
          retry={() => void query.refetch()}
        />
      ) : query.isPending ? (
        <p>불러오는 중…</p>
      ) : components.length ? (
        <div className="asset-options">
          {components.map((a) => (
            <label
              className="work-check"
              key={a.id}
            >
              <input
                type="checkbox"
                checked={value.includes(a.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...value, a.id]
                      : value.filter((id) => id !== a.id),
                  )
                }
              />
              <span>
                <strong>{a.name}</strong>
                <small>
                  {[
                    a.model,
                    a.version,
                    a.serialNumber && `S/N ${a.serialNumber}`,
                    assetStatus[a.status],
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <Link
          className="work-back"
          href={`/sites/${Number(siteId) || siteId}`}
        >
          병원 상세에서 부품 등록 →
        </Link>
      )}
    </fieldset>
  );
}

export function AssetRecordSummary({
  siteId,
  recordId,
}: {
  siteId: string;
  recordId: number;
}) {
  const query = useHospitalAssets(siteId);
  const rows = (query.data?.history || []).filter(
    (h) => h.recordId === recordId && query.data?.assets.some((a) => a.id === h.assetId && a.assetType !== "MRI"),
  );
  if (!rows.length) return null;
  return (
    <section className="asset-selection">
      <h3>정비 부품</h3>
      {rows.map((h) => {
        let a: HospitalAsset | undefined;
        let historicalModel: string | undefined;
        try {
          const snapshot = JSON.parse(h.snapshotJson);
          a = snapshot.after;
          if (snapshot.historicalStateKnown === false)
            historicalModel = snapshot.sourceModel;
        } catch {}
        if (historicalModel)
          return (
            <p key={h.id}>
              <Link
                className="work-back"
                href={`/sites/${Number(siteId) || siteId}`}
              >
                {historicalModel} →
              </Link>
              <small className="work-hint"> · 당시 버전·시리얼 미기록</small>
            </p>
          );
        return a ? (
          <p key={h.id}>
            <Link
              className="work-back"
              href={`/sites/${Number(siteId) || siteId}`}
            >
              {a.name} →
            </Link>
            <small className="work-hint">
              {" "}
              · 기록 당시{" "}
              {[a.model, a.version, a.serialNumber && `S/N ${a.serialNumber}`]
                .filter(Boolean)
                .join(" · ") || "상세 미등록"}
            </small>
          </p>
        ) : null;
      })}
    </section>
  );
}
