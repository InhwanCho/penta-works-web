import { initialDetails, type WorkDetails } from "./service-form-model";

export function hasMeaningfulWorkDraft(value: { form?: { title?: string; body?: string }; details?: WorkDetails; photoIds?: number[] | null }) {
  if (value.form?.title?.trim() || value.form?.body?.trim() || value.photoIds?.length) return true;
  const d = value.details;
  if (!d) return false;
  if ([d.symptom,d.parts,d.followUp,d.prepItems,d.heLevel,d.coldheadSerial,d.coldheadInDate,d.startTime,d.endTime].some(text => text?.trim())) return true;
  const defaults = initialDetails();
  if (d.pm?.some((item,index) => item.result || item.comment?.trim() || item.fields.some((field,fi) => field.value.trim() !== (defaults.pm[index]?.fields[fi]?.value || "")))) return true;
  if (Object.values(d.acr || {}).some(fields => Object.values(fields).some(text => text?.trim()))) return true;
  if (Object.values(d.acrVerdicts || {}).some(Boolean) || d.acrOverall) return true;
  return Object.entries(d.acrPulse || {}).some(([row,fields]) => fields.some((text,index) => text !== defaults.acrPulse[row]?.[index]));
}
