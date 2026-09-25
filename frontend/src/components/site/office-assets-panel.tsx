"use client";

import {
  type OfficeMaintenance,
  useOfficeAssetsQuery,
} from "@/hooks/use-office-assets-query";
import { useState } from "react";

type Tab = "equipment" | "components" | "maintenance";

const SERVICE_LABELS: Record<string, string> = {
  PM: "정기점검",
  REPAIR: "고장수리",
  COLDHEAD: "Cold Head",
  ACR: "ACR",
  INSTALL: "설치",
  CALL: "전화지원",
  ETC: "기타",
};

export default function OfficeAssetsPanel({ siteId }: { siteId: string }) {
  const [tab, setTab] = useState<Tab>("equipment");
  const query = useOfficeAssetsQuery(siteId);

  if (query.isLoading) {
    return (
      <section className="dark:border-background-dark-secondary dark:bg-background-dark-card mb-3 rounded-xl border bg-white p-4 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <section className="dark:border-background-dark-secondary dark:bg-background-dark-card mb-3 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-extrabold">장비·정비 정보</h2>
            <p className="text-text-secondary dark:text-text-dark-primary/65 mt-1 text-sm">
              연결된 인트라넷 사이트가 없거나 현재 정보를 불러올 수 없습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="min-h-10 rounded-lg border px-3 text-sm font-bold"
          >
            다시 시도
          </button>
        </div>
      </section>
    );
  }

  const data = query.data;
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "equipment", label: "장비", count: data.equipment.length },
    { key: "components", label: "부품", count: data.components.length },
    {
      key: "maintenance",
      label: "정비 이력",
      count: data.maintenanceHistory.length,
    },
  ];

  return (
    <section className="dark:border-background-dark-secondary dark:bg-background-dark-card mb-3 min-w-0 rounded-xl border bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold">장비·정비 정보</h2>
          <p className="text-text-secondary dark:text-text-dark-primary/65 mt-0.5 text-xs sm:text-sm">
            PENTA OFFICE 연동 · 읽기 전용
            {data.site.address ? ` · ${data.site.address}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          연결됨 · {data.site.mreyesSiteId}
        </span>
      </div>

      <div
        className="bg-background-tertiary dark:bg-background-dark-secondary/60 mt-3 grid grid-cols-3 rounded-lg p-1"
        role="tablist"
        aria-label="인트라넷 자산 정보"
      >
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={`min-h-11 rounded-md px-1 text-sm font-extrabold ${tab === item.key ? "dark:bg-background-dark-card bg-white shadow-sm" : "text-text-secondary dark:text-text-dark-primary/70"}`}
          >
            {item.label} <span className="tabular-nums">{item.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-3" role="tabpanel">
        {tab === "equipment" && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {data.equipment.map((equipment) => (
              <article
                key={equipment.id}
                className="dark:border-background-dark-secondary rounded-lg border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <strong className="break-words">
                    {equipment.model || equipment.equipmentType || "장비"}
                  </strong>
                  <Status value={equipment.status} />
                </div>
                <p className="text-text-secondary dark:text-text-dark-primary/70 mt-1 text-sm">
                  {join([
                    equipment.manufacturer,
                    equipment.magneticFieldTesla
                      ? `${equipment.magneticFieldTesla}T`
                      : null,
                    equipment.serialNumber
                      ? `S/N ${equipment.serialNumber}`
                      : null,
                  ]) || "상세 정보 미등록"}
                </p>
                <p className="text-text-secondary dark:text-text-dark-primary/55 mt-1 text-xs">
                  {join([
                    equipment.softwareVersion
                      ? `SW ${equipment.softwareVersion}`
                      : null,
                    equipment.installedAt
                      ? `설치 ${date(equipment.installedAt)}`
                      : null,
                  ])}
                </p>
              </article>
            ))}
            {!data.equipment.length && <Empty text="등록된 장비가 없습니다." />}
          </div>
        )}

        {tab === "components" && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {data.components.map((component) => {
              const equipment = data.equipment.find(
                (item) => item.id === component.equipmentId,
              );
              return (
                <article
                  key={component.id}
                  className="dark:border-background-dark-secondary rounded-lg border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <strong className="break-words">{component.name}</strong>
                    <Status value={component.status} />
                  </div>
                  <p className="text-text-secondary dark:text-text-dark-primary/70 mt-1 text-sm">
                    {join([
                      component.componentType,
                      component.partNumber ? `P/N ${component.partNumber}` : null,
                      component.serialNumber
                        ? `S/N ${component.serialNumber}`
                        : null,
                    ]) || "부품 상세 미등록"}
                  </p>
                  <p className="text-text-secondary dark:text-text-dark-primary/55 mt-1 text-xs">
                    {join([
                      equipment?.model ? `장비 ${equipment.model}` : null,
                      component.installedAt
                        ? `설치 ${date(component.installedAt)}`
                        : null,
                      component.replacedAt
                        ? `교체 ${date(component.replacedAt)}`
                        : null,
                    ])}
                  </p>
                  {component.notes && (
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {component.notes}
                    </p>
                  )}
                </article>
              );
            })}
            {!data.components.length && <Empty text="등록된 부품이 없습니다." />}
          </div>
        )}

        {tab === "maintenance" && (
          <div className="space-y-2">
            {data.maintenanceHistory.map((item) => (
              <MaintenanceRow key={item.id} item={item} />
            ))}
            {!data.maintenanceHistory.length && (
              <Empty text="등록된 정비 이력이 없습니다." />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function MaintenanceRow({ item }: { item: OfficeMaintenance }) {
  const title =
    item.serviceTitle ||
    SERVICE_LABELS[item.serviceType ?? ""] ||
    item.equipmentName ||
    "정비 기록";
  const details = [
    ["증상", item.symptom],
    ["작업 내용", item.description],
    ["사용·교체 부품", item.partsDetails],
    ["특이사항", item.specialNotes],
    ["비고", item.remarks],
    ["후속 조치", item.followUp],
  ].filter((entry) => entry[1]);
  return (
    <details className="dark:border-background-dark-secondary group rounded-lg border p-3">
      <summary className="flex min-h-10 cursor-pointer list-none items-start justify-between gap-3">
        <span className="min-w-0">
          <strong className="block break-words">{title}</strong>
          <span className="text-text-secondary dark:text-text-dark-primary/65 mt-1 block text-xs sm:text-sm">
            {join([
              item.workDate ? date(item.workDate) : null,
              item.equipmentName,
              item.modelName,
              item.engineerName ? `담당 ${item.engineerName}` : null,
            ]) || "상세 정보 미등록"}
          </span>
        </span>
        <span className="shrink-0 text-sm font-bold group-open:hidden">열기</span>
        <span className="hidden shrink-0 text-sm font-bold group-open:inline">닫기</span>
      </summary>
      <div className="dark:border-background-dark-secondary mt-2 border-t pt-3">
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <Status value={item.status} />
          {item.contractType && <Tag text={`계약 ${item.contractType}`} />}
          {item.workStartTime && (
            <Tag
              text={`${item.workStartTime.slice(0, 5)}${item.workEndTime ? `–${item.workEndTime.slice(0, 5)}` : ""}`}
            />
          )}
          {item.photoCount > 0 && <Tag text={`사진 ${item.photoCount}장`} />}
        </div>
        {details.length ? (
          <dl className="space-y-3">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="text-text-secondary dark:text-text-dark-primary/60 text-xs font-bold">
                  {label}
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-6">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-text-secondary dark:text-text-dark-primary/60 text-sm">
            추가 작업 내용이 없습니다.
          </p>
        )}
      </div>
    </details>
  );
}

function Status({ value }: { value: string | null }) {
  const label =
    ({
      ACTIVE: "사용 중",
      REMOVED: "사용 종료",
      REPLACED: "교체됨",
      RECEIVED: "접수",
      IN_PROGRESS: "진행 중",
      COMPLETED: "완료",
    } as Record<string, string>)[value ?? ""] ?? value ?? "상태 미등록";
  return (
    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {label}
    </span>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold dark:bg-slate-800">
      {text}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-text-secondary dark:text-text-dark-primary/60 rounded-lg border border-dashed p-4 text-sm md:col-span-2">
      {text}
    </p>
  );
}

function join(values: (string | null | undefined)[]) {
  return values.filter(Boolean).join(" · ");
}

function date(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : value;
}
