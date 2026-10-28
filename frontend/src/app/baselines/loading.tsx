import AlertInboxTabs from "@/components/baselines/alert-inbox-tabs";
import CircleLoader from "@/components/icons/circle-loader";

/** Match the inbox instead of flashing a full-page loader before it mounts. */
export default function Loading() {
  return <section className="alert-inbox">
    <AlertInboxTabs value="unacknowledged" />
    <p className="alert-inbox-guide">아직 확인하지 않은 알림입니다. 확인하면 같은 알림을 24시간 쉬어갑니다.</p>
    <details className="alert-inbox-filters"><summary>상세 검색</summary></details>
    <div className="flex min-h-32 items-center justify-center"><CircleLoader size="m" inline /></div>
  </section>;
}
