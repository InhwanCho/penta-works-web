import CircleLoader from "@/components/icons/circle-loader";

export default function DashboardLoading() {
  return <main aria-busy="true" className="flex min-h-[50dvh] items-center justify-center"><CircleLoader size="m" /></main>;
}
