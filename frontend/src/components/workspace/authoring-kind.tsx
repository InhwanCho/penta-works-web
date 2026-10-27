"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ChoiceGroup } from "./choice-group";

export default function AuthoringKind({ value, date, disabled = false, confirmLeave, navigate }: {
  value: "work" | "schedule"; date: string; disabled?: boolean; confirmLeave: () => boolean; navigate: (action: () => void) => void;
}) {
  const router=useRouter();
  useEffect(()=>{
    const query=new URLSearchParams({date});
    if(value==="work")query.set("new","1");
    router.prefetch(`${value==="work"?"/schedule":"/work/new"}?${query}`);
  },[router,value,date]);
  return <div className="work-authoring-kind">
    <ChoiceGroup legend="작성 종류" value={value} disabled={disabled} options={[["work","업무기록"],["schedule","일정"]]} onChange={next=>{
      if(disabled||next===value||!confirmLeave())return;
      const query=new URLSearchParams({date});
      if(next==="schedule")query.set("new","1");
      navigate(() => router.replace(`${next==="schedule"?"/schedule":"/work/new"}?${query}`));
    }} />
  </div>;
}
