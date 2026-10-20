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
  const query = useQuery({ queryKey: key, queryFn: () => apiFetch<{ configured: boolean; connected: boolean; status: string; errorCode: string }>("/integrations/google-calendar") });
  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get("googleCalendar");
    if (!result) return;
    setMessage(result === "connected" ? "구글캘린더 연결이 완료되었습니다." : result === "cancelled" ? "연결을 취소했습니다." : calendarErrorMessage(url.searchParams.get("calendarError") || ""));
    section.current?.scrollIntoView({ block: "start" });
  }, []);
  async function connect() {
    setBusy(true); setMessage("");
    try {
      const result = await apiFetch<{ url: string }>("/integrations/google-calendar/connect", { method: "POST" });
      window.location.assign(result.url);
    } catch (e) { setMessage(e instanceof Error ? e.message : "연결하지 못했습니다."); setBusy(false); }
  }
  async function disconnect() {
    if (!window.confirm("구글캘린더 연결을 해제할까요? 구글에 있는 캘린더와 일정은 그대로 남습니다.")) return;
    setBusy(true); setMessage("");
    try { await apiFetch("/integrations/google-calendar", { method: "DELETE" }); await cache.invalidateQueries({ queryKey: key }); setMessage("연결을 해제했습니다."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "연결을 해제하지 못했습니다."); }
    finally { setBusy(false); }
  }
  const storedError = !message && query.data?.errorCode ? calendarErrorMessage(query.data.errorCode) : "";
  return <section ref={section} id="google-calendar" className="work-panel settings-section calendar-connection-section">
    {(message || storedError) && <div className="calendar-connection-result" role="status" aria-live="polite"><strong>{message || storedError}</strong></div>}
    <h2>구글캘린더</h2>
    <p>{query.isPending ? "연결 상태를 불러오는 중…" : query.isError ? "연결 상태를 불러오지 못했습니다." : query.data.connected ? "연결됨" : query.data.status === "RECONNECT_REQUIRED" ? "다시 연결해주세요" : "연결되지 않음"}</p>
    <p>내 구글 계정의 MReyes 전용 캘린더를 연결합니다. 일정 자동 동기화는 아직 제공하지 않습니다.</p>
    {query.isError ? <button type="button" onClick={() => query.refetch()}>다시 불러오기</button> : query.data && <div className="calendar-connection-actions">
      <button type="button" className="work-button" disabled={busy || !query.data.configured} onClick={connect}>{busy ? "처리 중…" : query.data.connected ? "다시 연결" : "구글캘린더 연결"}</button>
      {query.data.connected && <button type="button" className="work-button-secondary" disabled={busy} onClick={disconnect}>연결 해제</button>}
      {!query.data.configured && <small>관리자가 구글캘린더 연결을 준비 중입니다.</small>}
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
