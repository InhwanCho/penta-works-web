"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChoiceGroup } from "./choice-group";
import WorkspaceDrawer from "./workspace-drawer";

export default function WorkspaceCreate({ date: initialDate, onClose }: { date: string; onClose: () => void }) {
  const [kind,setKind]=useState("work"),[date,setDate]=useState(initialDate);
  const router=useRouter();
  function submit(event:FormEvent) {
    event.preventDefault();
    if(!date)return;
    const query=new URLSearchParams({date});
    if(kind==="schedule")query.set("new","1");
    onClose();
    router.push(`${kind==="work"?"/work/new":"/schedule"}?${query}`);
  }
  return <WorkspaceDrawer title="새로 작성" onClose={onClose} className="workspace-create-drawer">
    <form className="workspace-create-form" onSubmit={submit}>
      <ChoiceGroup legend="작성할 내용" value={kind} onChange={setKind} options={[["work","업무기록"],["schedule","일정"]]} />
      <label>날짜<input className="work-input" type="date" value={date} required onChange={event=>setDate(event.target.value)} /></label>
      <button className="work-primary" type="submit" disabled={!date}>{kind==="work"?"업무기록 작성":"일정 등록"}</button>
    </form>
  </WorkspaceDrawer>;
}
