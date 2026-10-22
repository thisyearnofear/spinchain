"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import type { BufferGeometry, CatmullRomCurve3, Material, ShaderMaterial } from "three";
import { SkyTimeKeeper } from "./sky-time-keeper";

/**
 * What a theme supplies to get a sky dome and a horizon band. The sky
 * material must expose `uZenith` / `uHorizon` colour uniforms.
 */
export interface AtmosphereKit {
  name: string;
  horizonName: string;
  /**
   * When true the sky material may expose a `uTime` uniform, which this
   * component advances once per frame. Worlds with moving air (dust bands,
   * aurora ribbons) use it; static skies leave it off.
   */
  animated?: boolean;
  /**
   * The horizon band. Returning null means this world has no horizon
   * geometry — the sky dome alone carries the horizon.
   */
  buildHorizonGeometry: (curve: CatmullRomCurve3) => BufferGeometry | null;
  createHorizonMaterial: () => Material;
  createSkyGeometry: () => BufferGeometry;
  createSkyMaterial: (zenith: string, horizon: string) => ShaderMaterial;
}

/**
 * A theme's sky and horizon. Geometry and materials are created once per
 * route; haze and zenith changes are uniform writes — no frame callback,
 * no per-mesh walk.
 */
export function ThemeAtmosphere({
  kit,
  curve,
  horizon,
  zenith,
}: {
  kit: AtmosphereKit;
  curve: CatmullRomCurve3;
  horizon: string;
  zenith: string;
}) {
  const horizonGeometry = useMemo(() => kit.buildHorizonGeometry(curve), [kit, curve]);
  const skyGeometry = useMemo(() => kit.createSkyGeometry(), [kit]);
  // Built once per kit. Later haze and zenith changes write the existing uniforms.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const skyMaterial = useMemo(() => kit.createSkyMaterial(zenith, horizon), [kit]);
  const horizonMaterial = useMemo(() => kit.createHorizonMaterial(), [kit]);

  useLayoutEffect(() => {
    skyMaterial.uniforms.uHorizon.value.set(horizon);
    skyMaterial.uniforms.uZenith.value.set(zenith);
  }, [skyMaterial, horizon, zenith]);

  useEffect(() => () => {
    horizonGeometry?.dispose();
    skyGeometry.dispose();
    skyMaterial.dispose();
    horizonMaterial.dispose();
  }, [horizonGeometry, skyGeometry, skyMaterial, horizonMaterial]);

  return (
    <group name={`${kit.name}-atmosphere`}>
      {kit.animated === true ? (
        <SkyTimeKeeper material={skyMaterial} />
      ) : null}
      <mesh
        name={`${kit.name}-sky`}
        geometry={skyGeometry}
        material={skyMaterial}
        frustumCulled={false}
        renderOrder={-1}
      />
      {horizonGeometry ? (
        <mesh
          name={`${kit.name}-${kit.horizonName}`}
          geometry={horizonGeometry}
          material={horizonMaterial}
          frustumCulled={false}
        />
      ) : null}
    </group>
  );
}
