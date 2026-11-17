"use client";
import { openWorkspaceOverlay } from "./overlay-navigation";
import { ChoiceGroup } from "./choice-group";

export default function AuthoringKind({ date, disabled = false }: {
  date: string; disabled?: boolean;
}) {
  return <div className="work-authoring-kind">
    <ChoiceGroup legend="작성 종류" value="work" disabled={disabled} options={[["work","업무기록"],["schedule","일정"]]} onChange={next => {
      if (disabled || next !== "schedule") return;
      // Keep the work editor and its unsaved draft mounted beneath the schedule drawer.
      openWorkspaceOverlay(`/schedule?${new URLSearchParams({ date, new: "1" })}`);
    }} />
  </div>;
}
