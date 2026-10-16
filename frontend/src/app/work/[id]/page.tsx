import { Suspense } from "react";
import WorkEditor from "@/components/workspace/work-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<p>업무를 불러오는 중…</p>}>
      <WorkEditor id={id} />
    </Suspense>
  );
}
