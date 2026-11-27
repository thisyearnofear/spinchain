"use client";

/**
 * Canopy shafts, rendered as volumes.
 *
 * Each beam is a box bounding one cylindrical light column; the fragment shader
 * intersects the view ray with that column and integrates the column's density
 * along it. Nothing in here depends on where the camera is looking from, which
 * is the whole point: the billboard version this replaces foreshortened into
 * slivers from a near-overhead camera, and brightened to a flat card when the
 * rider rode straight at it.
 *
 * Consequences of being a volume, all intended:
 *  - looking down a beam's axis *brightens* it, because the ray stays inside it
 *    for longer (Beer–Lambert, so it saturates instead of blowing out),
 *  - beams behind terrain are occluded by it, since boxes depth-test,
 *  - additive blending needs no sorting: light adds in any order.
 *
 * Cost control: the step count is a compile-time define per performance tier,
 * and the beam count comes from the world's declaration capped by the tier. The
 * only per-frame writes are the shared wind clock and the intensity gate.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  DoubleSide,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Mesh,
  ShaderMaterial,
} from "three";
import {
  buildShaftLayout,
  buildShaftVolume,
  shaftAxis,
  shaftCount,
  SHAFT_FAR_IN,
  SHAFT_FAR_OUT,
  SHAFT_NEAR_IN,
  SHAFT_NEAR_OUT,
  type ShaftDeclaration,
  type ShaftVolume,
} from "./canopy-shafts";
import { WIND_UNIFORMS } from "./wind-material";

const vertexShader = /* glsl */ `
attribute vec3 aBase;
attribute vec3 aAxis;
attribute float aHeight;
attribute float aWidth;
attribute float aAlpha;
attribute float aSeed;

varying vec3 vWorld;
varying vec3 vBase;
varying vec3 vAxis;
varying float vHeight;
varying float vWidth;
varying float vAlpha;
varying float vSeed;

void main() {
  vWorld = position;
  vBase = aBase;
  vAxis = aAxis;
  vHeight = aHeight;
  vWidth = aWidth;
  vAlpha = aAlpha;
  vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

varying vec3 vWorld;
varying vec3 vBase;
varying vec3 vAxis;
varying float vHeight;
varying float vWidth;
varying float vAlpha;
varying float vSeed;

uniform vec3 uColor;
uniform float uIntensity;
uniform float uDensity;
uniform float uTime;
uniform float uMotion;
uniform float uNearIn;
uniform float uNearOut;
uniform float uFarIn;
uniform float uFarOut;

void main() {
  vec3 axis = normalize(vAxis);
  vec3 rayOrigin = cameraPosition;
  vec3 dir = normalize(vWorld - rayOrigin);

  // Ray against the beam's column: doing the intersection here (rather than
  // trusting the box) is what lets the volume be soft at its edges.
  vec3 oc = rayOrigin - vBase;
  float alongDir = dot(dir, axis);
  vec3 dirPerp = dir - axis * alongDir;
  vec3 ocPerp = oc - axis * dot(oc, axis);

  float sOrigin = dot(oc, axis);
  float perpOrigin = dot(ocPerp, ocPerp);
  // Inside the column: the camera is in the light. Nearby shafts are wide
  // enough to ride through, and a beam that vanishes as you enter reads as a
  // bug — so the near/far face choice below flips to keep drawing it.
  bool inside = perpOrigin < vWidth * vWidth && sOrigin > 0.0 && sOrigin < vHeight;

  float a = dot(dirPerp, dirPerp);
  float t0;
  float t1;
  if (a < 1e-5) {
    // Looking straight down the beam: the quadratic degenerates, and this is
    // exactly the case a billboard could not draw.
    if (perpOrigin > vWidth * vWidth) discard;
    t0 = 0.0;
    t1 = 1e6;
  } else {
    float b = 2.0 * dot(dirPerp, ocPerp);
    float c = perpOrigin - vWidth * vWidth;
    float disc = b * b - 4.0 * a * c;
    if (disc <= 0.0) discard;
    float root = sqrt(disc);
    t0 = (-b - root) / (2.0 * a);
    t1 = (-b + root) / (2.0 * a);
  }

  // Clip to the column's own length, so a beam starts on the floor and stops at
  // the canopy instead of running to infinity.
  if (abs(alongDir) > 1e-4) {
    float tLow = (0.0 - sOrigin) / alongDir;
    float tHigh = (vHeight - sOrigin) / alongDir;
    t0 = max(t0, min(tLow, tHigh));
    t1 = min(t1, max(tLow, tHigh));
  }
  t0 = max(t0, 0.0);
  if (t1 <= t0) discard;

  // Exactly one fragment per pixel: the near face when the camera is outside the
  // beam, the far face when it is inside. Both would count the same light
  // twice; near-only hides the beam from above, where the far face of a column
  // standing on the ground is under the ground.
  //
  // Which face this fragment is on is decided by distance, not by
  // gl_FrontFacing: three's projection flips handedness, so the flag is not a
  // reliable "facing the camera" test and relying on it silently drew the far
  // faces only — every beam invisible under a high camera.
  float tFragment = distance(vWorld, rayOrigin);
  bool nearFace = abs(tFragment - t0) <= abs(tFragment - t1);
  if (!inside && !nearFace) discard;
  if (inside && nearFace) discard;

  // Fades ride the ray, not the quad: a beam is faded by how far the light it
  // crosses actually is, so walking into one does not pop it.
  float visible = smoothstep(uNearIn, uNearOut, t0) * (1.0 - smoothstep(uFarIn, uFarOut, t1));
  if (visible <= 0.001) discard;

  float stepSize = (t1 - t0) / float(STEPS);
  float acc = 0.0;
  for (int i = 0; i < STEPS; i++) {
    float t = t0 + (float(i) + 0.5) * stepSize;
    vec3 p = rayOrigin + dir * t;
    vec3 rel = p - vBase;
    float s = clamp(dot(rel, axis) / vHeight, 0.0, 1.0);
    float radius = vWidth * mix(1.0, 0.34, s);
    float radial = length(rel - axis * (s * vHeight)) / max(radius, 1e-3);
    // Edge-ordered ramp (edge0 < edge1): reversed smoothstep is undefined in
    // GLSL and several drivers invert it.
    float profile = 1.0 - smoothstep(0.0, 1.0, radial);
    profile *= profile;
    float body = smoothstep(0.0, 0.28, s) * (1.0 - smoothstep(0.72, 1.0, s));
    float stripe = 0.8 + 0.2 * sin(rel.x * 0.9 + rel.z * 0.7 + vSeed * 31.0 + uTime * 0.35 * uMotion);
    acc += profile * body * stripe;
  }

  // Beer–Lambert: density over distance, saturating instead of stacking to
  // white when the view runs along the beam.
  float alpha = (1.0 - exp(-acc * stepSize * uDensity)) * vAlpha * uIntensity * visible;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

const STEPS_BY_TIER = { high: 18, medium: 12, low: 8 } as const;

/** Bounding boxes plus the beam each vertex belongs to — one draw call. */
function buildVolumeGeometry(volume: ShaftVolume): BufferGeometry {
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(volume.positions, 3));
  geo.setAttribute("aBase", new BufferAttribute(volume.bases, 3));
  geo.setAttribute("aAxis", new BufferAttribute(volume.axes, 3));
  geo.setAttribute("aHeight", new BufferAttribute(volume.heights, 1));
  geo.setAttribute("aWidth", new BufferAttribute(volume.widths, 1));
  geo.setAttribute("aAlpha", new BufferAttribute(volume.alphas, 1));
  geo.setAttribute("aSeed", new BufferAttribute(volume.seeds, 1));
  return geo;
}

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
  const steps = STEPS_BY_TIER[tier];

  const resources = useMemo(() => {
    const layout = buildShaftLayout({
      curve,
      count,
      halfWidth: roadHalfWidth,
      height: declaration.height,
      width: declaration.width,
      edgeDrop,
    });
    const axis = shaftAxis(keyDirection);
    const volume = buildShaftVolume(layout, axis);

    const geo = buildVolumeGeometry(volume);
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      defines: { STEPS: steps },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      depthTest: true,
      // Both sides are rasterised and the shader keeps exactly one of them by
      // distance: near faces from outside, far faces from inside.
      // `buildShaftVolume` winds every face outward, which is what makes that
      // test meaningful.
      side: DoubleSide,
      uniforms: {
        uColor: { value: new Color(declaration.color) },
        uIntensity: { value: declaration.intensity },
        uDensity: { value: 0.55 },
        // The same clock the wind runs on: shafts shimmer when the world is
        // already moving, so they cannot sit still in a windy place.
        uTime: WIND_UNIFORMS.uWindTime,
        uMotion: { value: reducedMotion ? 0 : 1 },
        uNearIn: { value: SHAFT_NEAR_IN },
        uNearOut: { value: SHAFT_NEAR_OUT },
        uFarIn: { value: SHAFT_FAR_IN },
        uFarOut: { value: SHAFT_FAR_OUT },
      },
    });

    return { geo, material };
  }, [curve, count, steps, roadHalfWidth, declaration, keyDirection, edgeDrop, reducedMotion]);

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
