import CircleLoader from "@/components/icons/circle-loader";
import { Suspense } from "react";
import AlertSettingsPage from "@/components/baselines/alert-settings-page";

export default async function Page({ params }: {params: Promise<{siteId: string}>}) {
  const {siteId} = await params;
  return <Suspense fallback={<div className="flex min-h-[50dvh] items-center justify-center"><CircleLoader size="m" /></div>}><AlertSettingsPage siteId={siteId} /></Suspense>;
}
