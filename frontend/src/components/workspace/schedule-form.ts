import type { WorkSchedule } from "./workspace-data";
import { changedTextSize, MIN_DRAFT_TEXT } from "./draft-content";
export function scheduleEditForm(s: Pick<WorkSchedule, "targetKind" | "siteId" | "personalKind" | "serviceType" | "title" | "body" | "startAt" | "endAt">) {
  return {
    targetKind: s.targetKind || (s.siteId ? "HOSPITAL" : "GENERAL"), personalKind: s.personalKind === "annual" ? "leave" : s.personalKind || "etc", serviceType: s.serviceType === "ACR" ? (s.title.includes("정밀") ? "ACR_FULL" : "ACR_DOC") : s.serviceType || "ETC",
    title: s.title, siteId: s.siteId || "", body: s.body?.trim() ? s.body : s.title,
    date: s.startAt.slice(0,10), endDate: s.endAt.slice(0,10),
    allDay: s.startAt.slice(11,16) === "00:00" && s.endAt.slice(11,16) === "23:59",
    startTime: s.startAt.slice(11,16), endTime: s.startAt.slice(0,16) === s.endAt.slice(0,16) ? "" : s.endAt.slice(11,16),
  };
}
export function newScheduleForm(date: string) {
  return { targetKind:"GENERAL",personalKind:"etc",serviceType:"ETC",title:"",siteId:"",body:"",date,endDate:date,allDay:true,startTime:"09:00",endTime:"" };
}
export type ScheduleForm = ReturnType<typeof newScheduleForm>;
export function scheduleTimes(form: ScheduleForm) {
  const endDate = form.targetKind === "GENERAL" && form.personalKind === "leave" ? form.endDate || form.date : form.date;
  return {startAt:`${form.date}T00:00`,endAt:`${endDate}T23:59`};
}
export function substantialScheduleChange(form: ScheduleForm, previous?: WorkSchedule | null) {
  const old = previous ? scheduleEditForm(previous) : newScheduleForm(form.date);
  return changedTextSize(form.body.trim() ? form.body : form.title,old.body.trim() ? old.body : old.title)>=MIN_DRAFT_TEXT;
}

export function normalizeScheduleForm(value: Partial<ScheduleForm> & {startAt?: string; endAt?: string}, fallbackDate: string): ScheduleForm {
  if (value.date) return {...newScheduleForm(value.date),...value,personalKind:value.personalKind === "annual" ? "leave" : value.personalKind || "etc",body:value.body?.trim() ? value.body : value.title || ""};
  if (value.startAt && value.endAt) return scheduleEditForm({targetKind:value.targetKind === "HOSPITAL" ? "HOSPITAL" : "GENERAL",siteId:value.siteId || null,personalKind:value.personalKind,serviceType:value.serviceType,title:value.title || "",body:value.body || "",startAt:value.startAt,endAt:value.endAt});
  return {...newScheduleForm(fallbackDate),...value};
}

/** Move a scheduled visit while preserving its clock times and multi-day duration. */
export function moveScheduleDate(schedule: Pick<WorkSchedule,"startAt" | "endAt">, date: string) {
  const days = Math.round((Date.parse(date+"T00:00:00Z")-Date.parse(schedule.startAt.slice(0,10)+"T00:00:00Z"))/86400000);
  const end=new Date(schedule.endAt.slice(0,10)+"T00:00:00Z");end.setUTCDate(end.getUTCDate()+days);
  return { startAt: date+schedule.startAt.slice(10), endAt: end.toISOString().slice(0,10)+schedule.endAt.slice(10) };
}

/** Storage/search title is derived from the memo; users write only one field. */
export function scheduleMemoTitle(body: string, serviceType = "") {
 const first = body.trim().split(/\r?\n/).find(line => line.trim())?.trim() || "";
 const prefix = serviceType === "ACR_FULL" ? "ACR 정밀 · " : serviceType === "ACR_DOC" ? "ACR 서류 · " : "";
 return (prefix + first).slice(0, 200);
}
