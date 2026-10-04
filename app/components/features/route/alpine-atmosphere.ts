import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  FrontSide,
  MeshLambertMaterial,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type CatmullRomCurve3,
} from "three";
import { buildRouteSkirtGeometry } from "./route-skirt";

/**
 * Alpine day: one static sky dome, one static ridge, and a sun direction
 * shared with the skirt and the scene light. Built once. Nothing in this
 * module runs from the frame loop.
 */

/** Direction toward the sun. Rays travel the other way. */
export const ALPINE_SUN_DIR = new Vector3(0.42, 0.84, 0.34).normalize();

export const ALPINE_SUN_COLOR = "#fff1d6";
export const ALPINE_SUN_INTENSITY = 1.45;
export const ALPINE_AMBIENT_COLOR = "#e4eef8";
export const ALPINE_AMBIENT_GAIN = 1.35;
export const ALPINE_POINT_COLOR = "#ffe6c4";

/**
 * Closer than the other themes' 250 so the far ridge and the skirt's far
 * edge go to haze while the near ground is still readable. The near plane
 * stays on the effort-driven fog density.
 */
export const ALPINE_FOG_FAR = 220;

export const ALPINE_SKIRT_ALBEDO_GAIN = 4.4;
export const ALPINE_SKIRT_EDGE_SHADE = 0.74;
export const ALPINE_SKIRT_SUN_GAIN = 0.95;

export const ALPINE_SKY_RADIUS = 1800;
export const ALPINE_HORIZON_SEGMENTS = 64;
export const ALPINE_HORIZON_ROWS = 5;

/** 0 in the saddles, 1 on the tallest crests. Stable for a given angle. */
export function alpineRidgeUnit(t: number): number {
  const wrapped = t - Math.floor(t);
  const a = Math.sin(wrapped * Math.PI * 2 * 3);
  const b = Math.sin(wrapped * Math.PI * 2 * 5 + 1.7);
  const c = Math.sin(wrapped * Math.PI * 2 * 11 + 0.6);
  const n = a * 0.52 + b * 0.31 + c * 0.17;
  const u = Math.min(1, Math.max(0, n * 0.5 + 0.5));
  return u * u;
}

export function sampleCurveVertical(curve: CatmullRomCurve3, samples = 64): { minY: number; maxY: number; midY: number } {
  const point = new Vector3();
  let minY = Infinity;
  let maxY = -Infinity;
  let sum = 0;
  const count = Math.max(8, samples);
  for (let i = 0; i < count; i++) {
    curve.getPointAt(i / count, point);
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
    sum += point.y;
  }
  return { minY, maxY, midY: sum / count };
}

/** Outermost horizontal reach of the skirt this curve produces. */
export function skirtOuterRadius(curve: CatmullRomCurve3): number {
  const geometry = buildRouteSkirtGeometry(curve, 2.5);
  const position = geometry.getAttribute("position");
  let maxR = 0;
  for (let i = 0; i < position.count; i++) {
    const radius = Math.hypot(position.getX(i), position.getZ(i));
    if (radius > maxR) maxR = radius;
  }
  geometry.dispose();
  return maxR;
}

/**
 * A ring just outside the skirt. The base is below the lowest road and the
 * crest clears the pass, so the slope comes up through the fog instead of
 * floating on it. Peak sits farther from the valley than the base, which
 * makes the face normal point up and back toward the road.
 */
