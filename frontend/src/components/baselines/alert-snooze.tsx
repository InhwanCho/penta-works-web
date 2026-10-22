"use client";

import CircleLoader from "@/components/icons/circle-loader";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";

type Snooze = {
  siteId: string;
  metricKey: string;
  eventType: string;
  until: string;
};
const kstInput = (date: Date) =>
  new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 16);
export default function AlertSnooze({
  event,
}: {
  event: {
    id: number;
    siteId: string;
    metricKey: string;
    eventType: string;
    acknowledgedAt: string | null;
  };
}) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [until, setUntil] = useState(() =>
    kstInput(new Date(Date.now() + 24 * 3600000)),
  );
  const [preset, setPreset] = useState<number | null>(24);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["alert-snoozes", session?.id],
    queryFn: () => apiFetch<Snooze[]>("/alerts/snoozes"),
    enabled: !!session,
    refetchInterval: 30000,
  });
  const active = query.data?.find(
    (s) =>
      s.siteId === event.siteId &&
      s.metricKey === event.metricKey &&
      s.eventType === event.eventType &&
      Date.parse(s.until) > Date.now(),
  );
  async function save(value: string | null) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const instant = value ? new Date(value + ":00+09:00") : null;
      if (
        instant &&
        (!Number.isFinite(instant.getTime()) ||
          instant.getTime() <= Date.now() ||
          instant.getTime() > Date.now() + 7 * 86400000)
      )
        throw new Error("현재 이후부터 7일 이내의 시간을 선택해주세요.");
      await apiFetch(`/alerts/events/${event.id}/snooze`, {
        method: "PATCH",
        body: JSON.stringify({ until: instant?.toISOString() ?? null }),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["alert-snoozes"] }),
        qc.invalidateQueries({ queryKey: ["alert-events"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      setOpen(false);
      setMessage(
        value
          ? "지정한 시간까지 동일 알림을 받지 않습니다."
          : "일시 중지를 해제했습니다.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  const button =
    "min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold disabled:opacity-50 dark:border-white/20";
  return (
    <div className="alert-pause mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4 dark:border-slate-700 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={button}
          disabled={query.isPending || query.isError || busy}
          aria-expanded={open}
          onClick={() => {
            if (!open) {
              setUntil(active ? kstInput(new Date(active.until)) : kstInput(new Date(Date.now() + 24 * 3600000)));
              setPreset(active ? null : 24);
            }
            setOpen(!open);
          }}
        >
          {active
            ? `${new Date(active.until).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}까지 중지 · 변경`
            : "알림 중지 시간 설정"}
        </button>
        {active && (
          <button
            type="button"
            className={button}
            disabled={busy}
            onClick={() => void save(null)}
          >
            알림 받기 재개
          </button>
        )}
        {query.isError && (
          <button
            type="button"
            className={button}
            onClick={() => void query.refetch()}
          >
            중지 상태 조회 실패 · 다시 시도
          </button>
        )}
      </div>
      {open && (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save(until);
          }}
        >
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            같은 병원·항목·유형의 알림만 중지합니다. 설정한 시간이 지나면 자동으로 다시 받습니다.
          </p>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">얼마 동안 중지할까요?</legend>
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 6, 24].map((hours) => (
                <label key={hours} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-1 text-sm font-semibold ${preset === hours ? "border-sky-700 bg-sky-100 text-sky-900 dark:border-sky-400 dark:bg-sky-900 dark:text-sky-100" : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"}`}>
                  <input type="radio" name={`pause-${event.id}`} checked={preset === hours} disabled={busy} className="sr-only" onChange={() => {
                    setPreset(hours);
                    setUntil(kstInput(new Date(Date.now() + hours * 3600000)));
                  }} />
                  {hours}시간
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="mb-2 text-sm font-semibold">다시 받을 날짜·시간 <span className="font-normal text-slate-500 dark:text-slate-400">(한국 시간)</span></legend>
            <div className="grid min-w-0 grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-2">
              <label className="min-w-0 text-sm text-slate-600 dark:text-slate-300">날짜
                <input required disabled={busy} type="date" value={until.slice(0, 10)} min={kstInput(new Date()).slice(0, 10)} max={kstInput(new Date(Date.now() + 7 * 86400000)).slice(0, 10)}
                  onChange={(e) => { setPreset(null); setUntil(`${e.target.value}T${until.slice(11) || "09:00"}`); }} className="alert-pause-input mt-1" />
              </label>
              <label className="min-w-0 text-sm text-slate-600 dark:text-slate-300">시간
                <input required disabled={busy} type="time" value={until.slice(11)}
                  onChange={(e) => { setPreset(null); setUntil(`${until.slice(0, 10)}T${e.target.value}`); }} className="alert-pause-input mt-1" />
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">최대 7일까지 중지할 수 있습니다.</p>
          </fieldset>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <button
              type="submit"
              disabled={busy}
              className="min-h-12 rounded-xl bg-sky-700 px-4 font-bold text-white disabled:opacity-50"
            >
              {busy ? <CircleLoader size="xs" /> : "알림 중지 적용"}
            </button>
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              취소
            </button>
          </div>
        </form>
      )}
      {message && (
        <p
          role="status"
          className="mt-2 text-sm"
        >
          {message}
        </p>
      )}
    </div>
  );
}
