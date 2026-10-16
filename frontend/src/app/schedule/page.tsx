import { SchedulePage } from "@/components/workspace/workspace-pages";
import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense fallback={<p className="work-page">일정을 불러오는 중…</p>}>
      <SchedulePage />
    </Suspense>
  );
}
