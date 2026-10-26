import PageLoader from "@/components/common/page-loader";
import { SchedulePage } from "@/components/workspace/workspace-pages";
import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SchedulePage />
    </Suspense>
  );
}
