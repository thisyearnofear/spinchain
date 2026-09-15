"use client";

/**
 * WorldSkybox — equirectangular panorama scene background for the route
 * world, produced by the World Labs (Marble) pipeline
 * (scripts/worldlabs/generate-world.mjs).
 *
 * This is the mobile-safe tier of a generated world: one static texture,
 * no per-frame cost beyond the normal scene background. The heavy tiers
 * (GLB mesh, Gaussian splats) are opt-in and recorded in the world's
 * manifest.
 */

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { EquirectangularReflectionMapping, SRGBColorSpace } from "three";

export function WorldSkybox({ url }: { url: string }) {
  const texture = useTexture(url);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    /* eslint-disable react-hooks/immutability --
       three.js interop: texture mapping and scene.background are imperative
       APIs by design; there is no declarative R3F equivalent. */
    texture.mapping = EquirectangularReflectionMapping;
    texture.colorSpace = SRGBColorSpace;
    const previous = scene.background;
    scene.background = texture;
    return () => {
      scene.background = previous;
    };
    /* eslint-enable react-hooks/immutability */
  }, [scene, texture]);

  return null;
}

export default WorldSkybox;
