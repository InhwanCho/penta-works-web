"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteAlertSettingsDialog } from "./site-alert-settings-button";
import type { AlertSettingsPane } from "./alert-settings-table";

export default function AlertSettingsPage({siteId}: {siteId: string}) {
  const router = useRouter(), query = useSearchParams();
  const pane = query.get('pane');
  const destination = query.get('return');
  const returnsToHospital = !!destination && /^\/sites\/[^/?#]+#hospital-alert-summary$/.test(destination);
  const onClose = () => router.replace(destination && (returnsToHospital || destination === '/?view=alerts' || destination === '/baselines?view=thresholds') ? destination : '/baselines?view=thresholds');
  return <main>
    <button type="button" onClick={onClose} className="work-back mx-3 mt-2 min-h-11 px-3 font-bold text-sky-700 dark:text-sky-300">← {returnsToHospital ? "병원 상세" : "병원별 알림 기준 목록"}</button>
    <SiteAlertSettingsDialog page siteId={siteId} initialMetricKey={query.get('metric') ?? undefined} initialPane={['metrics','missing','schedule'].includes(pane ?? '') ? pane as AlertSettingsPane : undefined} onlyMetricKey={query.get('only') ?? undefined} onClose={onClose} />
  </main>;
}
