"use client";
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
    kstInput(new Date(Date.now() + 3600000)),
  );
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
      await qc.invalidateQueries({ queryKey: ["alert-snoozes"] });
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
    <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={button}
          disabled={query.isPending || query.isError || busy}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {active
            ? `${new Date(active.until).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}까지 중지 · 변경`
            : "동일 알림 잠시 받지 않기"}
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
            나에게 오는 같은 병원·항목·유형의 알림만 중지합니다. 다른 알림과
            문제 기록은 유지되며, 시간이 지나면 기존 수신 설정에 따라 자동
            재개됩니다. 이미 발송 중인 알림은 도착할 수 있습니다.
          </p>
          {event.acknowledgedAt && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              이미 확인한 현재 알림의 반복 전송은 재개되지 않습니다. 같은
              유형으로 새로 발생하는 알림에 적용됩니다.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {[1, 3, 6, 24].map((hours) => (
              <button
                type="button"
                key={hours}
                className={button}
                disabled={busy}
                onClick={() =>
                  setUntil(kstInput(new Date(Date.now() + hours * 3600000)))
                }
              >
                {hours}시간
              </button>
            ))}
          </div>
          <label className="block text-sm font-semibold">
            다시 받을 날짜·시간 (한국 시간)
            <input
              required
              type="datetime-local"
              value={until}
              min={kstInput(new Date())}
              max={kstInput(new Date(Date.now() + 7 * 86400000))}
              onChange={(e) => setUntil(e.target.value)}
              className="mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 dark:border-white/20 dark:bg-slate-900"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="min-h-12 rounded-xl bg-sky-700 px-4 font-bold text-white disabled:opacity-50"
            >
              {busy ? "저장 중…" : "이 시간까지 받지 않기"}
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
