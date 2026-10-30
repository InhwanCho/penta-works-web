"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import PageLoader from "@/components/common/page-loader";
import { OverlayNavigation, openWorkspaceOverlay } from "./overlay-navigation";
const SchedulePage = dynamic(() => import("./workspace-pages").then(m => m.SchedulePage), { loading: () => <PageLoader /> });
const WorkEditor = dynamic(() => import("./work-editor"), { loading: () => <PageLoader /> });
export default function DayComposer({ date }: { date: string }) {
 const initial = `/schedule?date=${date}&new=1`;
 const [href, setHref] = useState(initial);
 const [version, setVersion] = useState(0);
 const [saved, setSaved] = useState(false);
 const reset = () => { setVersion(v => v + 1); setSaved(true); };
 return <section className="day-agenda-section day-composer"><h3>작성</h3>
  {saved && <p role="status" className="work-hint">저장했습니다.</p>}
  <OverlayNavigation.Provider value={{ href, close: reset, replace: next => { if (next.startsWith("/schedule?") || next.startsWith("/work/new?")) { setHref(next); setSaved(false); } else reset(); }, push: openWorkspaceOverlay }}>
   {href.startsWith("/schedule") ? <SchedulePage key={`${href}-${version}`} onSaved={reset} /> : <WorkEditor key={`${href}-${version}`} />}
  </OverlayNavigation.Provider>
 </section>;
}
