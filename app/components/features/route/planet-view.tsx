"use client";

import type { CatmullRomCurve3 } from "three";
import {
  PLANET_PROFILES,
  buildPlanetHorizonGeometry,
  createPlanetHorizonMaterial,
  createPlanetSkyGeometry,
  createPlanetSkyMaterial,
  type PlanetProfile,
} from "./planetary-atmosphere";
import { ThemeAtmosphere, type AtmosphereKit } from "./theme-atmosphere";

/**
 * Planetary worlds — Mars, Toon Valley, Spectrum Run.
 *
 * Each world gets its own profile (palette, silhouette, sky style) but
 * shares one implementation, so adding a sixth world is a profile, not a
 * renderer.
 */
export function PlanetAtmosphere({
  curve,
  horizon,
  zenith,
  world,
}: {
  curve: CatmullRomCurve3;
  horizon: string;
  zenith: string;
  world: string;
}) {
  const profile: PlanetProfile | undefined = PLANET_PROFILES[world];
  if (!profile) return null;

  const kit: AtmosphereKit = {
    name: profile.name,
    horizonName: profile.horizonName,
    animated: true,
    // `buildHorizonGeometry` returning null means "this world has no horizon
    // ring" — the kit interface allows a null geometry, and ThemeAtmosphere
    // skips the mesh.
    buildHorizonGeometry: (c) =>
      profile.ridge === false ? null : buildPlanetHorizonGeometry(c, profile),
    createHorizonMaterial: createPlanetHorizonMaterial,
    createSkyGeometry: createPlanetSkyGeometry,
    createSkyMaterial: (_z, _h) => createPlanetSkyMaterial(profile, zenith, horizon),
  };

  return <ThemeAtmosphere kit={kit} curve={curve} horizon={horizon} zenith={zenith} />;
}
