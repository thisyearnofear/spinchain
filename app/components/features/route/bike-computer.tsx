"use client";

/**
 * Diegetic bike readout — roadmap P1 #10.
 *
 * A stem-top bike computer carries the *flavour* in-world: the interval target
 * and the flow tier read on a small screen at the bars, with the tier projected
 * as a floating chip above it. The DOM HUD keeps carrying the *facts* (power
 * ranges, cadence bands, remaining time) — the world becomes the primary
 * display and the overlay the accessible secondary.
 *
 * Three constraints, pulled from two scars on RiderMarker:
 *
 * 1. The HoloHUD was removed because its point light (intensity 50) bloomed
 *    into a white blob over the rider and it sat between camera and cyclist.
 *    So: no scene lights, no emissive meshes — the projection is drei <Html>
 *    (DOM above the post stack, identical grammar to the YOU label), and even
 *    the device's face is a dim unlit plane.
 * 2. Nothing per-frame. The pill only changes content on tier/interval
 *    transitions (rare) and holds no refs. `buildReadout` is pure and unit-tested.
 * 3. The facts live in the DOM HUD — this component never reads live
 *    telemetry: it renders what the coaching store committed and the flow
 *    engine escalated, and nothing else.
 */

import { Html } from "@react-three/drei";
import { FLOW_LABELS, FLOW_COLORS, type FlowStateTier } from "@/app/lib/flow-state";

/** What the coaching store stores: a [min, max] watt range (the workout-plan
 *  type), or a bare number (the test harness casts one straight in). */
export type IntervalTargetPower = [number, number] | number | null;

export interface BikeReadout {
  /** The interval headline, e.g. "245 W" — or "FREE RIDE" with no target. */
  headline: string;
  /** Flow-tier label; tier 0 (baseline) reads "STEADY". */
  tierLabel: string;
  /** Tier accent; falls back to the rider's own color at tier 0. */
  accent: string;
}

export function buildReadout(
  targetPower: IntervalTargetPower,
  flowTier: FlowStateTier,
  fallbackAccent: string,
): BikeReadout {
  const headline =
    targetPower == null
      ? "FREE RIDE"
      : Array.isArray(targetPower)
        ? `${Math.round((targetPower[0] + targetPower[1]) / 2)} W`
        : `${Math.round(targetPower)} W`;
  const tierLabel = FLOW_LABELS[flowTier] || "STEADY";
  const accent = FLOW_COLORS[flowTier] || fallbackAccent;
  return { headline, tierLabel, accent };
}

export interface BikeComputerProps {
  /** Current interval's target power (coaching store), null for free rides. */
  targetPower: IntervalTargetPower;
  /** Live flow tier (0–4). */
  flowTier: FlowStateTier;
  /** Rider accent from the theme — the tier-0 fallback accent. */
  fallbackColor: string;
  /** Project the tier chip above the device? Low tier keeps the device only. */
  projected: boolean;
}

export function BikeComputer({ targetPower, flowTier, fallbackColor, projected }: BikeComputerProps) {
  const { headline, tierLabel, accent } = buildReadout(targetPower, flowTier, fallbackColor);

  return (
    <group position={[0, 1.44, 0.52]} rotation={[-0.5, 0, 0]}>
      {/* Stem-top computer body + face, one tilted assembly: rig space
          +Z is forward, and the chase camera reads the device from behind,
          above — so the assembly's top tips back. The face sits on the -Z
          side, which the tilt turns up toward the rider and the camera.
          No emissive anywhere: the bloom lesson. */}
      <mesh>
        <boxGeometry args={[0.17, 0.115, 0.03]} />
        <meshStandardMaterial color="#0b0f19" roughness={0.45} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0, -0.0165]}>
        <planeGeometry args={[0.14, 0.082]} />
        <meshBasicMaterial color={accent} transparent opacity={0.5} toneMapped={false} />
      </mesh>

      {projected && (
        /* Projected tier chip — the computer's hologram. Same DOM grammar as
           the YOU label; sits at the bars while YOU owns 2.7. Static: no
           animation, reduced-motion hosts nothing to disable. */
        <Html position={[0, 0.34, 0.06]} center transform sprite distanceFactor={6} zIndexRange={[5, 0]} className="pointer-events-none">
          <div
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-black/70 px-2 py-1 border shadow-lg pointer-events-none"
            style={{ borderColor: `${accent}55` }}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: accent, boxShadow: `0 0 6px ${accent}` }} />
            <span className="text-[10px] font-semibold tracking-widest" style={{ color: accent }}>
              {tierLabel}
            </span>
            <span className="text-[10px] text-white/40">·</span>
            <span className="text-[11px] font-bold text-white tabular-nums">{headline}</span>
          </div>
        </Html>
      )}
    </group>
  );
}
