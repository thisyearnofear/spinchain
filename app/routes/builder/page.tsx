import { PrimaryNav } from "../../components/nav";
import { BulletList, SectionHeader, SurfaceCard, Tag } from "../../components/ui";
import { GpxUploader } from "./gpx-uploader";

export default function RouteBuilderPage() {
  const steps = [
    "Upload GPX or paste route URL",
    "Set narrative prompt + mood",
    "Map effort zones to segments",
    "Preview + publish to class",
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2550,transparent_55%),radial-gradient(circle_at_80%_20%,#2a1d5a,transparent_40%)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-white/10 bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        <SurfaceCard
          eyebrow="World Builder"
          title="Create a route world in minutes"
          description="Use GPX geometry or natural-language prompts to craft immersive rides."
          className="bg-[color:var(--surface-strong)]"
        >
          <div className="mt-6 flex flex-wrap gap-3">
            <Tag>GPX ingest</Tag>
            <Tag>Prompt engine</Tag>
            <Tag>Effort sync</Tag>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <SurfaceCard
              eyebrow="Step 1"
              title="Route source"
              description="Drag & drop GPX or import from Strava/Komoot."
              className="bg-transparent"
            >
              <div className="mt-4">
                <GpxUploader />
              </div>
            </SurfaceCard>
            <SurfaceCard
              eyebrow="Step 2"
              title="Narrative prompt"
              description="Describe the world, lighting, and pacing cues."
              className="bg-transparent"
            >
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70">
                “Midnight Tokyo sprint, neon skyline, thunderstorm at peak climb.”
              </div>
            </SurfaceCard>
          </div>
        </SurfaceCard>

        <SurfaceCard
          eyebrow="Step 3"
          title="Effort mapping"
          description="Translate HR zones to route segments and story beats."
        >
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { label: "Warm-up", detail: "Zone 2 • 8 min" },
              { label: "Climb", detail: "Zone 4 • 12 min" },
              { label: "Sprint", detail: "Zone 5 • 4 min" },
            ].map((segment) => (
              <div
                key={segment.label}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {segment.label}
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  {segment.detail}
                </p>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard
          eyebrow="Step 4"
          title="Publish to class"
          description="Attach the world to a SpinClass and sync reward targets."
        >
          <SectionHeader
            eyebrow="Publish"
            title="Ready for instructor approval"
            description="Save the world and attach it to your next class."
            actions={
              <>
                <button className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white/70 transition hover:text-white">
                  Save draft
                </button>
                <button className="rounded-full bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20">
                  Publish world
                </button>
              </>
            }
          />
          <div className="mt-6">
            <BulletList items={steps} />
          </div>
        </SurfaceCard>
      </main>
    </div>
  );
}
