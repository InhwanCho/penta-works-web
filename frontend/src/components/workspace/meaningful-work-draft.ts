import { initialDetails, type WorkDetails } from "./service-form-model";
import { changedTextSize, MIN_DRAFT_TEXT } from "./draft-content";

type DraftContent = { form?: { title?: string; body?: string }; details?: WorkDetails; photoIds?: number[] | null };
export function hasMeaningfulWorkDraft(value: DraftContent, previous?: DraftContent) {
  const photos=value.photoIds||[], oldPhotos=previous?.photoIds||[];
  if(photos.some(id=>!oldPhotos.includes(id))||oldPhotos.some(id=>!photos.includes(id)))return true;
  let text=changedTextSize(value.form?.title,previous?.form?.title)+changedTextSize(value.form?.body,previous?.form?.body);
  const d = value.details;
  if (!d) return text>=MIN_DRAFT_TEXT;
  const old=previous?.details||initialDetails();
  for(const key of ["symptom","parts","followUp","prepItems","coldheadSerial"] as const)text+=changedTextSize(d[key],old[key]);
  let measurements=changedTextSize(d.heLevel,old.heLevel)>0?1:0;
  d.pm?.forEach((item,index)=>{
    const before=old.pm?.[index];
    if(item.result!==(before?.result||""))measurements++;
    text+=changedTextSize(item.comment,before?.comment);
    item.fields.forEach((field,fi)=>{if(changedTextSize(field.value,before?.fields[fi]?.value)>0)measurements++;});
  });
  for(const [section,fields] of Object.entries(d.acr||{}))for(const [key,value] of Object.entries(fields))if(changedTextSize(value,old.acr?.[section]?.[key])>0)measurements++;
  for(const [row,fields] of Object.entries(d.acrPulse||{}))fields.forEach((value,index)=>{if(changedTextSize(value,old.acrPulse?.[row]?.[index])>0)measurements++;});
  // Preset metadata and automatically computed verdicts are not deliberate input.
  return text>=MIN_DRAFT_TEXT||measurements>=3;
}
