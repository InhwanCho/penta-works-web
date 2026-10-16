import { WorkPage } from "@/components/workspace/workspace-pages";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return <WorkPage onlyOpen={status === "open"} />;
}
