import { Suspense } from "react";
import AlertSettingsPage from "@/components/baselines/alert-settings-page";

export default async function Page({ params }: {params: Promise<{siteId: string}>}) {
  const {siteId} = await params;
  return <Suspense fallback={<p className="p-6">설정을 불러오는 중…</p>}><AlertSettingsPage siteId={siteId} /></Suspense>;
}
