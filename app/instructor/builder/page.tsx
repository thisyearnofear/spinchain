import { PrimaryNav } from "../../components/nav";
import { BulletList, SectionHeader, SurfaceCard, Tag } from "../../components/ui";

export default function InstructorBuilderPage() {
  const builderSteps = [
    "Define class basics + schedule",
    "Set ticket supply + pricing curve",
    "Configure rewards + sponsor pool",
    "Attach route world + publish",
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2550,transparent_55%),radial-gradient(circle_at_80%_20%,#2a1d5a,transparent_40%)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-white/10 bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        <SurfaceCard
          eyebrow="Class Builder"
          title="Design a programmable class in minutes"
          description="SpinClass contracts are configured like product launch flows."
          className="bg-[color:var(--surface-strong)]"
        >
          <div className="mt-6 flex flex-wrap gap-3">
            <Tag>Pricing curves</Tag>
            <Tag>Reward rules</Tag>
            <Tag>Auto splits</Tag>
          </div>
          <div className="mt-6">
            <BulletList items={builderSteps} />
          </div>
        </SurfaceCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard
            eyebrow="Step 1"
            title="Class basics"
            description="Name, duration, and rider capacity."
          >
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              45 min • 50 riders • Saturday 9:00 AM
            </div>
          </SurfaceCard>

          <SurfaceCard
            eyebrow="Step 2"
            title="Dynamic pricing"
            description="Early-bird → surge curve with caps."
          >
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              Base 0.03 ETH → Max 0.09 ETH
            </div>
          </SurfaceCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard
            eyebrow="Step 3"
            title="Rewards + sponsors"
            description="Set thresholds and sponsor-backed pools."
          >
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              10 SPIN for effort ≥ 150 • Sponsor pool 1.2 ETH
            </div>
          </SurfaceCard>

          <SurfaceCard
            eyebrow="Step 4"
            title="Route world"
            description="Attach GPX or prompt-based world."
          >
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              Coastal Climb • Sunset palette • 52 km
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard
          eyebrow="Publish"
          title="Deploy class contract"
          description="Confirm your economics, then mint tickets."
        >
          <SectionHeader
            eyebrow="Deployment"
            title="Ready to launch"
            description="SpinClass + pricing curve + reward rules."
            actions={
              <>
                <button className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white/70 transition hover:text-white">
                  Save draft
                </button>
                <button className="rounded-full bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20">
                  Deploy class
                </button>
              </>
            }
          />
        </SurfaceCard>
      </main>
    </div>
  );
}
