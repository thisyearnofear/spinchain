"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import type { CatmullRomCurve3 } from "three";
import {
  buildNeonSkylineGeometry,
  createNeonSkyGeometry,
  createNeonSkylineMaterial,
  createNeonSkyMaterial,
} from "./neon-atmosphere";

/**
 * Neon sky and skyline. Geometry and materials are created once per route.
 * Fog color and zenith are uniform writes when the theme haze changes —
 * no frame callback, no per-mesh walk.
 */
export function NeonAtmosphere({
  curve,
  horizon,
  zenith,
}: {
  curve: CatmullRomCurve3;
  horizon: string;
  zenith: string;
}) {
  const skylineGeometry = useMemo(() => buildNeonSkylineGeometry(curve), [curve]);
  const skyGeometry = useMemo(() => createNeonSkyGeometry(), []);
  // Built once. Later haze and zenith changes write the existing uniforms.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const skyMaterial = useMemo(() => createNeonSkyMaterial(zenith, horizon), []);
  const skylineMaterial = useMemo(() => createNeonSkylineMaterial(), []);

  useLayoutEffect(() => {
    skyMaterial.uniforms.uHorizon.value.set(horizon);
    skyMaterial.uniforms.uZenith.value.set(zenith);
  }, [skyMaterial, horizon, zenith]);

  useEffect(() => () => {
    skylineGeometry.dispose();
    skyGeometry.dispose();
    skyMaterial.dispose();
    skylineMaterial.dispose();
  }, [skylineGeometry, skyGeometry, skyMaterial, skylineMaterial]);

  return (
    <group name="neon-atmosphere">
      <mesh
        name="neon-sky"
        geometry={skyGeometry}
        material={skyMaterial}
        frustumCulled={false}
        renderOrder={-1}
      />
      <mesh name="neon-skyline" geometry={skylineGeometry} material={skylineMaterial} frustumCulled={false} />
    </group>
  );
}
