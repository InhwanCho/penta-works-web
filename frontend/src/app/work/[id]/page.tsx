import PageLoader from "@/components/common/page-loader";
import { Suspense } from "react";
import WorkEditor from "@/components/workspace/work-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageLoader />}>
      <WorkEditor id={id} />
    </Suspense>
  );
}
