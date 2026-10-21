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
  revision: number;
  detailsJson?: string | null;
  assetChange?: boolean | number;
  sourceId?: string | null;
  engineerName?: string;
  countsAsPm?: boolean | number;
  acrKind?: string | null;
  scheduleId?: number | null;
  scheduleDate?: string | null;
};
export type WorkSchedule = {
  revision: number;
  targetKind?: "HOSPITAL" | "GENERAL" | null;
  personalKind?: string | null;
  serviceType?: string | null;
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
  PM: "정기점검 (PM)",
  REPAIR: "고장수리",
  COLDHEAD: "Cold Head",
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
export function useWorkspace(
  options: {
    records?: boolean;
    scheduleFrom?: string;
    scheduleTo?: string;
  } = {},
) {
  const { session } = useAuth();
  const enabled = !!session;
  const scope = session?.id;
  const sites = useQuery({
    queryKey: ["workspace-sites", scope],
    queryFn: () => apiFetch<Hospital[]>("/workspace/hospitals"),
    enabled,
  });
  const records = useQuery({
    queryKey: ["workspace-records", scope],
    queryFn: () => apiFetch<WorkRecord[]>("/workspace/records"),
    enabled: enabled && options.records !== false,
  });
  const schedules = useQuery({
    queryKey: [
      "workspace-schedules",
      scope,
      options.scheduleFrom,
      options.scheduleTo,
    ],
    queryFn: () => {
      const p = new URLSearchParams();
      if (options.scheduleFrom) p.set("from", options.scheduleFrom);
      if (options.scheduleTo) p.set("to", options.scheduleTo);
      return apiFetch<WorkSchedule[]>(`/workspace/schedules?${p}`);
    },
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
export type HospitalPlan = {
  siteId: string;
  pmIntervalMonths: number;
  lastPmDate?: string | null;
  lastAcrFullDate?: string | null;
  lastAcrDocDate?: string | null;
  pmOverride: string | null;
  acrFullOverride: string | null;
  acrDocOverride: string | null;
};
export type Preparation = {
  id: number;
  authorId: number;
  siteId: string | null;
  siteName: string | null;
  content: string;
  done: boolean;
};
export function usePlanning() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["workspace-planning", session?.id],
    queryFn: () =>
      apiFetch<{ plans: HospitalPlan[]; preparations: Preparation[] }>(
        "/workspace/planning",
      ),
    enabled: !!session,
  });
}

export function scheduleTimeLabel(startAt: string, endAt: string) {
  const start = dateTime(startAt),
    end = dateTime(endAt);
  const wholeDay =
    start.slice(11, 16) === "00:00" && end.slice(11, 16) === "23:59";
  if (start.slice(0, 10) === end.slice(0, 10))
    return wholeDay ? "종일" : `${start.slice(11, 16)}–${end.slice(11, 16)}`;
  const shortDate = (value: string) =>
    `${Number(value.slice(5, 7))}월 ${Number(value.slice(8, 10))}일`;
  return wholeDay
    ? `${shortDate(start)}–${shortDate(end)} · 종일`
    : `${shortDate(start)} ${start.slice(11, 16)}–${shortDate(end)} ${end.slice(11, 16)}`;
}

export const personalScheduleLabels: Record<string, string> = {
  office: "사무실",
  edu: "교육·세미나",
  leave: "휴가",
  annual: "연차",
  etc: "기타 일정",
};
export function scheduleCategory(s: WorkSchedule) {
  if (s.personalKind)
    return personalScheduleLabels[s.personalKind] || s.personalKind;
  if (s.serviceType) return serviceLabels[s.serviceType] || s.serviceType;
  return "분류 미등록";
}
