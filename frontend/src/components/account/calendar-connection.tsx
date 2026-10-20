"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export default function CalendarConnection({ userId }: { userId: number }) {
  const cache = useQueryClient();
  const section = useRef<HTMLElement>(null);
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
      const result = await apiFetch<{ url: string }>("/integrations/google-calendar/connect", { method: "POST" });
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
        <small role="status">{query.isPending ? "불러오는 중…" : query.isError ? "상태 확인 실패" : query.data.connected ? "연동완료" : query.data.status === "RECONNECT_REQUIRED" ? "재연동 필요" : "연동 안 됨"}</small>
      </span>
      <div className="calendar-settings-actions">
        {query.isError ? <button type="button" onClick={() => query.refetch()}>다시 확인</button> : query.data && (
          query.data.connected
            ? <><button type="button" disabled={busy} onClick={syncNow}>{busy ? "처리 중…" : "지금 반영"}</button><button type="button" disabled={busy} onClick={disconnect}>해제</button></>
            : <button type="button" disabled={busy || !query.data.configured} onClick={connect}>{busy ? "처리 중…" : query.data.status === "RECONNECT_REQUIRED" ? "다시 연동" : "연동하기"}</button>
        )}
      </div>
    </div>
    <p className="calendar-settings-note">{query.data && !query.data.configured ? "연동 기능을 준비 중입니다." : query.data?.connected ? query.data.syncError ? "일정 전송에 실패했습니다. 다시 반영하거나 재연동해주세요." : query.data.lastSyncedAt ? `${query.data.syncedEventCount}개 일정 반영 · ${query.data.lastSyncedAt.slice(0, 16)} · 1분마다 갱신` : "첫 일정 전송을 기다리는 중입니다. 1분 안에 반영됩니다." : "업무기록·일정·점검 예정을 내 구글캘린더에 자동 반영합니다."}</p>

  </section>;
}

function calendarErrorMessage(code: string) {
  if (code === "accessNotConfigured") return "연결하지 못했습니다. Google Cloud의 MReyes 프로젝트에서 Google Calendar API를 사용 설정한 뒤 다시 연결해주세요.";
  if (code === "insufficientPermissions" || code === "forbidden" || code === "calendar_http_403") return "캘린더 접근 권한이 부족합니다. 다시 연결하여 캘린더 권한을 허용해주세요.";
  if (code === "invalid_state") return "인증 요청이 만료되었거나 인증 쿠키를 확인하지 못했습니다. 연결을 시작한 동일한 브라우저에서 다시 시도해주세요.";
  if (code.startsWith("token_") || code === "missing_token") return "구글 인증 정보를 받지 못했습니다. 다시 연결해주세요. 반복되면 관리자에게 문의해주세요.";
  return "구글캘린더 연결에 실패했습니다. 다시 시도해주세요. 반복되면 관리자에게 문의해주세요.";
}
