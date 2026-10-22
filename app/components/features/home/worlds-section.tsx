"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { FadeIn, StaggerContainer } from "@/app/components/ui/scroll-animations";
import {
  VISUALIZER_THEMES,
  type VisualizerTheme,
} from "@/app/components/features/route/visualizer-theme";
import { getDemoRideUrl } from "@/app/hooks/evm/use-class-data";
import { useWorldAccess } from "@/app/lib/progression";
import { formatXp } from "@/app/lib/progression";

// Mood lines written from each world's real atmosphere token
// (grid / mist / dust / sun / prism in visualizer-theme.ts).
const WORLD_MOODS: Record<VisualizerTheme, string> = {
  neon: "The grid never sleeps",
  alpine: "Climb into the mist",
  mars: "Dust on the horizon",
  anime: "Sunlit, soft-edged roads",
  rainbow: "Every watt splits light",
  cloud: "Cuddle up to the cumulus",
};

const WORLD_KEYS = Object.keys(VISUALIZER_THEMES) as VisualizerTheme[];

export function WorldsSection() {
  const { isUnlocked, unlockFor, xpRemainingFor, rank, hasRidden } =
    useWorldAccess();

  return (
    <FadeIn>
      <section aria-label="Ride worlds">
        <div className="mb-6 md:mb-8">
          <h2 className="text-2xl font-bold text-[color:var(--foreground)] md:text-3xl">
            {WORLD_KEYS.length} worlds. One road.
          </h2>
          <p className="mt-2 max-w-xl text-sm text-[color:var(--muted)] md:text-base">
            Pick the backdrop. The road underneath reads your effort the same
            way in every one of them. New worlds open as you climb the ladder.
          </p>
        </div>

        <StaggerContainer
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:pb-0"
          staggerDelay={0.08}
        >
          {WORLD_KEYS.map((key) => {
            const theme = VISUALIZER_THEMES[key];
            const unlocked = isUnlocked(key);
            const unlock = unlockFor(key);
            const remaining = xpRemainingFor(key);

            return (
              <Link
                key={key}
                href={getDemoRideUrl({ theme: key, name: theme.worldLabel })}
                className="group relative block h-44 w-40 shrink-0 snap-start overflow-hidden rounded-2xl border border-[color:var(--border)] transition-transform duration-150 hover:-translate-y-1 md:h-52 md:w-auto"
                style={{
                  background: `linear-gradient(to bottom, ${theme.skyTop}, ${theme.skyBottom})`,
                }}
                aria-label={
                  unlocked
                    ? `Ride in ${theme.worldLabel}`
                    : `${theme.worldLabel} — unlocks at rank ${(unlock?.rankIndex ?? 0) + 1}`
                }
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

                {!unlocked ? (
                  <>
                    {/* Locked: desaturate the art and say exactly what it
                        takes to open it. */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(4,6,12,0.55) 0%, rgba(4,6,12,0.86) 100%)",
                        backdropFilter: "saturate(0.35) brightness(0.7)",
                      }}
                    />
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="flex flex-col items-center gap-1.5">
                        <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/50">
                          <Lock className="h-4 w-4 text-white/70" aria-hidden="true" />
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/70">
                          Rank {(unlock?.rankIndex ?? 0) + 1}
                        </span>
                      </span>
                    </span>
                  </>
                ) : null}

                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-8">
                  <span className="block text-sm font-bold text-white">
                    {theme.worldLabel}
                  </span>
                  <span className="block text-xs text-white/80">
                    {unlocked
                      ? WORLD_MOODS[key]
                      : `${formatXp(remaining)} XP to unlock`}
                  </span>
                </span>

                {unlocked && rank.index > 0 ? (
                  <span
                    className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                    style={{
                      background: "rgba(0,0,0,0.55)",
                      color: rank.color,
                    }}
                  >
                    {hasRidden(key) ? "Ridden" : "Open"}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </StaggerContainer>
      </section>
    </FadeIn>
  );
}
