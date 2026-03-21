export function MatchCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 overflow-hidden animate-pulse">
      <div className="p-4">
        {/* League + status row */}
        <div className="flex items-center justify-between mb-3">
          <div className="h-3 bg-white/10 rounded-full w-32" />
          <div className="h-5 bg-white/8 rounded-full w-10" />
        </div>

        {/* Teams + center */}
        <div className="flex items-center gap-3">
          {/* Home team */}
          <div className="flex flex-col items-center gap-1.5 w-[80px]">
            <div className="w-9 h-9 rounded-full bg-white/10" />
            <div className="h-2.5 bg-white/10 rounded-full w-14" />
          </div>

          {/* Center column */}
          <div className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-white/8" />
            <div className="h-3 bg-white/10 rounded-full w-10" />
            <div className="h-4 bg-white/10 rounded-full w-14" />
          </div>

          {/* Away team */}
          <div className="flex flex-col items-center gap-1.5 w-[80px]">
            <div className="w-9 h-9 rounded-full bg-white/10" />
            <div className="h-2.5 bg-white/10 rounded-full w-14" />
          </div>
        </div>

        {/* Chevron placeholder */}
        <div className="flex justify-center mt-3">
          <div className="h-2 w-4 bg-white/8 rounded-full" />
        </div>
      </div>
    </div>
  );
}
