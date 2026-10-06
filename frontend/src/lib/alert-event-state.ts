import type { AlertEventSummary } from "@/lib/api";

export type AlertEventFilter = "all" | "open" | "unacknowledged" | "failed" | "skipped";
export const DEFAULT_ALERT_EVENT_FILTER: AlertEventFilter = "unacknowledged";
type EventState = Pick<AlertEventSummary, "eventType" | "acknowledgedAt" | "recoveredAt" | "deliveryStatus">;

export function needsAcknowledgement(event: EventState) {
  return event.eventType !== "RECOVERY" && !event.acknowledgedAt;
}

export function matchesAlertEventFilter(event: EventState, filter: AlertEventFilter) {
  if (event.eventType === "RECOVERY") return false;
  switch (filter) {
    case "all": return true;
    case "open": return !event.recoveredAt;
    case "unacknowledged": return needsAcknowledgement(event);
    case "failed": return ["FAILED", "PARTIAL", "UNKNOWN"].includes(event.deliveryStatus);
    case "skipped": return event.deliveryStatus === "SKIPPED";
  }
}
