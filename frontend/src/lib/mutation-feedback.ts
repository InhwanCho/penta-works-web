export function mutationSuccessMessage(path: string, options: RequestInit, result: unknown): string | null {
  const method = (options.method ?? "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return null;
  if (!path.startsWith("/alerts/") && !path.startsWith("/admin/") && !path.startsWith("/platform/") &&
      !path.startsWith("/company/") && !["/auth/profile", "/auth/change-password"].includes(path)) return null;
  let body: Record<string, unknown> = {};
  if (typeof options.body === "string") {
    try { body = JSON.parse(options.body) ?? {}; } catch { /* Non-JSON payload. */ }
  }
  const saved = result && typeof result === "object" ? result as Record<string, unknown> : {};
  if (/\/invitations?(\/resend)?$|\/password-reset$/.test(path)) {
    if (method === "DELETE") return "초대를 취소했습니다.";
    if (saved.deliveryStatus === "FAILED") return "메일 발송에 실패해 수동 링크를 생성했습니다.";
    if (saved.deliveryStatus === "DISABLED") return "메일 발송이 비활성화되어 수동 링크를 생성했습니다.";
    return path.endsWith("/password-reset") ? "비밀번호 재설정 이메일을 발송했습니다." : "초대 이메일을 발송했습니다.";
  }
  if (/\/invitations\/[^/]+$/.test(path) && method === "DELETE") return "초대를 취소했습니다.";
  if (/\/invitations\/[^/]+\/resend$/.test(path)) {
    return saved.deliveryStatus === "SENT" ? "초대 이메일을 다시 발송했습니다." : "새 수동 초대 링크를 생성했습니다.";
  }
  if (path.startsWith("/alerts/policy/")) return (saved.alertsEnabled ?? body.enabled) ? "알림이 켜졌습니다." : "알림이 꺼졌습니다.";
  if (path.endsWith("/visibility")) return body.visible ? "대시보드에 병원이 표시됩니다." : "대시보드에서 병원을 숨겼습니다.";
  if (path.endsWith("/restore-company")) return "초기 알림 기준을 복원했습니다.";
  if (path.startsWith("/alerts/thresholds/") || path.startsWith("/alerts/psi-thresholds/")) return "알림 설정을 저장했습니다.";
  if (path === "/alerts/company-thresholds") return "회사 알림 기준을 저장했습니다.";
  if (path.startsWith("/alerts/recipients")) return method === "DELETE" ? "수신처를 삭제했습니다." : method === "POST" ? "수신처를 등록했습니다." : "수신처를 변경했습니다.";
  if (path.endsWith("/share")) return "알림 패턴을 공유했습니다.";
  if (path.endsWith("/apply")) return "공유받은 알림 패턴을 적용했습니다.";
  if (path.endsWith("/acknowledge")) return "알림을 확인완료 처리했습니다.";
  if (path.endsWith("/retry")) return "알림 재전송 요청을 처리했습니다.";
  if (/\/deliveries\/[^/]+$/.test(path)) return body.received ? "수신 확인을 저장했습니다." : "미수신 확인을 저장했습니다.";
  if (path === "/company/metrics") return "측정항목 표시 설정을 저장했습니다.";
  if (path === "/auth/profile") return "휴대폰번호를 변경했습니다.";
  if (path === "/auth/change-password") return "비밀번호를 변경했습니다. 다시 로그인해주세요.";
  if (path.endsWith("/assignment")) return "병원의 소속 회사를 변경했습니다.";
  if (path.endsWith("/status")) return body.status === "ACTIVE" ? "회사를 활성화했습니다." : "회사를 중지했습니다.";
  if (path.endsWith("/business-registration/verify")) return "사업자등록증을 확인 처리했습니다.";
  if (path.endsWith("/business-registration")) return "사업자등록증을 저장했습니다.";
  if (method === "DELETE") return "삭제했습니다.";
  if (method === "POST") return "등록했습니다.";
  return "설정을 저장했습니다.";
}
