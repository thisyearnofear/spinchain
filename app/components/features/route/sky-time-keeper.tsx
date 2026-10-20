"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { ShaderMaterial } from "three";
import { usePrefersReducedMotion } from "@/app/hooks/use-prefers-reduced-motion";

/**
 * SkyTimeKeeper — the only frame callback in the atmosphere layer.
 *
 * Worlds with moving air (dust bands on Mars, aurora ribbons on Spectrum
 * Run) expose a `uTime` uniform; this advances it once per frame and
 * freezes it at zero when the rider has asked for reduced motion.
 *
 * It lives in its own file on purpose: the shared atmosphere component
 * stays free of frame callbacks so a static world never pays for one.
 *
 * The uniform is reached through a ref rather than through the prop, so the
 * React Compiler sees a ref write (which it permits) instead of a
 * mutation of a value derived from props (which it rejects).
 */
export function SkyTimeKeeper({
  material,
  enabled = true,
}: {
  material: ShaderMaterial;
  enabled?: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const timeRef = useRef<{ value: number } | null>(null);

  useLayoutEffect(() => {
    const uniform = material.uniforms.uTime as
      | { value: number }
      | undefined;
    timeRef.current = uniform ?? null;
  }, [material]);

  useFrame((state) => {
    if (!enabled) return;
    const uniform = timeRef.current;
    if (!uniform) return;
    uniform.value = reducedMotion ? 0 : state.clock.elapsedTime;
  });

  return null;
}
