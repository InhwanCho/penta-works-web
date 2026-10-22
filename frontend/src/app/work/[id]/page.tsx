import CircleLoader from "@/components/icons/circle-loader";
import { Suspense } from "react";
import WorkEditor from "@/components/workspace/work-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="flex min-h-[50dvh] items-center justify-center"><CircleLoader size="m" /></div>}>
      <WorkEditor id={id} />
    </Suspense>
  );
}
