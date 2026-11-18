"use client";

import type { CatmullRomCurve3 } from "three";
import {
  createSunsetSkyGeometry,
  createSunsetSkyMaterial,
} from "./sunset-atmosphere";
import { buildNeonSkylineGeometry, createNeonSkylineMaterial } from "./neon-atmosphere";
import { ThemeAtmosphere, type AtmosphereKit } from "./theme-atmosphere";

const SUNSET_KIT: AtmosphereKit = {
  name: "sunset",
  horizonName: "skyline",
  animated: true,
  buildHorizonGeometry: buildNeonSkylineGeometry,
  createHorizonMaterial: createNeonSkylineMaterial,
  createSkyGeometry: createSunsetSkyGeometry,
  createSkyMaterial: createSunsetSkyMaterial,
};

/**
 * The Sunset Ride world: a low fixed sun on the horizon the rider rides
 * into, warm gradient sky, drifting cloud bands on `uTime` (via
 * SkyTimeKeeper), and the shared skyline band as silhouette. Static sky
 * otherwise — no per-frame uniform writes beyond the clock.
 */
export function SunsetAtmosphere({
  curve,
  horizon,
  zenith,
}: {
  curve: CatmullRomCurve3;
  horizon: string;
  zenith: string;
}) {
  return (
    <ThemeAtmosphere kit={SUNSET_KIT} curve={curve} horizon={horizon} zenith={zenith} />
  );
}
