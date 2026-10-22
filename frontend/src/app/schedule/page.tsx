import CircleLoader from "@/components/icons/circle-loader";
import { SchedulePage } from "@/components/workspace/workspace-pages";
import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense fallback={<div className="flex min-h-[50dvh] items-center justify-center"><CircleLoader size="m" /></div>}>
      <SchedulePage />
    </Suspense>
  );
}
