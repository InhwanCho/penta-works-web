import SiteDetailClient from "@/components/site/site-detail-client";
import { use } from "react";

export default function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteid: string }>;
}) {
  const { siteid } = use(params);
  return <SiteDetailClient slug={siteid} />;
}
