export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Static Skeleton Header */}
      <header className="border-b border-border bg-purple-50 dark:bg-purple-900/20 w-full animate-pulse">
        <div className="border-b border-border/50">
          <div className="mx-auto max-w-7xl w-full flex items-center justify-between px-3.5 md:px-4 py-2 md:py-3 h-[60px] md:h-[76px]">
            {/* Logo placeholder */}
            <div className="w-28 md:w-36 h-8 md:h-10 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            {/* Search bar placeholder */}
            <div className="hidden md:block w-[350px] lg:w-[450px] h-10 bg-slate-200 dark:bg-slate-800 rounded-full" />
            {/* Profile placeholder */}
            <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
        </div>
        {/* Desktop Nav links placeholder */}
        <div className="border-t border-border bg-background w-full hidden md:block h-12">
          <div className="mx-auto max-w-7xl h-full flex items-center justify-center gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded-full" />
            ))}
          </div>
        </div>
      </header>

      {/* Page Content Skeleton (Mimics Home layout) */}
      <div className="mx-auto max-w-7xl px-4 py-4 md:py-6 animate-pulse">
        {/* Poster Slider Placeholder */}
        <div className="w-full h-[160px] md:h-[300px] bg-slate-200 dark:bg-slate-800 rounded-[2rem] mb-6" />

        {/* Favorite Channels Skeleton */}
        <div className="mb-8">
          <div className="w-32 h-6 bg-slate-200 dark:bg-slate-800 rounded-lg mb-4" />
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex-shrink-0 w-20 flex flex-col items-center">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-200 dark:bg-slate-800 rounded-full mb-2" />
                <div className="w-12 h-3 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Tabs Placeholder */}
        <div className="flex gap-4 border-b border-border pb-3 mb-6">
          <div className="w-20 h-8 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="w-20 h-8 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>

        {/* Category Filter Placeholder */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-16 h-8 bg-slate-200 dark:bg-slate-800 rounded-full flex-shrink-0" />
          ))}
        </div>

        {/* Event Cards Grid Placeholder */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="border border-border rounded-3xl p-4 bg-card">
              <div className="w-full h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl mb-4" />
              <div className="w-3/4 h-5 bg-slate-200 dark:bg-slate-800 rounded-lg mb-2" />
              <div className="w-1/2 h-4 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
