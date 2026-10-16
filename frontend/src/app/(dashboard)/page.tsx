import { TodayPage } from "@/components/workspace/workspace-pages";
import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.scrollTo || params.view) {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params))
      if (typeof v === "string") query.set(k, v);
    redirect(`/monitoring?${query}`);
  }
  return <TodayPage />;
}
