import { PrimaryNav } from "../components/nav";
import { BulletList, SectionHeader, SurfaceCard, Tag } from "../components/ui";

export default function RoutesPage() {
  const elevationProfile = [120, 180, 140, 210, 260, 220, 280, 240, 300, 260, 320, 280];
  const worldModes = [
    "GPX route ingestion → elevation + turns",
    "Prompt-driven worlds from instructors",
    "Effort-based pacing (HR zones → speed)",
    "Route replay embeds for proof cards",
  ];

  const upcoming = [
    { title: "Coastal Climb", description: "52 km • 800m gain • sunset palette" },
    { title: "Neo-Grid Sprint", description: "Intervals • synthwave skyline" },
    { title: "Alpine Dawn", description: "40 min endurance • alpine sunrise" },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2550,transparent_55%),radial-gradient(circle_at_80%_20%,#2a1d5a,transparent_40%)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-white/10 bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        <SurfaceCard
          eyebrow="Route Worlds"
          title="Turn GPX routes into immersive class worlds"
          description="Every class can ship with a cinematic narrative world driven by real elevation or creative prompts."
          className="bg-[color:var(--surface-strong)]"
        >
          <div className="mt-6 flex flex-wrap gap-3">
            <Tag>GPX ingest</Tag>
            <Tag>Prompt-to-world</Tag>
            <Tag>Replay ready</Tag>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <BulletList items={worldModes} />
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/80">
              Three.js will power the 3D runtime. For MVP we show a narrative
              preview, then swap in the WebGL scene.
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard
          eyebrow="Elevation Preview"
          title="GPX-derived effort arc"
          description="Upload a GPX route and preview elevation, pacing, and story beats before class."
        >
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Route Profile
              </p>
              <div className="mt-4 h-36 w-full">
                <svg viewBox="0 0 300 120" className="h-full w-full">
                  <defs>
                    <linearGradient id="elevGlow" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#6d7cff" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#9b7bff" stopOpacity="0.8" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M0 ${120 - elevationProfile[0]}
                    ${elevationProfile
                      .map((point, index) => {
                        const x = (index / (elevationProfile.length - 1)) * 300;
                        const y = 120 - point / 3;
                        return `L ${x} ${y}`;
                      })
                      .join(" ")} L 300 120 L 0 120 Z`}
                    fill="url(#elevGlow)"
                    opacity="0.25"
                  />
                  <path
                    d={`M0 ${120 - elevationProfile[0]}
                    ${elevationProfile
                      .map((point, index) => {
                        const x = (index / (elevationProfile.length - 1)) * 300;
                        const y = 120 - point / 3;
                        return `L ${x} ${y}`;
                      })
                      .join(" ")}`}
                    fill="none"
                    stroke="url(#elevGlow)"
                    strokeWidth="2.5"
                  />
                </svg>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/70">
                <Tag>52 km</Tag>
                <Tag>+800m</Tag>
                <Tag>32 min climb</Tag>
              </div>
            </div>
            <div className="space-y-4">
              <SurfaceCard
                eyebrow="Story Beats"
                title="Route + narrative sync"
                description="Auto-tag climaxes, sprints, and recovery zones to cue lighting + audio."
                className="bg-transparent"
              />
              <SurfaceCard
                eyebrow="Pacing"
                title="Effort-targeted segments"
                description="Translate HR zones into in-world velocity for each segment."
                className="bg-transparent"
              />
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard
          eyebrow="Upcoming Worlds"
          title="Instructor curated playlists"
          description="Each world maps to a class, soundtrack, and effort arc."
        >
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {upcoming.map((world) => (
              <div
                key={world.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {world.title}
                </p>
                <p className="mt-3 text-sm text-white/80">{world.description}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard
          eyebrow="Build Path"
          title="MVP → 3D release"
          description="Start with GPX parsing + visual preview, then add runtime worlds."
        >
          <SectionHeader
            eyebrow="Phase 1"
            title="GPX upload + 2D elevation profile"
            description="Confirm routing data + preview story beats."
            actions={
              <>
                <button className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white/70 transition hover:text-white">
                  View spec
                </button>
                <button className="rounded-full bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20">
                  Start world builder
                </button>
              </>
            }
          />
        </SurfaceCard>
      </main>
    </div>
  );
}
