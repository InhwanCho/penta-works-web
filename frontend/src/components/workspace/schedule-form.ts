import type { WorkSchedule } from "./workspace-data";
import { changedTextSize, MIN_DRAFT_TEXT } from "./draft-content";
export function scheduleEditForm(s: Pick<WorkSchedule, "targetKind" | "siteId" | "personalKind" | "serviceType" | "title" | "body" | "startAt" | "endAt">) {
  return {
    targetKind: s.targetKind || (s.siteId ? "HOSPITAL" : "GENERAL"), personalKind: s.personalKind || "etc", serviceType: s.serviceType || "ETC",
    title: s.title, siteId: s.siteId || "", body: s.body || "",
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
  const startAt = `${form.date}T${form.allDay ? "00:00" : form.startTime}`;
  return {startAt, endAt: form.allDay ? `${form.endDate || form.date}T23:59` : form.endTime ? `${form.endDate || form.date}T${form.endTime}` : startAt};
}
export function substantialScheduleChange(form: ScheduleForm, previous?: WorkSchedule | null) {
  const old = previous ? scheduleEditForm(previous) : newScheduleForm(form.date);
  return changedTextSize(form.title,old.title)+changedTextSize(form.body,old.body)>=MIN_DRAFT_TEXT;
}

export function normalizeScheduleForm(value: Partial<ScheduleForm> & {startAt?: string; endAt?: string}, fallbackDate: string): ScheduleForm {
  if (value.date) return {...newScheduleForm(value.date),...value};
  if (value.startAt && value.endAt) return scheduleEditForm({targetKind:value.targetKind === "HOSPITAL" ? "HOSPITAL" : "GENERAL",siteId:value.siteId || null,personalKind:value.personalKind,serviceType:value.serviceType,title:value.title || "",body:value.body || "",startAt:value.startAt,endAt:value.endAt});
  return {...newScheduleForm(fallbackDate),...value};
}

/** Move a scheduled visit while preserving its clock times and multi-day duration. */
export function moveScheduleDate(schedule: Pick<WorkSchedule,"startAt" | "endAt">, date: string) {
  const days = Math.round((Date.parse(date+"T00:00:00Z")-Date.parse(schedule.startAt.slice(0,10)+"T00:00:00Z"))/86400000);
  const end=new Date(schedule.endAt.slice(0,10)+"T00:00:00Z");end.setUTCDate(end.getUTCDate()+days);
  return { startAt: date+schedule.startAt.slice(10), endAt: end.toISOString().slice(0,10)+schedule.endAt.slice(10) };
}
