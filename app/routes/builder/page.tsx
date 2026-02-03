"use client";

import { useState } from "react";
import { PrimaryNav } from "../../components/nav";
import {
  BulletList,
  SectionHeader,
  SurfaceCard,
  Tag,
} from "../../components/ui";
import { GpxUploader, type GpxSummary } from "./gpx-uploader";
import RouteVisualizer, {
  type VisualizerTheme,
} from "../../components/route-visualizer";
import { AIRouteGenerator } from "../../components/ai-route-generator";

export default function RouteBuilderPage() {
  const [gpxData, setGpxData] = useState<GpxSummary | null>(null);
  const [currentTheme, setCurrentTheme] = useState<VisualizerTheme>("neon");
  const [routeSource, setRouteSource] = useState<"upload" | "ai">("ai");

  const steps = [
    "Upload GPX or paste route URL",
    "Set narrative prompt + mood",
    "Map effort zones to segments",
    "Preview + publish to class",
  ];

  // Default demo profile if no GPX uploaded
  const defaultProfile = [
    120, 140, 160, 150, 180, 210, 240, 220, 200, 230, 250, 280, 300, 280, 260,
    240, 270, 290, 310,
  ];

  const elevationProfile =
    gpxData && gpxData.elevationProfile.length > 0
      ? gpxData.elevationProfile
      : defaultProfile;

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
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
        </SurfaceCard>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* Left Column: Visualization */}
          <div className="flex flex-col gap-6">
            <div className="relative overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] shadow-2xl">
              <div className="absolute left-6 top-6 z-10 flex gap-2">
                <span className="rounded-full bg-[color:var(--surface-strong)] px-3 py-1 text-xs font-medium text-[color:var(--foreground)] backdrop-blur border border-[color:var(--border)]">
                  {gpxData ? "Custom Route Loaded" : "Demo Preview"}
                </span>
              </div>

              <RouteVisualizer
                elevationProfile={elevationProfile}
                theme={currentTheme}
                storyBeats={gpxData?.storyBeats || []}
                className="h-[450px] w-full"
              />

              <div className="absolute bottom-6 left-6 right-6 z-10 flex flex-wrap justify-center gap-2 rounded-2xl bg-[color:var(--surface-strong)] p-2 backdrop-blur border border-[color:var(--border)]">
                {["neon", "alpine", "mars"].map((theme) => (
                  <button
                    key={theme}
                    onClick={() => setCurrentTheme(theme as VisualizerTheme)}
                    className={`rounded-xl px-4 py-2 text-xs font-medium transition-all ${currentTheme === theme
                        ? "bg-[color:var(--foreground)] text-[color:var(--background)] shadow-lg scale-105"
                        : "bg-transparent text-[color:var(--muted)] hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]"
                      }`}
                  >
                    {theme.charAt(0).toUpperCase() + theme.slice(1)} Mode
                  </button>
                ))}
              </div>
            </div>

            {gpxData && gpxData.storyBeats.length > 0 && (
              <SurfaceCard
                eyebrow="Automated Discovery"
                title="GPX Story Beats"
                description="We've analyzed your route and found these key narrative moments."
              >
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {gpxData.storyBeats.map((beat, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-2 w-2 rounded-full ${beat.type === "climb"
                              ? "bg-yellow-400"
                              : beat.type === "drop"
                                ? "bg-blue-400"
                                : "bg-red-400"
                            }`}
                        />
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--foreground)]">
                            {beat.label}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
                            {beat.type}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-[color:var(--muted)]">
                        {Math.round(beat.progress * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </SurfaceCard>
            )}

            {gpxData && (
              <SurfaceCard
                eyebrow="Effort Mapping"
                title="Zones derived from elevation"
                description="Our algorithm has auto-tagged these segments based on gradient."
              >
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {gpxData.segments.map((segment, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`h-2 w-2 rounded-full ${segment.zone === "Zone 5"
                              ? "bg-red-500"
                              : segment.zone === "Zone 4"
                                ? "bg-orange-500"
                                : "bg-blue-500"
                            }`}
                        />
                        <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">
                          {segment.label}
                        </p>
                      </div>
                      <p className="text-lg font-semibold text-[color:var(--foreground)]">
                        {segment.minutes} min
                      </p>
                      <p className="text-xs text-[color:var(--muted)]">{segment.zone}</p>
                    </div>
                  ))}
                </div>
              </SurfaceCard>
            )}
          </div>

          {/* Right Column: Controls */}
          <div className="flex flex-col gap-6">
            <SurfaceCard
              eyebrow="Step 1"
              title="Route source"
              description="Generate with AI or upload GPX."
              className="bg-[color:var(--surface)]"
            >
              {/* Source Tabs */}
              <div className="mt-4 flex gap-2 p-1 rounded-lg bg-[color:var(--surface-strong)] border border-[color:var(--border)]">
                <button
                  onClick={() => setRouteSource("ai")}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                    routeSource === "ai"
                      ? "bg-[color:var(--surface)] text-[color:var(--foreground)]"
                      : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                  }`}
                >
                  AI Generate
                </button>
                <button
                  onClick={() => setRouteSource("upload")}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
                    routeSource === "upload"
                      ? "bg-[color:var(--surface)] text-[color:var(--foreground)]"
                      : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                  }`}
                >
                  GPX Upload
                </button>
              </div>

              <div className="mt-4">
                {routeSource === "ai" ? (
                  <AIRouteGenerator onRouteGenerated={setGpxData} />
                ) : (
                  <GpxUploader onUpload={setGpxData} />
                )}
              </div>
            </SurfaceCard>

            <SurfaceCard
              eyebrow="Step 2"
              title="Theme & Atmosphere"
              description="Choose your visual style."
              className="bg-[color:var(--surface)]"
            >
              <div className="mt-4 grid grid-cols-3 gap-2">
                {["neon", "alpine", "mars"].map((theme) => (
                  <button
                    key={theme}
                    onClick={() => setCurrentTheme(theme as VisualizerTheme)}
                    className={`rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                      currentTheme === theme
                        ? "bg-[color:var(--surface)] text-[color:var(--foreground)] ring-1 ring-[color:var(--border)]"
                        : "bg-[color:var(--surface-strong)] text-[color:var(--muted)] hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]"
                    }`}
                  >
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </button>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard
              eyebrow="Step 3"
              title="Publish"
              className="bg-transparent border-dashed"
            >
              <SectionHeader
                eyebrow=""
                title="Ready?"
                actions={
                  <div className="flex flex-col w-full gap-3">
                    <button
                      className="w-full rounded-full bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] px-5 py-3 text-sm font-semibold text-[color:var(--foreground)] shadow-lg shadow-indigo-500/20 transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!gpxData}
                    >
                      Save World
                    </button>
                    <BulletList items={steps} />
                  </div>
                }
              />
            </SurfaceCard>
          </div>
        </div>
      </main>
    </div>
  );
}
