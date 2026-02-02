import { PrimaryNav } from "./components/nav";
import { BulletList, MetricTile, SectionHeader, SurfaceCard, Tag } from "./components/ui";

export default function Home() {
  const riderHighlights = [
    { label: "Effort Proof", value: "145+ HR", detail: "28 min sustained" },
    { label: "Streak", value: "10 classes", detail: "Top 15% today" },
    { label: "Rewards", value: "50 SPIN", detail: "20% next ride" },
  ];

  const instructorControls = [
    "Dynamic pricing curves with early-bird ramps",
    "Privacy-safe leaderboards with opt-in stats",
    "Sponsor-funded reward pools per class",
    "Automated splits to studio, coach, DAO",
  ];

  const architectureLayers = [
    {
      title: "Class Contracts",
      description: "Per-class ERC-721 tickets + revenue settlement on Base.",
    },
    {
      title: "Privacy Proofs",
      description: "Client-side attestations today, ZK circuits tomorrow.",
    },
    {
      title: "Reward Engine",
      description: "Composable incentives + tokenized achievements.",
    },
    {
      title: "Experience Layer",
      description: "Route worlds, progress stories, and shareable proof cards.",
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2550,transparent_55%),radial-gradient(circle_at_80%_20%,#2a1d5a,transparent_40%)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-20 pt-10 lg:px-12">
        <header className="flex flex-col items-start justify-between gap-8 rounded-3xl border border-white/10 bg-[color:var(--surface)]/80 px-8 py-10 shadow-[0_20px_80px_rgba(5,9,24,0.5)] backdrop-blur">
          <PrimaryNav />
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--accent)]">
                HackMoney 2026 MVP
              </p>
              <h2 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
                Turn spin classes into programmable financial events.
              </h2>
              <p className="text-base leading-7 text-[color:var(--muted)] md:text-lg">
                SpinChain is an onchain operating system for instructors—ticketing, dynamic
                pricing, privacy-preserving performance proofs, and composable rewards in one
                experience.
              </p>
              <div className="flex flex-wrap gap-3">
                <Tag>Base L2</Tag>
                <Tag>ZK ready</Tag>
                <Tag>Privacy by default</Tag>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[color:var(--surface-strong)] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Rider Progress
                  </p>
                  <h3 className="text-xl font-semibold text-white">
                    Proof of Effort
                  </h3>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                  Live
                </span>
              </div>
              <div className="mt-6 flex items-center gap-6">
                <div className="relative grid h-24 w-24 place-items-center rounded-full bg-[conic-gradient(from_180deg,#6ef3c6_0deg,#6ef3c6_260deg,#1c2438_260deg)]">
                  <div className="grid h-18 w-18 place-items-center rounded-full bg-[color:var(--surface-strong)] text-sm font-semibold text-white">
                    82%
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-[color:var(--muted)]">Effort zone</p>
                  <p className="text-lg font-semibold text-white">HR 148 • 32 min</p>
                  <p className="text-xs text-[color:var(--success)]">
                    Verified locally, shared onchain
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {riderHighlights.map((item) => (
                  <MetricTile key={item.label} {...item} />
                ))}
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <SurfaceCard
            eyebrow="Instructor Console"
            title="Micro-protocols for every class"
            description="Build economics, not spreadsheets. Set ticket supply, surge curves, reward rules, and splits — then run a live privacy-safe dashboard during class."
            className="rounded-3xl"
          >
            <div className="mt-6">
              <BulletList items={instructorControls} />
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Revenue
                </p>
                <p className="mt-2 text-lg font-semibold text-white">3.8 ETH</p>
                <p className="text-xs text-white/60">Auto-split to studio + coach</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Engagement
                </p>
                <p className="mt-2 text-lg font-semibold text-white">84% goals hit</p>
                <p className="text-xs text-white/60">Privacy-safe aggregates</p>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard
            eyebrow="Route Worlds"
            title="Curated 3D rides, powered by prompts or GPX routes"
            description="Each class can spawn a cinematic world — city climbs, desert dunes, or instructor-designed narratives — synchronized to effort goals."
            className="rounded-3xl bg-[linear-gradient(140deg,#0f1524,#0d101f)]"
          >
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                "GPX routes → 3D elevation worlds",
                "Instructor prompts → generative scenes",
                "Adaptive pacing synced to HR zones",
                "Shareable proof card with route replay",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80"
                >
                  {item}
                </div>
              ))}
            </div>
          </SurfaceCard>
        </section>

        <section className="grid gap-6 lg:grid-cols-4">
          {architectureLayers.map((layer) => (
            <SurfaceCard
              key={layer.title}
              eyebrow={layer.title}
              title={layer.description}
            />
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-[color:var(--surface)] p-8">
          <SectionHeader
            eyebrow="Next to build"
            title="Rider journey + instructor builder flows"
            description="We can wire this to contracts + proofs once UI decisions are locked."
            actions={
              <>
                <button className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white/70 transition hover:text-white">
                  View Architecture
                </button>
                <button className="rounded-full bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20">
                  Start Class Builder
                </button>
              </>
            }
          />
        </section>
      </main>
    </div>
  );
}
