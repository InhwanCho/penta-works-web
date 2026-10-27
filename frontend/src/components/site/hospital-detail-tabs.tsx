"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

const MANAGEMENT_ANCHORS = new Set(["#hospital-info", "#hospital-alert-summary", "#hospital-equipment", "#inspection-plan", "#hospital-history"]);
type Tab = "measurements" | "management";

export default function HospitalDetailTabs({ monitoringConnected, management, children }: {
  monitoringConnected: boolean;
  management: ReactNode;
  children: ReactNode;
}) {
  const [active, setActive] = useState<Tab>("measurements");
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  useLayoutEffect(() => {
    // Inspection links must reveal the management panel before its section opens.
    const reveal = () => { if (MANAGEMENT_ANCHORS.has(window.location.hash)) setActive("management"); };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  if (!monitoringConnected) return <>{management}</>;
  const tabs = [{ key: "measurements", label: "측정값" }, { key: "management", label: "병원 정보·관리" }] as const;
  return <>
    <div className="hospital-detail-tabs" role="tablist" aria-label="병원 상세 보기">
      {tabs.map((tab, index) => <button key={tab.key} ref={node => { buttons.current[index] = node; }}
        type="button" role="tab" id={`${id}-${tab.key}-tab`} aria-controls={`${id}-${tab.key}-panel`}
        aria-selected={active === tab.key} tabIndex={active === tab.key ? 0 : -1}
        onClick={() => setActive(tab.key)} onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
          setActive(tabs[next].key);
          buttons.current[next]?.focus({ preventScroll: true });
        }}>{tab.label}</button>)}
    </div>
    <div role="tabpanel" id={`${id}-measurements-panel`} aria-labelledby={`${id}-measurements-tab`} hidden={active !== "measurements"} tabIndex={0}>
      {active === "measurements" && children}
    </div>
    <div role="tabpanel" id={`${id}-management-panel`} aria-labelledby={`${id}-management-tab`} hidden={active !== "management"} tabIndex={0}>
      {management}
    </div>
  </>;
}
