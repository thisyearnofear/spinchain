"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import type { BufferGeometry, CatmullRomCurve3, Material, ShaderMaterial } from "three";

/**
 * What a theme supplies to get a sky dome and a horizon band. The sky
 * material must expose `uZenith` / `uHorizon` colour uniforms.
 */
export interface AtmosphereKit {
  name: string;
  horizonName: string;
  buildHorizonGeometry: (curve: CatmullRomCurve3) => BufferGeometry;
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
    horizonGeometry.dispose();
    skyGeometry.dispose();
    skyMaterial.dispose();
    horizonMaterial.dispose();
  }, [horizonGeometry, skyGeometry, skyMaterial, horizonMaterial]);

  return (
    <group name={`${kit.name}-atmosphere`}>
      <mesh
        name={`${kit.name}-sky`}
        geometry={skyGeometry}
        material={skyMaterial}
        frustumCulled={false}
        renderOrder={-1}
      />
      <mesh
        name={`${kit.name}-${kit.horizonName}`}
        geometry={horizonGeometry}
        material={horizonMaterial}
        frustumCulled={false}
      />
    </group>
  );
}
