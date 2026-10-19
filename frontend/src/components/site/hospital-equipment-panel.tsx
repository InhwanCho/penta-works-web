"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import HospitalAssets, {
  useHospitalAssets,
  assetTypes,
} from "@/components/workspace/hospital-assets";
import OfficeAssetsPanel from "./office-assets-panel";
import { useAuth } from "@/components/provider/auth-provider";

export default function HospitalEquipmentPanel({
  siteId,
  returnPath,
}: {
  siteId: string;
  returnPath: string;
}) {
  const { session } = useAuth();
  const query = useHospitalAssets(siteId);
  const [managing, setManaging] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <section className="dark:border-background-dark-secondary dark:bg-background-dark-card mb-3 min-w-0 rounded-xl border bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">장비·부품</h2>
        {session && (
          <details
            ref={menu}
            className="relative"
          >
            <summary
              aria-label="장비·부품 메뉴"
              className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg text-2xl hover:bg-slate-100 dark:hover:bg-white/10 [&::-webkit-details-marker]:hidden"
            >
              ⋮
            </summary>
            <div className="absolute top-12 right-0 z-20 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-600 dark:bg-slate-900">
              <button
                type="button"
                className="min-h-12 w-full rounded-lg px-3 text-left text-base font-bold hover:bg-sky-50 dark:hover:bg-slate-800"
                onClick={() => {
                  if (menu.current) menu.current.open = false;
                  setManaging(true);
                }}
              >
                장비·부품 관리
              </button>
              <p className="px-3 pb-2 text-sm text-slate-500 dark:text-slate-300">
                등록 · 정보 수정 · 변경 이력
              </p>
            </div>
          </details>
        )}
      </div>
      <OfficeAssetsPanel
        siteId={siteId}
        returnPath={returnPath}
        embedded
      />
      {session && query.isError && (
        <button
          className="min-h-11 text-sm text-rose-700 dark:text-rose-300"
          onClick={() => void query.refetch()}
        >
          추가 장비 정보를 불러오지 못했습니다 · 다시 시도
        </button>
      )}
      {session && query.isPending && (
        <p
          role="status"
          className="py-3 text-sm"
        >
          장비 정보 불러오는 중…
        </p>
      )}
      {!!query.data?.assets.length && (
        <div className="mt-3 divide-y divide-slate-200 border-t border-slate-200 dark:divide-white/10 dark:border-white/10">
          {query.data.assets
            .filter((a) => a.status === "ACTIVE")
            .map((a) => (
              <div
                key={a.id}
                className="py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-base">{a.name}</strong>
                  <span className="text-sm text-slate-500 dark:text-slate-300">
                    {assetTypes[a.assetType]}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 break-words text-slate-600 dark:text-slate-300">
                  {[
                    a.model,
                    a.version && `버전 ${a.version}`,
                    a.serialNumber && `S/N ${a.serialNumber}`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "상세 미등록"}
                </p>
              </div>
            ))}
        </div>
      )}
      {managing && (
        <EquipmentDialog
          siteId={siteId}
          onClose={() => setManaging(false)}
        />
      )}
    </section>
  );
}
function EquipmentDialog({
  siteId,
  onClose,
}: {
  siteId: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      data-ptr-ignore
      aria-labelledby="equipment-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="equipment-management-dialog"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-white p-3 dark:border-white/10 dark:bg-slate-900">
        <h2
          id="equipment-dialog-title"
          className="text-lg font-bold"
        >
          장비·부품 관리
        </h2>
        <button
          autoFocus
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-lg px-3 font-bold"
        >
          닫기 ×
        </button>
      </header>
      <HospitalAssets siteId={siteId} />
    </dialog>,
    document.body,
  );
}
