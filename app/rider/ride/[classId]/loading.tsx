"use client";

export default function RideLoading() {
  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {/* Top bar skeleton */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="h-6 w-24 animate-pulse rounded bg-white/10" />
        <div className="flex items-center gap-4">
          <div className="h-6 w-16 animate-pulse rounded bg-white/10" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
        </div>
      </div>

      {/* Main visualizer area skeleton */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-4xl h-64 mx-4 rounded-2xl bg-white/5 animate-pulse" />
      </div>

      {/* HUD skeleton */}
      <div className="border-t border-white/10 bg-black/80 backdrop-blur-xl">
        {/* Stats row */}
        <div className="flex justify-around px-4 py-4 border-b border-white/5">
          <div className="text-center">
            <div className="h-4 w-12 animate-pulse rounded bg-white/10 mx-auto mb-1" />
            <div className="h-8 w-16 animate-pulse rounded bg-white/10" />
          </div>
          <div className="text-center">
            <div className="h-4 w-12 animate-pulse rounded bg-white/10 mx-auto mb-1" />
            <div className="h-8 w-16 animate-pulse rounded bg-white/10" />
          </div>
          <div className="text-center">
            <div className="h-4 w-12 animate-pulse rounded bg-white/10 mx-auto mb-1" />
            <div className="h-8 w-16 animate-pulse rounded bg-white/10" />
          </div>
          <div className="text-center">
            <div className="h-4 w-12 animate-pulse rounded bg-white/10 mx-auto mb-1" />
            <div className="h-8 w-16 animate-pulse rounded bg-white/10" />
          </div>
        </div>

        {/* Controls skeleton */}
        <div className="flex items-center justify-center gap-4 px-4 py-6">
          <div className="h-14 w-14 animate-pulse rounded-full bg-white/10" />
          <div className="h-16 w-32 animate-pulse rounded-xl bg-white/10" />
          <div className="h-14 w-14 animate-pulse rounded-full bg-white/10" />
        </div>
      </div>

      {/* Loading indicator */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="h-12 w-12 mx-auto animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="mt-4 text-white/60 text-sm">Loading ride...</p>
        </div>
      </div>
    </div>
  );
}
