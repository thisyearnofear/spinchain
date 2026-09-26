"use client";

import Link from "next/link";
import { FadeIn, StaggerContainer } from "@/app/components/ui/scroll-animations";
import {
  VISUALIZER_THEMES,
  type VisualizerTheme,
} from "@/app/components/features/route/visualizer-theme";
import { getDemoRideUrl } from "@/app/hooks/evm/use-class-data";

// Mood lines written from each world's real atmosphere token
// (grid / mist / dust / sun / prism in visualizer-theme.ts).
const WORLD_MOODS: Record<VisualizerTheme, string> = {
  neon: "The grid never sleeps",
  alpine: "Climb into the mist",
  mars: "Dust on the horizon",
  anime: "Sunlit, soft-edged roads",
  rainbow: "Every watt splits light",
};

const WORLD_KEYS = Object.keys(VISUALIZER_THEMES) as VisualizerTheme[];

export function WorldsSection() {
  return (
    <FadeIn>
      <section aria-label="Ride worlds">
        <div className="mb-6 md:mb-8">
          <h2 className="text-2xl font-bold text-[color:var(--foreground)] md:text-3xl">
            Five worlds. One road.
          </h2>
          <p className="mt-2 max-w-xl text-sm text-[color:var(--muted)] md:text-base">
            Pick the backdrop. The road underneath reads your effort the same
            way in every one of them.
          </p>
        </div>

        <StaggerContainer
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:pb-0"
          staggerDelay={0.08}
        >
          {WORLD_KEYS.map((key) => {
            const theme = VISUALIZER_THEMES[key];
            return (
              <Link
                key={key}
                href={getDemoRideUrl({ theme: key, name: theme.worldLabel })}
                className="group relative block h-44 w-40 shrink-0 snap-start overflow-hidden rounded-2xl border border-[color:var(--border)] transition-transform duration-150 hover:-translate-y-1 md:h-52 md:w-auto"
                style={{
                  background: `linear-gradient(to bottom, ${theme.skyTop}, ${theme.skyBottom})`,
                }}
              >
                {/* Horizon glow accent from the theme's own token. Sits under
                    the art layer so generated world art covers it cleanly. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-[62%] h-px"
                  style={{
                    background: theme.horizonGlow,
                    boxShadow: `0 0 14px 2px ${theme.horizonGlow}`,
                  }}
                />
                {/* World art layered over the gradient; while art is missing
                    the gradient tile is the honest fallback. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- deliberate: raw img with onError fallback to the gradient tile */}
                <img
                  src={`/images/worlds/${key}.jpg`}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
                  <span className="block text-sm font-bold text-white">
                    {theme.worldLabel}
                  </span>
                  <span className="block text-xs text-white/80">
                    {WORLD_MOODS[key]}
                  </span>
                </span>
              </Link>
            );
          })}
        </StaggerContainer>
      </section>
    </FadeIn>
  );
}
