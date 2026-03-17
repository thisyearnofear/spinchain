"use client";


export default function RiderLoading() {
  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
      
      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        {/* Nav skeleton */}
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <div className="h-12 w-32 animate-pulse rounded-lg bg-[color:var(--surface-strong)]" />
        </div>

        {/* Featured coaches skeleton */}
        <section className="space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="h-8 w-48 animate-pulse rounded-lg bg-[color:var(--surface-strong)] mb-2" />
              <div className="h-4 w-72 animate-pulse rounded-lg bg-[color:var(--surface-strong)]" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-3xl bg-[color:var(--surface-strong)]" />
            ))}
          </div>
        </section>

        {/* Classes header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="h-10 w-48 animate-pulse rounded-lg bg-[color:var(--surface-strong)] mb-2" />
            <div className="h-4 w-64 animate-pulse rounded-lg bg-[color:var(--surface-strong)]" />
          </div>
          <div className="h-10 w-36 animate-pulse rounded-lg bg-[color:var(--surface-strong)]" />
        </div>

        {/* Classes grid skeleton */}
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-[color:var(--surface-strong)]" />
          ))}
        </div>
      </main>
    </div>
  );
}
