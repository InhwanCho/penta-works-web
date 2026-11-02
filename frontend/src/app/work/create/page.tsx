import PageLoader from "@/components/common/page-loader";
import { Suspense } from "react";
import WorkEditor from "@/components/workspace/work-editor";
export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <WorkEditor />
    </Suspense>
  );
}
