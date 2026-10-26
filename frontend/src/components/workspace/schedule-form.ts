import type { WorkSchedule } from "./workspace-data";
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
  return ["title","body"].some(key => {
    const field = key as "title" | "body";
    return form[field].trim() !== old[field].trim() && Math.max(form[field].trim().length, old[field].trim().length) >= 3;
  });
}

export function normalizeScheduleForm(value: Partial<ScheduleForm> & {startAt?: string; endAt?: string}, fallbackDate: string): ScheduleForm {
  if (value.date) return {...newScheduleForm(value.date),...value};
  if (value.startAt && value.endAt) return scheduleEditForm({targetKind:value.targetKind === "HOSPITAL" ? "HOSPITAL" : "GENERAL",siteId:value.siteId || null,personalKind:value.personalKind,serviceType:value.serviceType,title:value.title || "",body:value.body || "",startAt:value.startAt,endAt:value.endAt});
  return {...newScheduleForm(fallbackDate),...value};
}
