"use client";

/**
 * Ride airfield — one draw call of airborne grain, stationed on the route.
 *
 * The pool is fixed at mount (per tier) and never grows: each grain resolves its
 * place in a 34-unit corridor from `travel`, the same cumulative station the
 * road and the camera use. Everything the grain needs — station, sideways
 * offset, altitude, size — is derived from its seed, so a seek or a camera cut
 * throws nothing away.
 *
 * Division of labour, deliberately:
 *   - CPU resolves *world* position per grain per frame (420 lerps against a
 *     27-point corridor sampled once a frame). Cheap, exact, and unit-testable.
 *   - GPU does everything camera-dependent — billboard, apparent size, and the
 *     depth fade — so resizing or moving the lens never touches the pool.
 *
 * The fade constants and the corridor shape live in `ride-air.ts` and are passed
 * in as uniforms rather than restated in GLSL: two copies of a fade curve is
 * how a field ends up popping at one end and not the other.
 */

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";
import {
  airKindCount,
  airKindProfile,
  airKindSize,
  AIR_DEPTH_FULL_IN,
  AIR_DEPTH_FULL_OUT,
  AIR_DEPTH_IN,
  AIR_DEPTH_OUT,
  AIR_FAR,
  AIR_SPAN,
  airFieldFade,
  airGrainCount,
  airLateral,
  airStation,
  airWrapCount,
  positiveMod,
} from "./ride-air";

/** Corridor resolution — one sample per ~1.3 units of road. */
const CORRIDOR_SAMPLES = 27;
/** The rider group sits this far below the curve (matches the [0,-10,0] offset). */
const RIDER_Y_OFFSET = -10;

const vertexShader = /* glsl */ `
attribute vec3 aPos;
attribute float aSize;
attribute float aFade;
attribute float aSeed;

uniform float uDepthIn;
uniform float uDepthFullIn;
uniform float uDepthFullOut;
uniform float uDepthOut;
uniform float uOpacity;
uniform vec3 uCool;
uniform vec3 uWarm;
uniform float uWarmth;
uniform float uStretchY;
uniform float uTumble;
uniform float uSpin;

varying vec2 vQuad;
varying float vAlpha;
varying vec3 vTint;

float smoothStep(float a, float b, float x) {
  float t = clamp((x - a) / max(b - a, 0.0001), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

void main() {
  vec4 view = modelViewMatrix * vec4(aPos, 1.0);
  // Spin first, in view space, so a leaf turns as it passes the lens: the angle
  // advances with travel, and every instance starts at its own phase.
  float ang = aSeed * 6.2831853 + uSpin * uTumble;
  float c = cos(ang);
  float s = sin(ang);
  vec2 corner = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
  vQuad = corner;
  // Stretch after the rotation, and only in Y: rain becomes a streak, a leaf
  // stays broad. The decal is sampled in un-stretched space, so a stretched
  // quad reads as a long soft falling line rather than a fat blob.
  corner.y *= uStretchY;
  // Billboard: the quad always faces the lens, so it never thins to a line as
  // the rider enters a banked turn.
  view.xy += corner * aSize;
  gl_Position = projectionMatrix * view;

  float depth = -view.z;
  float visible = smoothStep(uDepthIn, uDepthFullIn, depth) *
                  (1.0 - smoothStep(uDepthFullOut, uDepthOut, depth));

  vAlpha = aFade * visible * uOpacity;
  // Seeds pick up the same sun the clouds are lit by: warm at the reveal, pale
  // blue when the sky is cold.
  vTint = mix(uCool, uWarm, uWarmth * (0.55 + 0.45 * aSeed));
}
`;

const fragmentShader = /* glsl */ `
varying vec2 vQuad;
varying float vAlpha;
varying vec3 vTint;
uniform float uLeaf;

void main() {
  float alpha;
  if (uLeaf > 0.5) {
    // A leaf, not a blob: broad at the base, tapering toward the tip.
    vec2 p = vQuad * 2.0;
    float taper = 1.0 - max(0.0, p.y) * 0.5;
    float d = length(vec2(p.x / max(taper, 0.25), p.y));
    alpha = vAlpha * (1.0 - smoothstep(0.55, 1.0, d));
  } else {
    float r = length(vQuad) * 2.0;
    // Falloff as two edge-ordered ramps: smoothstep(1.0, 0.12, r) is undefined
    // behaviour in GLSL (edge0 > edge1) and some drivers invert it.
    alpha = vAlpha * (1.0 - smoothstep(0.12, 1.0, r));
  }
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(vTint, alpha);
}
`;

