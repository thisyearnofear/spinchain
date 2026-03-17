"use client";


export default function InstructorLoading() {
  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
      
      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        {/* Nav skeleton */}
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <div className="h-12 w-32 animate-pulse rounded-lg bg-[color:var(--surface-strong)]" />
        </div>

        {/* Business Overview skeleton */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-black/40 p-8">
              <div className="h-10 w-64 animate-pulse rounded-lg bg-white/5 mb-8" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i}>
                    <div className="h-3 w-16 animate-pulse rounded bg-white/10 mb-2" />
                    <div className="h-8 w-20 animate-pulse rounded bg-white/5" />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
              <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="h-40 animate-pulse rounded-2xl bg-[color:var(--surface-strong)]" />
            <div className="h-32 animate-pulse rounded-2xl bg-[color:var(--surface-strong)]" />
          </div>
        </section>

        {/* CTA skeleton */}
        <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-12">
          <div className="h-12 w-12 animate-pulse rounded-full bg-[color:var(--surface-strong)] mx-auto mb-6" />
          <div className="h-8 w-72 animate-pulse rounded-lg bg-[color:var(--surface-strong)] mx-auto mb-3" />
          <div className="h-4 w-96 animate-pulse rounded bg-[color:var(--surface-strong)] mx-auto mb-6" />
          <div className="h-12 w-48 animate-pulse rounded-full bg-[color:var(--surface-strong)] mx-auto" />
        </div>

        {/* Quick Links skeleton */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-[color:var(--surface-strong)]" />
          ))}
        </div>
      </main>
    </div>
  );
}
