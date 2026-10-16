"use client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/provider/auth-provider";
export type Hospital = { siteDb: string; name: string | null };
export type WorkRecord = {
  id: number;
  authorId: number;
  authorName: string;
  siteId: string | null;
  siteName: string | null;
  kind: "FIELD" | "GENERAL";
  serviceType: string | null;
  title: string;
  body: string;
  workDate: string;
  status: string;
  updatedAt: string;
};
export type WorkSchedule = {
  id: number;
  authorId: number;
  authorName: string;
  siteId: string | null;
  siteName: string | null;
  title: string;
  body: string;
  startAt: string;
  endAt: string;
};
export const serviceLabels: Record<string, string> = {
  REPAIR: "정비",
  PM: "PM",
  ACR: "ACR",
  CALL: "콜",
  INSTALL: "설치",
  ETC: "기타",
};
export const statusLabels: Record<string, string> = {
  COMPLETED: "완료",
  IN_PROGRESS: "진행 중",
  REVISIT: "재방문",
};
export function useWorkspace() {
  const { session } = useAuth();
  const enabled = !!session;
  const scope = session?.id;
  const sites = useQuery({
    queryKey: ["workspace-sites", scope],
    queryFn: () => apiFetch<Hospital[]>("/sites"),
    enabled,
  });
  const records = useQuery({
    queryKey: ["workspace-records", scope],
    queryFn: () => apiFetch<WorkRecord[]>("/workspace/records"),
    enabled,
  });
  const schedules = useQuery({
    queryKey: ["workspace-schedules", scope],
    queryFn: () => apiFetch<WorkSchedule[]>("/workspace/schedules"),
    enabled,
  });
  return { sites, records, schedules };
}
export function dayString(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    date,
  );
}
export function dateLabel(date: string) {
  return new Date(date.slice(0, 10) + "T12:00:00+09:00").toLocaleDateString(
    "ko-KR",
    { month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Seoul" },
  );
}
export function dateTime(value: string) {
  return value.replace(" ", "T");
}
export function errorText(error: unknown) {
  return error instanceof Error ? error.message : "불러오지 못했습니다.";
}
