"use client";

import dynamic from "next/dynamic";
import { memo, Suspense } from "react";
import type { VisualizerTheme } from "@/app/components/features/route/route-visualizer";
import type { StoryBeat } from "@/app/components/features/route/route-visualizer";
import type { RenderMode } from "@/app/engines/types";

// Dynamic import — R3F bundle is heavy and only loaded when needed
const RouteVisualizer = dynamic(
  () => import("@/app/components/features/route/route-visualizer"),
  { ssr: false },
);

export interface TronRendererProps {
  mode: "preview" | "ride" | "finished";
  progress: number;
  routeElevationProfile: number[];
  routeCoordinates: Array<{ lat: number; lng: number; ele?: number }>;
  currentRouteCoordinate: { lat: number; lng: number; ele?: number } | null;
  telemetry: { heartRate: number; power: number; cadence: number };
  routeTheme: VisualizerTheme;
  storyBeats: StoryBeat[];
  avatarId?: string;
  equipmentId?: string;
  quality?: "low" | "medium" | "high";
  className?: string;
  userDisplayName?: string;
}

/**
 * TronRenderer — 3D R3F-backed route visualizer.
 *
 * This is a thin adapter around the existing RouteVisualizer component.
 * It owns the lazy-loaded R3F bundle so the application only pays the
 * cost when the Tron renderer is actually selected by the engine.
 */
export const TronRenderer = memo(function TronRenderer(props: TronRendererProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-indigo-400" />
            <span className="text-xs font-mono text-white/40 uppercase tracking-widest">
              Initialising Neural Renderer...
            </span>
          </div>
        </div>
      }
    >
      <RouteVisualizer
        elevationProfile={props.routeElevationProfile}
        theme={props.routeTheme}
        progress={props.progress}
        mode={props.mode}
        stats={{
          hr: props.telemetry.heartRate,
          power: props.telemetry.power,
          cadence: props.telemetry.cadence,
        }}
        storyBeats={props.storyBeats}
        avatarId={props.avatarId}
        equipmentId={props.equipmentId}
        quality={props.quality}
        className={props.className}
        userDisplayName={props.userDisplayName}
      />
    </Suspense>
  );
});
