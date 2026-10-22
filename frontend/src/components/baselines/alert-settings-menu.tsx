"use client";
import Link from "@/components/common/app-link";

export default function AlertSettingsMenu({
  canManageHospital,
  onSelect,
}: {
  canManageHospital: boolean;
  onSelect: (view: "thresholds" | "sites") => void;
}) {
  const card =
    "flex min-h-24 w-full items-center gap-3 lg:min-h-28 lg:gap-4 rounded-2xl border border-slate-200 bg-white p-3 text-left lg:p-5 shadow-sm transition hover:border-sky-500 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:border-slate-600 dark:bg-background-dark-card dark:hover:border-sky-400 dark:hover:bg-sky-950/30";
  return (
    <section
      aria-labelledby="alert-settings-menu-title"
      className="space-y-3"
    >
      <div className="mb-4">
        <h2
          id="alert-settings-menu-title"
          className="text-xl font-extrabold"
        >
          어떤 설정을 바꾸시겠어요?
        </h2>
        <p className="text-text-secondary mt-2 hidden text-base leading-7 lg:block">
          아래에서 원하는 항목을 선택하세요.
        </p>
      </div>
      <button
        type="button"
        className={card}
        onClick={() => onSelect("thresholds")}
      >
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-2xl font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-200"
        >
          ≷
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-base font-bold lg:text-lg">
            병원별 알림 기준
          </strong>
          <span className="text-text-secondary mt-1 hidden text-base leading-7 lg:block">
            온도·압력이 얼마일 때 알릴지, 데이터가 안 들어오면 알릴지 정해요.
          </span>
          <span className="mt-2 block text-sm font-semibold text-sky-700 dark:text-sky-300">
            온도·압력·데이터 누락 기준
          </span>
        </span>
        <span
          aria-hidden="true"
          className="text-2xl"
        >
          ›
        </span>
      </button>
      <Link
        href="/notification-settings?from=baselines"
        className={card}
      >
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-2xl text-violet-800 dark:bg-violet-950 dark:text-violet-200"
        >
          ◷
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-base font-bold lg:text-lg">
            알림 받는 시간·반복
          </strong>
          <span className="text-text-secondary mt-1 hidden text-base leading-7 lg:block">
            밤이나 주말에는 받지 않기, 같은 알림을 몇 분마다 받을지 정해요.
          </span>
          <span className="mt-2 block text-sm font-semibold text-violet-700 dark:text-violet-300">
            야간·주말 제외, 반복 간격
          </span>
        </span>
        <span
          aria-hidden="true"
          className="text-2xl"
        >
          ›
        </span>
      </Link>
      {canManageHospital && (
        <button
          type="button"
          className={card}
          onClick={() => onSelect("sites")}
        >
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            ＋
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-base font-bold lg:text-lg">
              병원 운영시간·표시
            </strong>
            <span className="text-text-secondary mt-1 hidden text-base leading-7 lg:block">
              병원 운영시간과 장비 냉각 방식, 화면 표시와 알림 켜기·끄기를
              관리해요.
            </span>
            <span className="mt-2 block text-sm font-semibold text-slate-600 dark:text-slate-300">
              관리자용 · 운영시간, 화면 표시
            </span>
          </span>
          <span
            aria-hidden="true"
            className="text-2xl"
          >
            ›
          </span>
        </button>
      )}
      <p className="text-text-secondary hidden px-1 pt-2 text-sm leading-6 lg:block">
        특정 알림만 잠깐 쉬려면 ‘도착한 알림’에서 ‘동일 알림 잠시 받지 않기’를
        눌러주세요.
      </p>
    </section>
  );
}
