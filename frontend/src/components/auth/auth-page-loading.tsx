import CircleLoader from "@/components/icons/circle-loader";

export default function AuthPageLoading() {
  return <main aria-busy="true" className="flex min-h-[calc(100dvh-7rem)] items-center justify-center px-4"><CircleLoader size="m" /></main>;
}
