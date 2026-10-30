"use client";
import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import WorkspaceDrawer from "./workspace-drawer";
import { OverlayNavigation, isWorkspaceOverlay } from "./overlay-navigation";
const WorkEditor = dynamic(() => import("./work-editor"));
const WorkPage = dynamic(() => import("./workspace-pages").then(m => m.WorkPage));
const OverviewDetail = dynamic(() => import("./overview-detail"));
const SchedulePage = dynamic(() => import("./workspace-pages").then(m => m.SchedulePage));
export default function WorkspaceOverlays() {
 const pathname = usePathname(); const router = useRouter();
 const [stack, setStack] = useState<{ key: number; href: string }[]>([]);
 useEffect(() => {
  let key = Date.now();
  if (isWorkspaceOverlay(pathname)) setStack([{ key: ++key, href: window.location.pathname + window.location.search + window.location.hash }]);
  const open = (event: Event) => { const href = (event as CustomEvent<string>).detail; if (isWorkspaceOverlay(href)) setStack(s => [...s, { key: ++key, href }]); };
  window.addEventListener("workspace-overlay", open);
  return () => window.removeEventListener("workspace-overlay", open);
 }, [pathname]);
 return stack.map((entry, index) => {
  const url = new URL(entry.href, "https://workspace.local"); const id = url.pathname.match(/^\/work\/(\d+)$/)?.[1];
  const schedule = url.pathname === "/schedule";
  const title = schedule ? "일정" : id ? "업무기록 상세" : url.pathname === "/work/new" ? "업무기록 작성" : "업무기록 목록";
  const close = () => { if (!window.dispatchEvent(new CustomEvent("workspace-overlay-close", { cancelable: true, detail: entry.href }))) return; setStack(s => s.slice(0, index)); if (index === 0 && isWorkspaceOverlay(pathname)) router.replace("/overview"); };
  return <OverlayNavigation.Provider key={entry.key} value={{ href: entry.href, close, push: href => window.dispatchEvent(new CustomEvent("workspace-overlay", { detail: href })), replace: href => setStack(s => s.map((item, i) => i === index ? { ...item, href } : item)) }}>
   {schedule && url.hash.startsWith("#schedule-") ? <OverviewDetail href={entry.href} onClose={close} /> : <WorkspaceDrawer title={title} onClose={close} className="workspace-route-overlay">
    <Suspense fallback={<p role="status">불러오는 중…</p>}>
     {schedule ? <SchedulePage key={entry.href} /> : id || url.pathname === "/work/new" ? <WorkEditor key={url.pathname} id={id} /> : <WorkPage onlyOpen={url.searchParams.get("status") === "open"} />}
    </Suspense>
   </WorkspaceDrawer>}
  </OverlayNavigation.Provider>;
 });
}
