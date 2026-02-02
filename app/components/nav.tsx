export function PrimaryNav() {
  return (
    <nav className="flex w-full flex-wrap items-center justify-between gap-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] text-xl font-semibold text-white">
          S
        </span>
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">
            SpinChain Protocol
          </p>
          <h1 className="text-2xl font-semibold text-white">
            Privacy-first fitness DeFi
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <a
          href="/routes"
          className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white/70 transition hover:text-white"
        >
          Route Worlds
        </a>
        <a
          href="/instructor"
          className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white/70 transition hover:text-white"
        >
          Instructor
        </a>
        <a
          href="/rider"
          className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          Rider View
        </a>
      </div>
    </nav>
  );
}
