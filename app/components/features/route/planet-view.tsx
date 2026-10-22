"use client";

import type { CatmullRomCurve3 } from "three";
import { useMemo } from "react";
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
  // Split out so the hook below is never conditional — the lookup can
  // return nothing, the hook cannot.
  return (
    <PlanetSky
      profile={profile}
      curve={curve}
      horizon={horizon}
      zenith={zenith}
    />
  );
}

function PlanetSky({
  profile,
  curve,
  horizon,
  zenith,
}: {
  profile: PlanetProfile;
  curve: CatmullRomCurve3;
  horizon: string;
  zenith: string;
}) {
  /**
   * The kit is MEMOISED, and that matters more than it looks.
   *
   * `ThemeAtmosphere` builds the sky geometry and the sky material in
   * `useMemo`s keyed on the kit. A kit rebuilt on every render therefore
   * rebuilt the sky every render — a new geometry, a new material, the old
   * one disposed, and the shader program recompiled with it. Three.js's
   * `compileAsync` keeps the disposed material in its warm-up set and then
   * trips over it ("Cannot read properties of undefined (reading
   * 'isReady')"), which is what stopped the render loop on mobile.
   *
   * Alpine and Neon hoist their kits to module constants for the same
   * reason. This one cannot be a constant (it carries the world's profile),
   * but it does not have to depend on the colours either: the zenith and
   * horizon are uniforms, and `ThemeAtmosphere` writes them in place.
   */
  const kit = useMemo<AtmosphereKit>(
    () => ({
      name: profile.name,
      horizonName: profile.horizonName,
      animated: true,
      // `buildHorizonGeometry` returning null means "this world has no
      // horizon ring" — the kit interface allows a null geometry, and
      // ThemeAtmosphere skips the mesh.
      buildHorizonGeometry: (c) =>
        profile.ridge === false ? null : buildPlanetHorizonGeometry(c, profile),
      createHorizonMaterial: createPlanetHorizonMaterial,
      createSkyGeometry: createPlanetSkyGeometry,
      createSkyMaterial: (_z, _h) => createPlanetSkyMaterial(profile, zenith, horizon),
    }),
    // The colours are uniforms — they are written in place, not rebuilt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile],
  );

  return <ThemeAtmosphere kit={kit} curve={curve} horizon={horizon} zenith={zenith} />;
}
