/** Count actual inserted/deleted characters, rather than the size of an existing document. */
export function changedTextSize(value: unknown, previous: unknown = "") {
  const text=(input:unknown)=>typeof input==="string"||typeof input==="number"?String(input).trim():"";
  const a=text(value), b=text(previous);
  let start=0,endA=a.length,endB=b.length;
  while(start<endA&&start<endB&&a[start]===b[start])start++;
  while(endA>start&&endB>start&&a[endA-1]===b[endB-1]){endA--;endB--;}
  return Math.max(a.slice(start,endA).replace(/\s/g,"").length,b.slice(start,endB).replace(/\s/g,"").length);
}
export const MIN_DRAFT_TEXT = 12;
