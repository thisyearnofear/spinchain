"use client";

/**
 * Cloud live world — the authored Cloud Kingdom inside the production
 * visualizer.
 *
 * The art is exactly what /test-harness/cloud-ride authored (sculpted banked
 * ribbon, metaball cumulus, sky shader, wisps, pulse piping) — only the
 * driver differs: instead of a 45s scripted clock, the world reads the ride's
 * frame clock, the rider's real route progress, and live effort
 * (`visualEffort`, the same 0–1 the rest of the world reactivity uses).
 */

import { useEffect, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { CatmullRomCurve3 } from "three";
import { visualEffort } from "@/app/lib/ride-effort";
import { dampFactor } from "@/app/lib/progress-interpolator";
import { CloudRoad, CloudWorldScene } from "./cloud-world";

/** Fixed warmth floor — the ride has no scripted reveal; effort adds a little. */
const CLOUD_WARMTH_BASE = 0.3;
const CLOUD_WARMTH_EFFORT = 0.25;

export function CloudLiveWorld({
  curve,
  stats,
  progressRef,
  reducedMotion,
}: {
  curve: CatmullRomCurve3;
  stats: { power: number; intensity: number };
  /** The rider's route fraction — the same ref the rider and camera read. */
  progressRef: MutableRefObject<number>;
  reducedMotion: boolean;
}) {
  const timeRef = useRef(0);
  const effortRef = useRef(0);
  const warmthRef = useRef(CLOUD_WARMTH_BASE);
  const statsRef = useRef(stats);
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useFrame((state, delta) => {
    timeRef.current = state.clock.elapsedTime;
    // Live effort, damped so 10Hz telemetry commits don't flicker the pulse.
    const target = Math.min(1, visualEffort(statsRef.current.intensity));
    effortRef.current += (target - effortRef.current) * dampFactor(4, delta);
    warmthRef.current = CLOUD_WARMTH_BASE + effortRef.current * CLOUD_WARMTH_EFFORT;
  }, -3);

  return (
    <>
      <CloudWorldScene
        curve={curve}
        timeRef={timeRef}
        progressRef={progressRef}
        effortRef={effortRef}
        warmthRef={warmthRef}
        reducedMotion={reducedMotion}
      />
      <CloudRoad curve={curve} banked={!reducedMotion} timeRef={timeRef} effortRef={effortRef} />
    </>
  );
}
