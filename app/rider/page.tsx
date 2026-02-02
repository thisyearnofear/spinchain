import { PrimaryNav } from "../components/nav";
import { BulletList, MetricTile, SectionHeader, SurfaceCard, Tag } from "../components/ui";

export default function RiderPage() {
  const highlights = [
    { label: "Effort Proof", value: "145+ HR", detail: "28 min sustained" },
    { label: "Streak", value: "10 classes", detail: "Top 15% today" },
    { label: "Rewards", value: "50 SPIN", detail: "20% next ride" },
  ];

  const milestones = [
    "Verified effort proof stored onchain",
    "Discount unlocked for next class",
    "Shareable proof card generated",
    "Sponsor bonus applied automatically",
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2550,transparent_55%),radial-gradient(circle_at_80%_20%,#2a1d5a,transparent_40%)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-white/10 bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        <SurfaceCard
          eyebrow="Rider Progress"
          title="Effort proof + rewards in one feed"
          description="Only the proof is shared onchain. Health metrics stay on your device."
          className="bg-[color:var(--surface-strong)]"
        >
          <div className="mt-6 flex flex-wrap gap-3">
            <Tag>HR zone</Tag>
            <Tag>Privacy safe</Tag>
            <Tag>Auto rewards</Tag>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {highlights.map((item) => (
              <MetricTile key={item.label} {...item} />
            ))}
          </div>
        </SurfaceCard>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <SurfaceCard
            eyebrow="Live Session"
            title="Ride feedback, not wallet prompts"
            description="Focus on the ride. Proofs are generated in the background."
          >
            <div className="mt-6 flex items-center gap-6">
              <div className="relative grid h-24 w-24 place-items-center rounded-full bg-[conic-gradient(from_180deg,#6ef3c6_0deg,#6ef3c6_260deg,#1c2438_260deg)]">
                <div className="grid h-18 w-18 place-items-center rounded-full bg-[color:var(--surface)] text-sm font-semibold text-white">
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
          </SurfaceCard>

          <SurfaceCard
            eyebrow="Rewards"
            title="Stacked incentives"
            description="Earn tokens, unlock discounts, and collect proof badges."
          >
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              10 SPIN for effort score ≥ 150
            </div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              20% off next class (7-day window)
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard
          eyebrow="Post-Class"
          title="Proof card + shareable highlights"
          description="A single story for social + onchain verification."
        >
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Proof Card
              </p>
              <h4 className="mt-2 text-xl font-semibold text-white">
                45 min • 620 cal • Top 15%
              </h4>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Linked to your instructor profile + reward history.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Tag>Onchain proof</Tag>
                <Tag>Share-ready</Tag>
              </div>
            </div>
            <SurfaceCard
              eyebrow="Milestones"
              title="What you just unlocked"
              className="bg-transparent"
            >
              <BulletList items={milestones} />
            </SurfaceCard>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/rider/journey"
              className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white/70 transition hover:text-white"
            >
              View rider journey
            </a>
            <button className="rounded-full bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20">
              Generate proof card
            </button>
          </div>
        </SurfaceCard>
      </main>
    </div>
  );
}
