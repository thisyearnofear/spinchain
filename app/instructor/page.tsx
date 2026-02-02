import { PrimaryNav } from "../components/nav";
import { BulletList, SectionHeader, SurfaceCard, Tag } from "../components/ui";

export default function InstructorPage() {
  const controls = [
    "Dynamic pricing curves with early-bird ramps",
    "Reward thresholds based on effort, not raw calories",
    "Sponsor pools with programmable distributions",
    "Automated revenue splits with DAO fees",
  ];

  const liveSignals = [
    { title: "Class Fill", value: "42 / 50 riders" },
    { title: "Effort Goals Hit", value: "84%" },
    { title: "Sponsor Pool", value: "1.2 ETH" },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2550,transparent_55%),radial-gradient(circle_at_80%_20%,#2a1d5a,transparent_40%)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-white/10 bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        <SurfaceCard
          eyebrow="Instructor Console"
          title="Design class economics in minutes"
          description="SpinClass contracts turn your schedule into programmable events."
          className="bg-[color:var(--surface-strong)]"
        >
          <div className="mt-6 flex flex-wrap gap-3">
            <Tag>Dynamic pricing</Tag>
            <Tag>Private metrics</Tag>
            <Tag>Auto payouts</Tag>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {liveSignals.map((signal) => (
              <div
                key={signal.title}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {signal.title}
                </p>
                <p className="mt-2 text-lg font-semibold text-white">{signal.value}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <SurfaceCard
            eyebrow="Class Builder"
            title="Set the rules once"
            description="Configure ticket supply, pricing, reward rules, and splits."
          >
            <BulletList items={controls} />
          </SurfaceCard>

          <SurfaceCard
            eyebrow="Live Dashboard"
            title="Aggregates only"
            description="Instructor sees the room, not the medical data."
          >
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              80% of riders are in target HR zone
            </div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              Median effort score: 158 (no raw HR shared)
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard
          eyebrow="Revenue Engine"
          title="Trustless settlement"
          description="Payments stream to your treasury with automatic splits."
        >
          <SectionHeader
            eyebrow="Treasury"
            title="3.8 ETH earned"
            description="Last class • settled on Base"
            actions={
              <>
                <button className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white/70 transition hover:text-white">
                  View splits
                </button>
                <button className="rounded-full bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20">
                  Settle now
                </button>
              </>
            }
          />
        </SurfaceCard>
      </main>
    </div>
  );
}