export function buildAlpineHorizonGeometry(curve: CatmullRomCurve3): BufferGeometry {
  const { minY, maxY, midY } = sampleCurveVertical(curve);
  const baseY = minY - 28;
  const rise = Math.max(32, (maxY - minY) * 0.62);
  const lowPeak = midY + 22;
  const highPeak = Math.max(maxY + 16, lowPeak + rise);
  const baseRadius = skirtOuterRadius(curve) + 8;
  const peakRadius = baseRadius + 40;

  const segments = ALPINE_HORIZON_SEGMENTS;
  const rows = ALPINE_HORIZON_ROWS;
  const positions = new Float32Array(segments * rows * 3);
  const colors = new Float32Array(segments * rows * 3);
  const haze = new Color("#d5e2f2");
  const rock = new Color("#6d8498");
  const snow = new Color("#e7eef6");
  const crevice = new Color("#4c6174");
  const color = new Color();

  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const crest = alpineRidgeUnit(t);
    const peakY = lowPeak + (highPeak - lowPeak) * crest;
    for (let row = 0; row < rows; row++) {
      const v = row / (rows - 1);
      const radius = baseRadius + (peakRadius - baseRadius) * v;
      const y = baseY + (peakY - baseY) * Math.pow(v, 1.35);
      const theta = t * Math.PI * 2;
      const idx = (i * rows + row) * 3;
      positions[idx] = Math.cos(theta) * radius;
      positions[idx + 1] = y;
      positions[idx + 2] = Math.sin(theta) * radius;

      color.copy(haze).lerp(rock, Math.min(1, v * 1.15));
      if (v > 0.62 && crest > 0.55) {
        color.lerp(snow, ((v - 0.62) / 0.38) * ((crest - 0.55) / 0.45));
      }
      const fold = Math.sin(t * Math.PI * 2 * 11 + 0.6) * 0.5 + 0.5;
      color.lerp(crevice, fold * fold * (1 - v) * 0.45);
      colors[idx] = color.r;
      colors[idx + 1] = color.g;
      colors[idx + 2] = color.b;
    }
  }

  const indices = new Uint16Array(segments * (rows - 1) * 6);
  let cursor = 0;
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    for (let row = 0; row < rows - 1; row++) {
      const a = i * rows + row;
      const b = next * rows + row;
      const c = next * rows + row + 1;
      const d = i * rows + row + 1;
      // CCW from the valley: normal points up and inward.
      indices[cursor++] = a;
      indices[cursor++] = b;
      indices[cursor++] = c;
      indices[cursor++] = a;
      indices[cursor++] = c;
      indices[cursor++] = d;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.baseY = baseY;
  geometry.userData.lowPeak = lowPeak;
  geometry.userData.highPeak = highPeak;
  geometry.userData.baseRadius = baseRadius;
  return geometry;
}

export function createAlpineRidgeMaterial(): MeshLambertMaterial {
  return new MeshLambertMaterial({
    vertexColors: true,
    fog: true,
    side: FrontSide,
  });
}

export const ALPINE_SKY_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const ALPINE_SKY_FRAGMENT = /* glsl */ `
#include <common>
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
varying vec3 vWorld;
void main() {
  vec3 dir = normalize(vWorld - cameraPosition);
  float h = dir.y;
  float above = smoothstep(-0.04, 0.12, h);
  float up = clamp(h, 0.0, 1.0);
  vec3 sky = mix(uHorizon, uZenith, pow(up, 0.55));
  vec3 overhead = uZenith * vec3(0.78, 0.84, 0.96);
  sky = mix(sky, overhead, smoothstep(0.28, 0.95, up));
  // Below the horizon, hold the fog color so a gap reads as haze.
  sky = mix(uHorizon, sky, above);

  float band = smoothstep(0.03, 0.14, h) * (1.0 - smoothstep(0.32, 0.68, h));
  float wisps = sin(dir.x * 5.5 + dir.z * 3.4) * sin(dir.z * 4.2 - dir.x * 2.1);
  wisps = smoothstep(0.25, 0.9, wisps * 0.5 + 0.5);
  sky = mix(sky, vec3(0.9, 0.93, 0.97), wisps * band * 0.38);

  float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
  float glow = pow(sunDot, 28.0);
  float disc = smoothstep(0.9988, 0.9997, sunDot);
  sky += vec3(1.0, 0.94, 0.8) * (glow * 0.28 + disc) * above;

  gl_FragColor = vec4(sky, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createAlpineSkyMaterial(zenith: string, horizon: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uZenith: { value: new Color(zenith) },
      uHorizon: { value: new Color(horizon) },
      uSunDir: { value: ALPINE_SUN_DIR.clone() },
    },
    vertexShader: ALPINE_SKY_VERTEX,
    fragmentShader: ALPINE_SKY_FRAGMENT,
    // Fog on the dome would flatten it to a solid past fogFar. The horizon
    // uniform is the fog color, so the skirt's fade lands on this sky.
    fog: false,
    side: BackSide,
    depthWrite: false,
    toneMapped: true,
  });
}

export function createAlpineSkyGeometry(): SphereGeometry {
  return new SphereGeometry(ALPINE_SKY_RADIUS, 28, 16);
}
