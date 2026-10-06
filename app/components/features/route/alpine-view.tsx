"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import type { CatmullRomCurve3 } from "three";
import {
  buildAlpineHorizonGeometry,
  createAlpineRidgeMaterial,
  createAlpineSkyGeometry,
  createAlpineSkyMaterial,
} from "./alpine-atmosphere";

/**
 * Alpine sky and ridge. Geometry and materials are created once per route.
 * Fog color and zenith are uniform writes when effort retints the haze —
 * no frame callback, no per-mesh walk.
 */
export function AlpineAtmosphere({
  curve,
  horizon,
  zenith,
}: {
  curve: CatmullRomCurve3;
  horizon: string;
  zenith: string;
}) {
  const ridgeGeometry = useMemo(() => buildAlpineHorizonGeometry(curve), [curve]);
  const skyGeometry = useMemo(() => createAlpineSkyGeometry(), []);
  // Built once. Later haze and zenith changes write the existing uniforms.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const skyMaterial = useMemo(() => createAlpineSkyMaterial(zenith, horizon), []);
  const ridgeMaterial = useMemo(() => createAlpineRidgeMaterial(), []);

  useLayoutEffect(() => {
    skyMaterial.uniforms.uHorizon.value.set(horizon);
    skyMaterial.uniforms.uZenith.value.set(zenith);
  }, [skyMaterial, horizon, zenith]);

  useEffect(() => () => {
    ridgeGeometry.dispose();
    skyGeometry.dispose();
    skyMaterial.dispose();
    ridgeMaterial.dispose();
  }, [ridgeGeometry, skyGeometry, skyMaterial, ridgeMaterial]);

  return (
    <group name="alpine-atmosphere">
      <mesh
        name="alpine-sky"
        geometry={skyGeometry}
        material={skyMaterial}
        frustumCulled={false}
        renderOrder={-1}
      />
      <mesh name="alpine-ridge" geometry={ridgeGeometry} material={ridgeMaterial} frustumCulled={false} />
    </group>
  );
}
