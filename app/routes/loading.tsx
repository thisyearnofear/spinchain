"use client";


export default function RoutesLoading() {
  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        {/* Nav skeleton */}
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <div className="h-12 w-32 animate-pulse rounded-lg bg-[color:var(--surface-strong)]" />
        </div>

        {/* Route Worlds card skeleton */}
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-8">
          <div className="h-6 w-32 animate-pulse rounded bg-[color:var(--surface)] mb-2" />
          <div className="h-10 w-96 animate-pulse rounded-lg bg-[color:var(--surface)] mb-2" />
          <div className="h-5 w-full max-w-xl animate-pulse rounded bg-[color:var(--surface)] mb-6" />
          
          <div className="flex gap-3 mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-[color:var(--surface)]" />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-48 animate-pulse rounded-2xl bg-[color:var(--surface)]" />
            <div className="h-48 animate-pulse rounded-2xl bg-[color:var(--surface)]" />
          </div>
        </div>

        {/* Elevation Preview skeleton */}
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-8">
          <div className="h-6 w-40 animate-pulse rounded bg-[color:var(--surface)] mb-2" />
          <div className="h-10 w-80 animate-pulse rounded-lg bg-[color:var(--surface)] mb-2" />
          <div className="h-5 w-full max-w-lg animate-pulse rounded bg-[color:var(--surface)]" />
          
          <div className="mt-6 h-96 animate-pulse rounded-2xl bg-[color:var(--surface)]" />
        </div>

        {/* Upcoming Worlds skeleton */}
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-8">
          <div className="h-6 w-40 animate-pulse rounded bg-[color:var(--surface)] mb-2" />
          <div className="h-10 w-72 animate-pulse rounded-lg bg-[color:var(--surface)] mb-2" />
          
          <div className="grid gap-4 md:grid-cols-3 mt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-[color:var(--surface)]" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
