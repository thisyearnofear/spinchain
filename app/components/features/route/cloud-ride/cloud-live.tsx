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

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { CatmullRomCurve3 } from "three";
import { visualEffort } from "@/app/lib/ride-effort";
import { dampFactor } from "@/app/lib/progress-interpolator";
import { CloudRoad, CloudWorldScene } from "./cloud-world";
import { RideAirfield } from "./ride-airfield";
import { cloudWarmth, cloudAtmosphere } from "./cloud-atmosphere";

/** Fixed warmth floor — the ride has no scripted reveal; effort adds a little. */
const CLOUD_WARMTH_BASE = 0.3;
const CLOUD_WARMTH_EFFORT = 0.25;

export function CloudLiveWorld({
  curve,
  stats,
  progressRef,
  reducedMotion,
  tier = "high",
}: {
  curve: CatmullRomCurve3;
  stats: { power: number; intensity: number };
  /** The rider's route fraction — the same ref the rider and camera read. */
  progressRef: MutableRefObject<number>;
  reducedMotion: boolean;
  /** Render tier — sizes the grain pool. */
  tier?: "high" | "medium" | "low";
}) {
  // Arc length once per curve — the grain corridor converts station to `u`.
  const curveLength = useMemo(() => curve.getLength(), [curve]);
  const timeRef = useRef(0);
  const effortRef = useRef(0);
  const warmthRef = useRef(CLOUD_WARMTH_BASE);
  // The atmosphere's own controls — what version of the sky this stretch of
  // route is. Driven from progress, so the ride passes through its chapters
  // instead of sitting inside one.
  const airRef = useRef(0);
  const vistaRef = useRef(0);
  const statsRef = useRef(stats);
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useFrame((state, delta) => {
    timeRef.current = state.clock.elapsedTime;
    // Live effort, damped so 10Hz telemetry commits don't flicker the pulse.
    const target = Math.min(1, visualEffort(statsRef.current.intensity));
    effortRef.current += (target - effortRef.current) * dampFactor(4, delta);
    const progress = progressRef.current;
    const atmo = cloudAtmosphere(progress);
    airRef.current = atmo.air;
    vistaRef.current = atmo.vista;
    warmthRef.current = cloudWarmth(progress, effortRef.current, CLOUD_WARMTH_BASE, CLOUD_WARMTH_EFFORT);
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
        vistaScaleRef={vistaRef}
      />
      <CloudRoad curve={curve} banked={!reducedMotion} timeRef={timeRef} effortRef={effortRef} />
      {/* Airborne grain: the rider travels *through* the world rather than past
          a backdrop. Stationed on the route, so it can never drift out of step
          with the road under the wheels. */}
      <RideAirfield
        curve={curve}
        curveLength={curveLength}
        progressRef={progressRef}
        warmthRef={warmthRef}
        tier={tier}
        reducedMotion={reducedMotion}
        densityRef={airRef}
      />
    </>
  );
}
