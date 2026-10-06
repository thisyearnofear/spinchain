"use client";

import type { CatmullRomCurve3 } from "three";
import {
  buildAlpineHorizonGeometry,
  createAlpineRidgeMaterial,
  createAlpineSkyGeometry,
  createAlpineSkyMaterial,
} from "./alpine-atmosphere";
import { ThemeAtmosphere, type AtmosphereKit } from "./theme-atmosphere";

const ALPINE_KIT: AtmosphereKit = {
  name: "alpine",
  horizonName: "ridge",
  buildHorizonGeometry: buildAlpineHorizonGeometry,
  createHorizonMaterial: createAlpineRidgeMaterial,
  createSkyGeometry: createAlpineSkyGeometry,
  createSkyMaterial: createAlpineSkyMaterial,
};

/** Alpine sky and ridge. */
export function AlpineAtmosphere(props: { curve: CatmullRomCurve3; horizon: string; zenith: string }) {
  return <ThemeAtmosphere kit={ALPINE_KIT} {...props} />;
}
