export default function DashboardLoading() {
  return (
    <main role="status" aria-label="대시보드를 불러오는 중" className="mx-auto w-full max-w-7xl space-y-3 px-3 py-4 sm:px-4">
      <span className="sr-only">최신 측정값을 불러오고 있습니다.</span>
      <div className="h-11 w-full rounded-xl bg-slate-200/70 motion-safe:animate-pulse dark:bg-white/10" />
      {[0, 1, 2, 3].map((item) => <div key={item} aria-hidden="true" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-background-dark-card">
        <div className="h-4 w-2/5 rounded bg-slate-200/70 motion-safe:animate-pulse dark:bg-white/10" />
        <div className="grid grid-cols-2 gap-3"><div className="h-14 rounded-xl bg-slate-100 motion-safe:animate-pulse dark:bg-white/5" /><div className="h-14 rounded-xl bg-slate-100 motion-safe:animate-pulse dark:bg-white/5" /></div>
      </div>)}
    </main>
  );
}
