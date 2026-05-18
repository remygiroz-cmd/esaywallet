// Skeleton shown instantly while a page server-renders. Next.js wraps
// every route in <Suspense fallback={<Loading />}> so this appears the
// moment a tab is clicked, before the new page's data has loaded.
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-8 w-56 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/60" />
      <div className="h-4 w-72 rounded-lg bg-zinc-200/50 dark:bg-zinc-800/40" />
      <div className="mt-2 h-40 rounded-3xl bg-zinc-200/70 dark:bg-zinc-800/60" />
      <div className="h-56 rounded-2xl bg-zinc-200/50 dark:bg-zinc-800/40" />
      <div className="h-48 rounded-2xl bg-zinc-200/50 dark:bg-zinc-800/40" />
    </div>
  );
}
