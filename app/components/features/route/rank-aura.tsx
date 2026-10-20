"use client";

/**
 * RankAura — the ladder's cosmetic payoff, rendered in the world.
 *
 * Every rank grants an aura tier (`progression.ts: RANKS[n].aura`) that was
 * declared but never drawn. This closes the progression → cosmetic loop the
 * same way Bruno Simon's portfolio pays achievements out as vehicle skins:
 * the reward lives where the rider spends their time.
 *
 * Presentation, deliberately modest — the rider is the subject, not their
 * decoration:
 *  - ember: a warm shimmer above the road halo,
 *  - flow:  sparkles begin to orbit,
 *  - surge: + a vertical light pillar,
 *  - apex:  + a taller pillar and a second counter-orbit.
 *
 * Colors come from the rank itself (identity), never the theme.
 * Costs: two fire-and-forget sparkle systems + one additive cylinder at
 * most; the tier only changes at rank-up moments, so buffers never churn.
 */

import { useRef } from "react";
import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group, Mesh, MeshBasicMaterial } from "three";

import type { AuraTier } from "@/app/lib/progression";

const TIER_SPECS: Record<
  Exclude<AuraTier, "none">,
  { count: number; speed: number; size: number; opacity: number; pillar: number }
> = {
  ember: { count: 16, speed: 0.35, size: 2.6, opacity: 0.45, pillar: 0 },
  flow: { count: 26, speed: 0.6, size: 3, opacity: 0.55, pillar: 0 },
  surge: { count: 34, speed: 0.75, size: 3.2, opacity: 0.6, pillar: 2.3 },
  apex: { count: 44, speed: 0.9, size: 3.4, opacity: 0.65, pillar: 2.9 },
};

export function RankAura({
  tier,
  color,
  cadenceRef,
}: {
  tier: AuraTier;
  /** The rank's primary accent — aura shares the emblem's identity. */
  color: string;
  /** Live cadence (rad/s math kept inside); the aura breathes with it. */
  cadenceRef: { current: number };
}) {
  const pillarRef = useRef<Mesh>(null);
  const orbitRef = useRef<Group>(null);

  const spec = tier === "none" ? null : TIER_SPECS[tier];

  useFrame((state, delta) => {
    if (!spec) return;
    // Counter-orbit for apex: a second layer that disagrees with the first.
    if (orbitRef.current) {
      orbitRef.current.rotation.y -= Math.max(0.15, cadenceRef.current / 60) * delta * 1.4;
    }
    if (pillarRef.current) {
      const mat = pillarRef.current.material as MeshBasicMaterial;
      const breathe =
        1 + Math.sin(state.clock.elapsedTime * (Math.max(cadenceRef.current, 35) / 18)) * 0.16;
      mat.opacity = spec.opacity * 0.22 * breathe;
    }
  });

  if (!spec) return null;

  return (
    <group position={[0, 1.15, 0]}>
      {/* Primary orbit. Fixed integer scale: Sparkles reallocates its buffer
          when a prop changes size-class, and fractional scales made the
          positions nondeterministic between runs. */}
      <Sparkles
        count={spec.count}
        scale={[2.4, 1.2, 2.4]}
        size={spec.size}
        speed={spec.speed}
        color={color}
        opacity={spec.opacity}
      />
      {tier === "apex" && (
        <group ref={orbitRef}>
          <Sparkles
            count={18}
            scale={[1.5, 0.9, 1.5]}
            size={spec.size * 0.75}
            speed={spec.speed * 1.2}
            color={color}
            opacity={spec.opacity * 0.8}
          />
        </group>
      )}
      {spec.pillar > 0 && (
        <mesh ref={pillarRef} position={[0, spec.pillar / 2 - 0.4, 0]}>
          <cylinderGeometry args={[0.85, 1.25, spec.pillar, 20, 1, true]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={spec.opacity * 0.22}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}
