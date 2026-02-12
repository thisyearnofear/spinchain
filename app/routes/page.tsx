"use client";

import { PrimaryNav } from "../components/layout/nav";
import { BulletList, SectionHeader, SurfaceCard, Tag } from "../components/ui/ui";
import RouteVisualizer, {
  VisualizerTheme,
} from "../components/features/route/route-visualizer";
import { useState } from "react";

export default function RoutesPage() {
  const [currentTheme, setCurrentTheme] = useState<VisualizerTheme>(
    "neon",
  );
  const elevationProfile = [
    120, 180, 140, 210, 260, 220, 280, 240, 300, 260, 320, 280,
  ];
  const worldModes = [
    "GPX route ingestion → elevation + turns",
    "Prompt-driven worlds from instructors",
    "Effort-based pacing (HR zones → speed)",
    "Route replay embeds for proof cards",
  ];

  const upcoming = [
    {
      title: "Coastal Climb",
      description: "52 km • 800m gain • sunset palette",
    },
    { title: "Neo-Grid Sprint", description: "Intervals • synthwave skyline" },
    { title: "Alpine Dawn", description: "40 min endurance • alpine sunrise" },
  ];

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        <SurfaceCard
          eyebrow="Route Worlds"
          title="Turn GPX routes into immersive class worlds"
          description="Every class can ship with a cinematic narrative world driven by real elevation or creative prompts. Choose a theme below."
          className="bg-[color:var(--surface-strong)]"
        >
          <div className="mt-6 flex flex-wrap gap-3">
            {["neon", "alpine", "mars", "anime", "rainbow"].map((theme) => (
              <button
                key={theme}
                onClick={() => setCurrentTheme(theme as VisualizerTheme)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${currentTheme === theme
                    ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                    : "bg-[color:var(--surface-strong)] text-[color:var(--muted)] hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]"
                  }`}
              >
                {theme.charAt(0).toUpperCase() + theme.slice(1)}
              </button>
            ))}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <BulletList items={worldModes} />
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 text-sm text-[color:var(--foreground)]">
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
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Route Profile
                </p>
                <div className="rounded-full bg-[color:var(--surface-strong)] px-2 py-1 text-[10px] uppercase text-[color:var(--muted)]">
                  {currentTheme} mode
                </div>
              </div>
              <div className="mt-4 h-80 w-full overflow-hidden rounded-xl border border-[color:var(--border)]">
                <RouteVisualizer
                  elevationProfile={elevationProfile}
                  theme={currentTheme}
                  storyBeats={[
                    { progress: 0.2, label: "Coastline Drag", type: "sprint", intensity: 8 },
                    { progress: 0.6, label: "Skyline Climb", type: "climb", intensity: 9 },
                  ]}
                  className="h-full"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-[color:var(--muted)]">
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
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {world.title}
                </p>
                <p className="mt-3 text-sm text-[color:var(--foreground)]">
                  {world.description}
                </p>
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
                <button className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]">
                  View spec
                </button>
                <a
                  href="/routes/builder"
                  className="rounded-full bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] px-5 py-2 text-sm font-semibold text-[color:var(--foreground)] shadow-lg shadow-indigo-500/20"
                >
                  Start world builder
                </a>
              </>
            }
          />
        </SurfaceCard>
      </main>
    </div>
  );
}
