"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import RouteVisualizer from "@/app/components/features/route/route-visualizer";
import { generateRouteData, createPracticeClassMetadata } from "@/app/hooks/evm/use-class-data";
import type { VisualizerTheme } from "@/app/components/features/route/visualizer-theme";

/**
 * Dedicated visual harness route — no wallet, no coordinator, deterministic.
 *
 * Used by Playwright visual regression to get stable screenshots without
 * WalletConnect indexedDB SSR flake. Driven by ?state= and ?seed= via
 * window.__THREE_GAME_TEST_HOOKS__ or directly via search params.
 *
 * States mirror lib/test-hooks.ts: preview, active-play, finished
 */
export default function TestHarnessRouteVisualizerPage() {
  const searchParams = useSearchParams();
  const state = searchParams.get("testState") || searchParams.get("state") || "preview";
  const seed = Number(searchParams.get("seed") || "123");
  const theme = (searchParams.get("theme") as VisualizerTheme) || "neon";

  // Deterministic route — same for all harness states so diffs are only visual state, not route
  const { route, elevationProfile } = useMemo(() => {
    const metadata = createPracticeClassMetadata(
      {
        name: "Harness Test Route",
        date: new Date(2026, 0, 1).toISOString(),
        capacity: 20,
        basePrice: 0,
        maxPrice: 0,
        curveType: "linear",
        rewardThreshold: 150,
        rewardAmount: 10,
        suiPerformance: true,
        aiEnabled: false,
        aiPersonality: "zen",
      },
      {
        name: "Harness Route",
        distance: 15,
        duration: 45,
        elevationGain: 300,
        theme: "neon",
        storyBeatsCount: 4,
      },
      "0x0000000000000000000000000000000000000000",
    );
    const r = generateRouteData(metadata);
    const elevationProfile = r.route.coordinates.map((c) => c.ele || 0);
    return { route: r, elevationProfile };
  }, []);

  const progressMap: Record<string, number> = {
    preview: 0,
    "active-play": 0.5,
    "active-play-desktop": 0.5,
    "active-play-mobile": 0.5,
    finished: 1,
  };
  const progress = progressMap[state] ?? 0;

  const modeMap: Record<string, "preview" | "ride" | "finished"> = {
    preview: "preview",
    "active-play": "ride",
    "active-play-desktop": "ride",
    "active-play-mobile": "ride",
    finished: "finished",
  };
  const mode = modeMap[state] ?? "preview";

  // Deterministic stats per state
  const stats = useMemo(() => {
    if (state === "finished") return { hr: 172, power: 280, cadence: 96 };
    if (state.startsWith("active-play")) return { hr: 165, power: 240, cadence: 90 };
    return { hr: 0, power: 0, cadence: 0 };
  }, [state]);

  return (
    <div className="fixed inset-0 bg-black">
      <RouteVisualizer
        elevationProfile={elevationProfile}
        theme={theme}
        progress={progress}
        mode={mode}
        stats={stats}
        storyBeats={route.route.storyBeats ?? []}
        className="h-full w-full"
        quality="high"
        flowTier={state.startsWith("active-play") ? 2 : 0}
        intervalPhase={state.startsWith("active-play") ? "interval" : null}
      />
      {/* Harness label — hidden for screenshots via data-hide-debug-ui */}
      <div className="absolute top-2 left-2 rounded bg-black/60 px-2 py-1 text-[10px] font-mono text-white/60 pointer-events-none">
        harness:{state} seed:{seed} theme:{theme}
      </div>
    </div>
  );
}
