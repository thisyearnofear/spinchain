"use client";


export default function JourneyLoading() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2550,transparent_55%),radial-gradient(circle_at_80%_20%,#2a1d5a,transparent_40%)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        {/* Nav skeleton */}
        <div className="rounded-3xl border border-white/10 bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <div className="h-12 w-32 animate-pulse rounded-lg bg-white/10" />
        </div>

        {/* Stats grid skeleton */}
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>

        {/* Weekly goal skeleton */}
        <div className="h-32 animate-pulse rounded-3xl bg-white/5" />

        {/* Trend snapshot skeleton */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="h-7 w-40 animate-pulse rounded bg-white/10 mb-4" />
          <div className="grid gap-3 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-black/20" />
            ))}
          </div>
        </div>

        {/* Badges and leaderboard skeleton */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-48 animate-pulse rounded-3xl bg-white/5" />
          <div className="h-48 animate-pulse rounded-3xl bg-white/5" />
        </div>

        {/* Ride history skeleton */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="h-7 w-40 animate-pulse rounded bg-white/10 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/20" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