export function RideAirfield({
  curve,
  curveLength,
  progressRef,
  warmthRef,
  tier,
  reducedMotion,
  coolHex,
  warmHex,
  densityRef,
  kind,
  declaredCount,
}: {
  curve: CatmullRomCurve3;
  curveLength: number;
  /** Rider's route fraction — the same ref the rider, camera and road read. */
  progressRef: MutableRefObject<number>;
  /** 0..1 sky/light warmth, shared with the cloud scattering. */
  warmthRef?: MutableRefObject<number>;
  tier: "high" | "medium" | "low";
  reducedMotion: boolean;
  /** Grain tint at the cold and warm ends — themed by the caller's world. */
  coolHex?: string;
  warmHex?: string;
  /**
   * 0..1 share of the field that is in the air. A world that starts clear and
   * fills as the ride opens out drives this from its own atmosphere rather than
   * mounting and unmounting the pool (a count that changes pops grain in).
   */
  densityRef?: MutableRefObject<number>;
  /** What this world puts in its air (`WorldAmbient.particles.kind`). */
  kind?: string;
  /** The count the world declares; the tier caps it. */
  declaredCount?: number;
}) {
  const profile = airKindProfile(kind);
  const count = airKindCount(kind, tier, declaredCount);
  // Buffers are allocated for the tier's full pool; instanceCount picks how
  // much of it draws, so a tier change never reallocates mid-ride.
  const capacity = Math.max(1, airGrainCount("high"));

  // Geometry and material are built once and published through a ref: the frame
  // loop must not mutate a memo'd value (same discipline as CloudRoad's pulse
  // material).
  const resources = useMemo(() => {
    const geo = new InstancedBufferGeometry();
    // Unit quad, two triangles. `position` is not optional: three sizes the
    // draw call from position.count, and an InstancedBufferGeometry without it
    // renders nothing at all — silently, with no warning.
    const corners = [
      -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0,
      -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
    ];
    geo.setAttribute("position", new BufferAttribute(new Float32Array(corners), 3));
    geo.setAttribute("aPos", new InstancedBufferAttribute(new Float32Array(capacity * 3), 3));
    geo.setAttribute("aSize", new InstancedBufferAttribute(new Float32Array(capacity), 1));
    geo.setAttribute("aFade", new InstancedBufferAttribute(new Float32Array(capacity), 1));
    geo.setAttribute("aSeed", new InstancedBufferAttribute(new Float32Array(capacity), 1));
    geo.instanceCount = count;
    // Positions live in an attribute spanning the whole corridor, so three's
    // bounding sphere (built from the tiny base quad) would cull the field the
    // moment the rider looked away from it.
    geo.boundingSphere = null;

    const mat = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      uniforms: {
        uDepthIn: { value: AIR_DEPTH_IN },
        uDepthFullIn: { value: AIR_DEPTH_FULL_IN },
        uDepthFullOut: { value: AIR_DEPTH_FULL_OUT },
        uDepthOut: { value: AIR_DEPTH_OUT },
        uOpacity: { value: 0 },
        uCool: { value: new Color(coolHex ?? "#eaf1ff") },
        uWarm: { value: new Color(warmHex ?? "#ffe7c9") },
        uStretchY: { value: profile.stretchY },
        uTumble: { value: profile.tumble },
        uLeaf: { value: profile.leafShape ? 1 : 0 },
        uSpin: { value: 0 },
        uWarmth: { value: 0.3 },
      },
    });
    // Corridor positions and the attribute readback live with the resources so
    // the frame loop never touches a render-scope value directly.
    return {
      geometry: geo,
      material: mat,
      corridor: new Float32Array(CORRIDOR_SAMPLES * 3),
      pos: geo.getAttribute("aPos") as InstancedBufferAttribute,
      sizes: geo.getAttribute("aSize") as InstancedBufferAttribute,
      fades: geo.getAttribute("aFade") as InstancedBufferAttribute,
      seeds: geo.getAttribute("aSeed") as InstancedBufferAttribute,
    };
  }, [capacity, count, coolHex, warmHex, profile.stretchY, profile.tumble, profile.leafShape]);

  const resourcesRef = useRef(resources);
  useEffect(() => {
    resourcesRef.current = resources;
  }, [resources]);

  useEffect(
    () => () => {
      resources.geometry.dispose();
      resources.material.dispose();
    },
    [resources],
  );

  const meshRef = useRef<Mesh>(null);
  const scratch = useRef(new Vector3());

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;
    const resources = resourcesRef.current;

    // Density is read before any geometry work: a clear sky costs nothing.
    const density = densityRef ? Math.min(1, Math.max(0, densityRef.current)) : 1;
    resources.material.uniforms.uOpacity.value = density;
    if (density < 0.002) return;

    const progress = Math.min(1, Math.max(0, progressRef.current));
    const travel = positiveMod(progress * curveLength, AIR_SPAN);

    // 1. Sample the road once a frame: the corridor is the terrain the grain
    //    follows, so a grain over a climb rises with the climb.
    const p = scratch.current;
    for (let i = 0; i < CORRIDOR_SAMPLES; i++) {
      const station = -AIR_FAR + (i / (CORRIDOR_SAMPLES - 1)) * AIR_SPAN;
      const u = Math.min(1, Math.max(0, progress + station / Math.max(1, curveLength)));
      curve.getPointAt(u, p);
      resourcesRef.current.corridor[i * 3] = p.x;
      resourcesRef.current.corridor[i * 3 + 1] = p.y + RIDER_Y_OFFSET;
      resourcesRef.current.corridor[i * 3 + 2] = p.z;
    }

    // 2. Resolve the pool against it.
    resources.pos.needsUpdate = true;
    resources.sizes.needsUpdate = true;
    resources.fades.needsUpdate = true;
    resources.seeds.needsUpdate = true;
    const posArray = resources.pos.array as Float32Array;
    const sizeArray = resources.sizes.array as Float32Array;
    const fadeArray = resources.fades.array as Float32Array;
    const seedArray = resources.seeds.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const seed = (i + 0.5) / count;
      const lateralSeed = positiveMod(seed * 17.13 + 0.31, 1);
      // Flutter is a small station wobble on the grain's own clock, so the
      // field drifts rather than marching.
      const flutter = reducedMotion
        ? 0
        : Math.sin(seed * 61.7 + travel * 0.4) * profile.sway * 0.35;
      const station = airStation(seed, travel, flutter);

      // Corridor lookup: linear between the two samples either side.
      const f = Math.min(0.9999, Math.max(0, (station + AIR_FAR) / AIR_SPAN)) * (CORRIDOR_SAMPLES - 1);
      const i0 = Math.floor(f);
      const t = f - i0;
      const a = i0 * 3;
      const b = a + 3;
      const x = resources.corridor[a] + (resources.corridor[b] - resources.corridor[a]) * t;
      const y = resources.corridor[a + 1] + (resources.corridor[b + 1] - resources.corridor[a + 1]) * t;
      const z = resources.corridor[a + 2] + (resources.corridor[b + 2] - resources.corridor[a + 2]) * t;

      // Sideways: redrawn on each wrap, so the respawn edge never lines up.
      const lateral = airLateral(seed, lateralSeed, airWrapCount(seed, travel));
      const spread = 4 + positiveMod(seed * 29.7, 1) * 7;
      // Tangent from the corridor itself — no second curve sample.
      const tx = resources.corridor[b] - resources.corridor[a];
      const tz = resources.corridor[b + 2] - resources.corridor[a + 2];
      const len = Math.hypot(tx, tz) || 1;
      // side = normalize(cross(tangent, up))
      const sx = -tz / len;
      const sz = tx / len;
      // Bounded vertical drift: with the station wrap this reads as a leaf
      // settling or a spark lifting, and neither leaves the corridor.
      const altitude =
        0.4 +
        positiveMod(seed * 41.3 + 0.11, 1) * 2.8 +
        profile.rise * positiveMod(seed * 13.7 + travel * 0.15, 1);

      posArray[i * 3] = x + sx * lateral * spread;
      posArray[i * 3 + 1] = y + altitude;
      posArray[i * 3 + 2] = z + sz * lateral * spread;

      sizeArray[i] = airKindSize(profile, seed);
      fadeArray[i] = airFieldFade(station);
      seedArray[i] = positiveMod(seed * 7.7, 1);
    }

    // 3. Warmth and the ride's own fade-in, damped so a telemetry step cannot
    //    strobe the field.
    const uniforms = resources.material.uniforms;
    // Density already set above; only the tint eases here.
    // Spin clock for the shader: travel, not wall time, so a seek or a pause
    // holds a leaf exactly where it was.
    uniforms.uSpin.value = travel;
    const warmth = warmthRef ? warmthRef.current : 0.45;
    uniforms.uWarmth.value += (warmth - uniforms.uWarmth.value) * Math.min(1, delta * 3);
  });

  if (count === 0) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={resources.geometry}
      material={resources.material}
      frustumCulled={false}
      renderOrder={2}
    />
  );
}
