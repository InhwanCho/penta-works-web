"use client";
import { useUnreadAlerts } from "@/hooks/use-unread-alerts";
export default function UnreadAlertDot() {
  return <span role="img" aria-label="확인하지 않은 알림 있음" className="relative inline-flex h-2.5 w-2.5 shrink-0">
    <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-60 motion-reduce:animate-none" />
    <span className="relative h-2.5 w-2.5 rounded-full bg-red-500" />
  </span>;
}

export function DeferredUnreadAlertDot() {
  const unread = useUnreadAlerts();
  return unread ? <UnreadAlertDot /> : null;
}
