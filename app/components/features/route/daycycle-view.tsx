"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import type { CatmullRomCurve3, ShaderMaterial } from "three";
import {
  buildNeonSkylineGeometry,
  createNeonSkylineMaterial,
} from "./neon-atmosphere";
import {
  createDaycycleSkyGeometry,
  createDaycycleSkyMaterial,
} from "./daycycle-atmosphere";
import { ThemeAtmosphere, type AtmosphereKit } from "./theme-atmosphere";
import type { RiderStats } from "./route-visualizer";

const DAYCYCLE_KIT: AtmosphereKit = {
  name: "daycycle",
  horizonName: "skyline",
  buildHorizonGeometry: buildNeonSkylineGeometry,
  createHorizonMaterial: createNeonSkylineMaterial,
  createSkyGeometry: createDaycycleSkyGeometry,
  createSkyMaterial: createDaycycleSkyMaterial,
};

/**
 * The only moving part: sustained effort moves the sun up. `uDayProgress`
 * accumulates — a slow ambient drift underneath (the day comes anyway,
 * eventually) and a real climb while the rider is working. Easing off stalls
 * the sun; it never sets. One uniform write per frame, no material rebuild.
 * The sky material is found lazily by name — ThemeAtmosphere creates it in
 * its own memo, so the uniform is reached through the scene, not props.
 */
function DayProgressKeeper({ stats }: { stats: RiderStats }) {
  const scene = useThree((s) => s.scene);
  const dayRef = useRef(0);
  const uniformRef = useRef<{ value: number } | null>(null);

  useFrame((_, delta) => {
    if (!uniformRef.current) {
      const sky = scene.getObjectByName("daycycle-sky") as
        | { material?: ShaderMaterial }
        | undefined;
      uniformRef.current =
        (sky?.material?.uniforms?.uDayProgress as { value: number } | undefined) ?? null;
      if (!uniformRef.current) return;
    }
    const effort = Math.max(0, Math.min(1.2, stats.intensity));
    // ~8.5 min ambient drift, ~90 s of full-tilt riding to dawn.
    dayRef.current = Math.min(1, dayRef.current + delta * (0.002 + 0.011 * effort));
    uniformRef.current.value = dayRef.current;
  });

  return null;
}

/** A skyline lit from dusk to dawn — the rider's effort is the sunrise. */
export function DaycycleAtmosphere({
  curve,
  horizon,
  zenith,
  stats,
}: {
  curve: CatmullRomCurve3;
  horizon: string;
  zenith: string;
  stats: RiderStats;
}) {
  return (
    <>
      <ThemeAtmosphere kit={DAYCYCLE_KIT} curve={curve} horizon={horizon} zenith={zenith} />
      <DayProgressKeeper stats={stats} />
    </>
  );
}
