"use client";

import type { CatmullRomCurve3 } from "three";
import {
  buildNeonSkylineGeometry,
  createNeonSkyGeometry,
  createNeonSkylineMaterial,
  createNeonSkyMaterial,
} from "./neon-atmosphere";
import { ThemeAtmosphere, type AtmosphereKit } from "./theme-atmosphere";

const NEON_KIT: AtmosphereKit = {
  name: "neon",
  horizonName: "skyline",
  buildHorizonGeometry: buildNeonSkylineGeometry,
  createHorizonMaterial: createNeonSkylineMaterial,
  createSkyGeometry: createNeonSkyGeometry,
  createSkyMaterial: createNeonSkyMaterial,
};

/** Neon night sky and skyline. */
export function NeonAtmosphere(props: { curve: CatmullRomCurve3; horizon: string; zenith: string }) {
  return <ThemeAtmosphere kit={NEON_KIT} {...props} />;
}
