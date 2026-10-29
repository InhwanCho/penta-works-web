"use client";

import CircleLoader from "@/components/icons/circle-loader";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "@/components/common/app-link";
import { apiFetch } from "@/lib/api";

export default function CalendarConnection({ userId }: { userId: number }) {
  const cache = useQueryClient();
  const section = useRef<HTMLElement>(null);
  const [showNotice, setShowNotice] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const key = ["google-calendar-connection", userId];
  const query = useQuery({ queryKey: key, queryFn: () => apiFetch<{ configured: boolean; connected: boolean; status: string; errorCode: string; syncError: string; lastSyncedAt: string; syncedEventCount: number }>("/integrations/google-calendar") });
  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get("googleCalendar");
    if (!result) return;
    setMessage(result === "connected" ? "" : result === "cancelled" ? "연결을 취소했습니다." : calendarErrorMessage(url.searchParams.get("calendarError") || ""));
    section.current?.scrollIntoView({ block: "start" });
  }, []);
  function clearCallbackResult() {
    const url = new URL(window.location.href);
    url.searchParams.delete("googleCalendar");
    url.searchParams.delete("calendarError");
    window.history.replaceState(window.history.state, "", url.toString());
  }
  async function connect() {
    clearCallbackResult();
    setBusy(true); setMessage("");
    try {
      const result = await apiFetch<{ url: string }>("/integrations/google-calendar/connect", { method: "POST", body: JSON.stringify({ understood, noticeVersion: "2026-10-21-v1" }) });
      window.location.assign(result.url);
    } catch (e) { setMessage(e instanceof Error ? e.message : "연결하지 못했습니다."); setBusy(false); }
  }
  async function disconnect() {
    if (!window.confirm("구글캘린더 연결을 해제할까요? 구글에 있는 캘린더와 일정은 그대로 남습니다.")) return;
    clearCallbackResult();
    setBusy(true); setMessage("");
    try { await apiFetch("/integrations/google-calendar", { method: "DELETE" }); await cache.invalidateQueries({ queryKey: key }); setMessage("연동을 해제했습니다."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "연결을 해제하지 못했습니다."); }
    finally { setBusy(false); }
  }
  async function syncNow() {
    setBusy(true);setMessage("");
    try { await apiFetch("/integrations/google-calendar/sync", { method: "POST" }); await cache.invalidateQueries({ queryKey: key }); setMessage("일정을 구글캘린더에 반영했습니다."); }
    catch(e) { setMessage(e instanceof Error ? e.message : "일정을 전송하지 못했습니다."); await cache.invalidateQueries({ queryKey: key }); }
    finally { setBusy(false); }
  }
  const storedError = !message && query.data?.errorCode ? calendarErrorMessage(query.data.errorCode) : "";
  return <section ref={section} id="google-calendar" className="work-panel settings-section calendar-connection-section">
    {(message || storedError) && <div className="calendar-connection-result" role="status" aria-live="polite"><strong>{message || storedError}</strong></div>}
    <h2>외부 연동</h2>
    <div className="settings-link calendar-settings-row">
      <span>
        <strong>구글캘린더</strong>
        <small role="status">{query.isPending ? <CircleLoader size="xs" inline /> : query.isError ? "상태 확인 실패" : query.data.connected ? "연동완료" : query.data.status === "RECONNECT_REQUIRED" ? "재연동 필요" : "연동 안 됨"}</small>
      </span>
      <div className="calendar-settings-actions">
        {query.isError ? <button type="button" onClick={() => query.refetch()}>다시 확인</button> : query.data && (
          query.data.connected
            ? <><button type="button" disabled={busy} onClick={syncNow}>{busy ? <CircleLoader size="xs" inline /> : "지금 반영"}</button><button type="button" disabled={busy} onClick={disconnect}>해제</button></>
            : <button type="button" disabled={busy || !query.data.configured} onClick={() => { setUnderstood(false); setShowNotice(true); }}>{busy ? <CircleLoader size="xs" inline /> : query.data.status === "RECONNECT_REQUIRED" ? "다시 연동" : "연동하기"}</button>
        )}
      </div>
    </div>
    <p className="calendar-settings-note">{query.data && !query.data.configured ? "연동 기능을 준비 중입니다." : query.data?.connected ? query.data.syncError ? "일정 전송에 실패했습니다. 다시 반영하거나 재연동해주세요." : query.data.lastSyncedAt ? `${query.data.syncedEventCount}개 일정 반영 · ${query.data.lastSyncedAt.slice(0, 16)} · 변경 시 자동 반영 · 10분마다 재확인` : <CircleLoader size="xs" inline /> : "업무기록·일정·점검 예정을 내 구글캘린더에 자동 반영합니다."}</p>
    {showNotice && <div className="mt-4 rounded-xl border border-slate-300 p-4 dark:border-slate-600">
      <h3 className="font-bold">Google로 보낼 정보를 확인해주세요</h3>
      <p className="mt-2 text-sm leading-6">접근 가능한 업무기록·일정·점검 기한의 제목, 날짜, 내용, 병원명과 관련 링크가 전용 캘린더에 반영됩니다. 내용에 적힌 다른 직원의 이름도 포함될 수 있으므로 회사에서 공유할 수 있는 정보인지 확인해주세요.</p>
      <p className="mt-2 text-sm leading-6">Google LLC가 해외 서버에서 처리할 수 있으며 계정별 저장 국가는 지정되지 않습니다. 연결하지 않아도 다른 기능은 이용할 수 있습니다. 해제하면 추가 전송은 중단되지만 이미 보낸 일정은 Google Calendar에서 직접 삭제해야 합니다.</p>
      <Link href="/privacy" className="mt-2 inline-flex min-h-11 items-center text-sm font-bold underline">개인정보 처리방침 보기</Link>
      <label className="mt-2 flex min-h-11 items-start gap-2 text-sm leading-6"><input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" />전송 범위와 연결 해제 방법을 확인했습니다.</label>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!understood || busy} onClick={connect} className="work-primary min-h-11 rounded-lg bg-sky-700 px-4 text-sm font-bold text-white disabled:opacity-40">Google에서 연결 계속</button><button type="button" disabled={busy} onClick={() => setShowNotice(false)} className="action-cancel min-h-11 rounded-lg border px-4 text-sm">취소</button></div>
    </div>}
  </section>;
}

function calendarErrorMessage(code: string) {
  if (code === "accessNotConfigured") return "연결하지 못했습니다. Google Cloud의 MReyes 프로젝트에서 Google Calendar API를 사용 설정한 뒤 다시 연결해주세요.";
  if (code === "insufficientPermissions" || code === "forbidden" || code === "calendar_http_403") return "캘린더 접근 권한이 부족합니다. 다시 연결하여 캘린더 권한을 허용해주세요.";
  if (code === "invalid_state") return "인증 요청이 만료되었거나 인증 쿠키를 확인하지 못했습니다. 연결을 시작한 동일한 브라우저에서 다시 시도해주세요.";
  if (code.startsWith("token_") || code === "missing_token") return "구글 인증 정보를 받지 못했습니다. 다시 연결해주세요. 반복되면 관리자에게 문의해주세요.";
  return "구글캘린더 연결에 실패했습니다. 다시 시도해주세요. 반복되면 관리자에게 문의해주세요.";
}
