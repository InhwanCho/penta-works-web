import CircleLoader from "@/components/icons/circle-loader";

export default function AuthPageLoading({ title = "초대 정보를 확인하고 있습니다" }: { title?: string }) {
  return <main aria-busy="true" className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full items-center justify-center px-4 py-8">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-background-dark-card">
      <div className="flex items-center gap-3"><CircleLoader size="m" className="shrink-0 [&>span]:border-slate-200 [&>span]:border-t-sky-700 [&>span]:border-r-sky-700 dark:[&>span]:border-slate-700 dark:[&>span]:border-t-sky-300 dark:[&>span]:border-r-sky-300" /><div><h1 className="text-base font-bold">{title}</h1><p className="text-text-secondary mt-1 text-xs leading-5">잠시만 기다려주세요. 연결 상태에 따라 시간이 걸릴 수 있습니다.</p></div></div>
      <div aria-hidden="true" className="mt-6 space-y-4 animate-pulse motion-reduce:animate-none"><div className="h-16 rounded-xl bg-slate-100 dark:bg-white/8" /><div className="h-12 rounded-xl bg-slate-100 dark:bg-white/8" /><div className="h-12 rounded-xl bg-slate-100 dark:bg-white/8" /><div className="h-12 rounded-xl bg-sky-50 dark:bg-sky-950/30" /></div>
    </section>
  </main>;
}
