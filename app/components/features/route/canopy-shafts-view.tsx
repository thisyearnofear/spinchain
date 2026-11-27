"use client";

/**
 * Canopy shafts — one draw call of sun beams coming through a world's canopy.
 *
 * Mounted *outside* the rider group (like the air field), so beam positions are
 * world positions: the group's [0,-10,0] offset is baked into the layout and
 * `cameraPosition` needs no correction. All the geometry work happens once, at
 * mount; while riding, this component writes two uniforms.
 *
 * The quad is billboarded **around the beam axis**, not toward the camera: a
 * beam that turns to face you is a rectangle that swivels. `right` is
 * recomputed per vertex so a shaft seen from any side stays a shaft, and the
 * taper lives in the shader so the narrow end is always at the canopy.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";
import {
  buildShaftLayout,
  shaftAxis,
  shaftCount,
  SHAFT_FAR_IN,
  SHAFT_FAR_OUT,
  SHAFT_NEAR_IN,
  SHAFT_NEAR_OUT,
  type ShaftDeclaration,
} from "./canopy-shafts";
import { WIND_UNIFORMS } from "./wind-material";

const vertexShader = /* glsl */ `
attribute vec3 aBase;
attribute float aWidth;
attribute float aHeight;
attribute float aAlpha;
attribute float aSeed;

uniform vec3 uAxis;
uniform float uNearIn;
uniform float uNearOut;
uniform float uFarIn;
uniform float uFarOut;

varying vec2 vQuad;
varying float vAlpha;
varying float vSeed;

void main() {
  vec3 axis = normalize(uAxis);
  vec3 mid = aBase + axis * (aHeight * 0.5);
  vec3 toCam = normalize(cameraPosition - mid);
  vec3 right = cross(axis, toCam);
  float rl = length(right);
  // Looking straight down a beam: any sideways vector reads the same, so fall
  // back to a stable one rather than normalising a zero vector (NaN vertices
  // silently drop the whole instance).
  right = rl > 1e-4 ? right / rl : normalize(cross(axis, vec3(0.0, 0.0, 1.0)));

  // position.y is 0 at the floor and 1 at the canopy; the beam is widest where
  // it lands, because that is where the light has spread.
  float y = position.y;
  float halfWidth = aWidth * mix(1.0, 0.34, y);
  vec3 world = aBase + axis * (aHeight * y) + right * (position.x * halfWidth);

  vec4 view = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * view;

  float depth = -view.z;
  float visible = smoothstep(uNearIn, uNearOut, depth) * (1.0 - smoothstep(uFarIn, uFarOut, depth));

  vQuad = vec2(position.x, y);
  vAlpha = aAlpha * visible;
  vSeed = aSeed;
}
`;

const fragmentShader = /* glsl */ `
varying vec2 vQuad;
varying float vAlpha;
varying float vSeed;

uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
uniform float uMotion;

void main() {
  // Two edge-ordered ramps (edge0 < edge1) — GLSL leaves smoothstep undefined
  // when they are reversed, and some drivers invert it.
  // A smooth bell across the beam, with no flat core: a flat core turns the
  // shaft into a cream-coloured card, which is the exact tell of a billboard.
  float edge = 1.0 - smoothstep(0.0, 1.0, abs(vQuad.x));
  edge *= edge;
  // Brightest through the middle: the canopy end has to dissolve into the
  // leaves, and the floor end has already spread out.
  float body = smoothstep(0.0, 0.28, vQuad.y) * (1.0 - smoothstep(0.72, 1.0, vQuad.y));
  // Striation: one soft band per beam, drifting down it as the air moves, so a
  // shaft is not a flat card.
  float stripe = 0.78 + 0.22 * sin(vQuad.x * 7.0 + vSeed * 31.0 + uTime * (0.45 * uMotion));
  float alpha = edge * body * stripe * vAlpha * uIntensity;
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

export function CanopyShafts({
  curve,
  declaration,
  keyDirection,
  roadHalfWidth,
  edgeDrop,
  tier,
  reducedMotion,
  intensityRef,
}: {
  curve: CatmullRomCurve3;
  declaration: ShaftDeclaration;
  /** The world's own key light; beams lean along it. */
  keyDirection?: readonly [number, number, number];
  roadHalfWidth: number;
  edgeDrop?: number;
  tier: "high" | "medium" | "low";
  reducedMotion: boolean;
  /** 0..1 gate, for a world that brings its light in with the ride. */
  intensityRef?: { current: number };
}) {
  const count = shaftCount(declaration.count, tier);

  const resources = useMemo(() => {
    const layout = buildShaftLayout({
      curve,
      count,
      halfWidth: roadHalfWidth,
      height: declaration.height,
      width: declaration.width,
      edgeDrop,
    });

    const geo = new InstancedBufferGeometry();
    // `position` is not optional: three sizes the draw call from its count, and
    // an InstancedBufferGeometry without it draws nothing — with no warning.
    const corners: number[] = [];
    for (const [x, y] of [
      [-1, 0],
      [1, 0],
      [1, 1],
      [-1, 0],
      [1, 1],
      [-1, 1],
    ]) {
      corners.push(x, y, 0);
    }
    geo.setAttribute("position", new BufferAttribute(new Float32Array(corners), 3));
    geo.setAttribute("aBase", new InstancedBufferAttribute(layout.bases, 3));
    geo.setAttribute("aWidth", new InstancedBufferAttribute(layout.widths, 1));
    geo.setAttribute("aHeight", new InstancedBufferAttribute(layout.heights, 1));
    geo.setAttribute("aAlpha", new InstancedBufferAttribute(layout.alphas, 1));
    geo.setAttribute("aSeed", new InstancedBufferAttribute(layout.seeds, 1));
    geo.instanceCount = layout.count;
    // Bases are spread over the whole route; the base quad's bounding sphere
    // would cull the field the moment the rider looked away from it.
    geo.boundingSphere = null;

    const axis = shaftAxis(keyDirection);
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      // Beams are seen from inside as often as outside — a rider passes through
      // them, and half a beam is worse than a whole one.
      side: DoubleSide,
      uniforms: {
        uAxis: { value: new Vector3(axis[0], axis[1], axis[2]) },
        uNearIn: { value: SHAFT_NEAR_IN },
        uNearOut: { value: SHAFT_NEAR_OUT },
        uFarIn: { value: SHAFT_FAR_IN },
        uFarOut: { value: SHAFT_FAR_OUT },
        uColor: { value: new Color(declaration.color) },
        uIntensity: { value: declaration.intensity },
        // The same clock the wind runs on: shafts shimmer when the world is
        // already moving, so they cannot sit still in a windy place.
        uTime: WIND_UNIFORMS.uWindTime,
        uMotion: { value: reducedMotion ? 0 : 1 },
      },
    });

    return { geo, material };
  }, [curve, count, roadHalfWidth, declaration, keyDirection, edgeDrop, reducedMotion]);

  const resourcesRef = useRef(resources);
  useEffect(() => {
    resourcesRef.current = resources;
  }, [resources]);

  useEffect(
    () => () => {
      resources.geo.dispose();
      resources.material.dispose();
    },
    [resources],
  );

  const meshRef = useRef<Mesh>(null);
  useFrame(() => {
    if (!meshRef.current || !intensityRef) return;
    const gate = Math.min(1, Math.max(0, intensityRef.current));
    resourcesRef.current.material.uniforms.uIntensity.value = declaration.intensity * gate;
  });

  if (count === 0) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={resources.geo}
      material={resources.material}
      frustumCulled={false}
      renderOrder={3}
    />
  );
}
