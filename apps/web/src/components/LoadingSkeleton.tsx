export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 flex gap-2">
            <div className="h-5 w-20 animate-pulse rounded bg-slate-100" />
            <div className="h-5 w-16 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="mt-5 h-2 w-full animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
