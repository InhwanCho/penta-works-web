import PageLoader from "@/components/common/page-loader";
import { Suspense } from "react";
import AlertSettingsPage from "@/components/baselines/alert-settings-page";

export default async function Page({ params }: {params: Promise<{siteId: string}>}) {
  const {siteId} = await params;
  return <Suspense fallback={<PageLoader />}><AlertSettingsPage siteId={siteId} /></Suspense>;
}
