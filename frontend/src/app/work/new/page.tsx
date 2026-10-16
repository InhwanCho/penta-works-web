import { Suspense } from "react";
import WorkEditor from "@/components/workspace/work-editor";
export default function Page() {
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <WorkEditor />
    </Suspense>
  );
}
