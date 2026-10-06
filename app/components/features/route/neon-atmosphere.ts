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
import { buildRouteSkirtGeometry, type SkirtLight } from "./route-skirt";

/**
 * Neon night: one static sky dome, one static skyline, and a cool key
 * shared with the skirt and the scene light. Built once. Nothing in this
 * module runs from the frame loop.
 *
 * The shape is a ring of blocks outside the skirt, not a valley ridge.
 * The sky is night with a violet/cyan horizon band — no sun, no clouds.
 */

/** Key light, low and off to the side. Not an overhead sun. */
export const NEON_KEY_DIR = new Vector3(0.22, 0.38, 0.9).normalize();

/** Lifted from the theme road emissive / horizon glow (#6d7cff). */
export const NEON_KEY_COLOR = "#b7c4ff";
export const NEON_KEY_INTENSITY = 0.95;
/** Cool fill so the night reads, without a white daylight ambient. */
export const NEON_AMBIENT_COLOR = "#9aa6d6";
export const NEON_AMBIENT_GAIN = 0.7;
/** Theme line color. The street glow, separate from the violet key. */
export const NEON_POINT_COLOR = "#6ef3c6";
export const NEON_HEMI_SKY = "#24315f";
export const NEON_HEMI_GROUND = "#120814";
export const NEON_HEMI_INTENSITY = 0.5;

export const NEON_GLOW = "#6d7cff";
export const NEON_ACCENT = "#6ef3c6";

/**
 * Closer than the shared 250 so the skyline and the skirt's far edge go to
 * the night haze while the near ground is still readable. The near plane
 * stays on the effort-driven fog density.
 */
export const NEON_FOG_FAR = 200;

/** Shallow rim so the fade sits on a surface, not a cliff. */
export const NEON_SKIRT_EDGE_DROP = 1.15;
/** #0f172a is nearly black; lift it enough to read as night asphalt. */
export const NEON_SKIRT_ALBEDO_GAIN = 2.6;
export const NEON_SKIRT_EDGE_SHADE = 0.5;
export const NEON_SKIRT_SUN_GAIN = 0.28;
/** Later than Alpine's bright haze. The dark rim still reaches fog before the cut. */
export const NEON_SKIRT_FOG_START = 0.3;
export const NEON_SKIRT_FOG_END = 0.8;

export const NEON_SKY_RADIUS = 1800;
export const NEON_SKYLINE_SEGMENTS = 108;
export const NEON_SKYLINE_ROWS = 4;
export const NEON_SKYLINE_BLOCKS = 36;

export function neonSkirtLight(): SkirtLight {
  return {
    albedoGain: NEON_SKIRT_ALBEDO_GAIN,
    edgeShade: NEON_SKIRT_EDGE_SHADE,
    sunGain: NEON_SKIRT_SUN_GAIN,
    sunDir: NEON_KEY_DIR,
    fogStart: NEON_SKIRT_FOG_START,
    fogEnd: NEON_SKIRT_FOG_END,
  };
}

function hashUnit(n: number): number {
  const x = Math.sin(n * 127.1 + 3.17) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * 0 in the gaps between blocks, otherwise a quantized story height.
 * Constant across the face of one block. Stable for a given angle.
 */
export function neonSkylineUnit(t: number): number {
  const wrapped = t - Math.floor(t);
  const scaled = wrapped * NEON_SKYLINE_BLOCKS;
  const index = Math.floor(scaled);
  const local = scaled - index;
  const roll = hashUnit(index + 1);
  const gapAt = 0.58 + roll * 0.18;
  if (local >= gapAt) return 0;
  const story = Math.round(roll * 4) / 4;
  const tower = roll > 0.84 ? 0.22 : 0;
  return Math.min(1, 0.28 + story * 0.55 + tower);
}

function sampleCurveVertical(curve: CatmullRomCurve3, samples = 64): { minY: number; maxY: number; midY: number } {
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

function skirtOuterRadius(curve: CatmullRomCurve3): number {
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
 * A ring of blocks just outside the skirt. Walls are vertical. Gaps drop
 * toward the road so the horizon reads as a skyline, and the base sits
 * below the lowest road so the fog eats the foot of the city.
 */
export function buildNeonSkylineGeometry(curve: CatmullRomCurve3): BufferGeometry {
  const { minY, midY } = sampleCurveVertical(curve);
  const baseY = minY - 16;
  const parapet = minY + 2;
  const crown = midY + 44;
  const baseRadius = skirtOuterRadius(curve) + 12;
  const roofDepth = 6;

  const segments = NEON_SKYLINE_SEGMENTS;
  const rows = NEON_SKYLINE_ROWS;
  const positions = new Float32Array(segments * rows * 3);
  const colors = new Float32Array(segments * rows * 3);
  const haze = new Color("#07090f");
  const wall = new Color("#141a2e");
  const windowViolet = new Color("#6d7cff");
  const capViolet = new Color("#a8b6ff");
  const capCyan = new Color("#7dffe4");
  const roofDark = new Color("#0e1322");
  const color = new Color();

  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const unit = neonSkylineUnit(t);
    const eave = parapet + (crown - parapet) * unit;
    const block = Math.floor(t * NEON_SKYLINE_BLOCKS);
    const roll = hashUnit(block + 1);
    const tower = unit > 0.9;
    const cap = hashUnit(block + 19) > 0.5 ? capCyan : capViolet;
    for (let row = 0; row < rows; row++) {
      const radius = row === rows - 1 ? baseRadius + roofDepth : baseRadius;
      let y = baseY;
      if (row === 1) y = baseY + (eave - baseY) * 0.58;
      else if (row === 2) y = eave;
      else if (row === 3) y = eave + 0.8;
      const theta = t * Math.PI * 2;
      const idx = (i * rows + row) * 3;
      positions[idx] = Math.cos(theta) * radius;
      positions[idx + 1] = y;
      positions[idx + 2] = Math.sin(theta) * radius;

      if (row === 0) {
        color.copy(haze);
      } else if (row === 1) {
        color.copy(wall);
        if (unit > 0.45) color.lerp(windowViolet, 0.55 + roll * 0.3);
      } else if (row === 2) {
        if (tower) color.copy(cap);
        else if (unit > 0.5) color.copy(wall).lerp(windowViolet, 0.35);
        else color.copy(wall);
      } else {
        color.copy(roofDark);
        if (tower) color.lerp(cap, 0.45);
      }
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
      // Same winding as a valley-facing wall: normal points inward.
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
  geometry.userData.parapet = parapet;
  geometry.userData.crown = crown;
  geometry.userData.baseRadius = baseRadius;
  geometry.userData.roofDepth = roofDepth;
  return geometry;
}

export function createNeonSkylineMaterial(): MeshLambertMaterial {
  return new MeshLambertMaterial({
    vertexColors: true,
    fog: true,
    side: FrontSide,
  });
}

export const NEON_SKY_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const NEON_SKY_FRAGMENT = /* glsl */ `
#include <common>
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uAccent;
varying vec3 vWorld;
void main() {
  vec3 dir = normalize(vWorld - cameraPosition);
  float h = dir.y;
  float up = clamp(h, 0.0, 1.0);

  // Night overhead. The zenith is the theme night, darker still at the top.
  vec3 sky = mix(uZenith, uZenith * vec3(0.42, 0.48, 0.7), smoothstep(0.2, 0.92, up));

  // Horizon is a city glow, violet on one side and cyan on the other.
  // No disc, no daylight gradient.
  float azimuth = atan(dir.z, dir.x);
  float violet = sin(azimuth * 2.0) * 0.5 + 0.5;
  float cyan = sin(azimuth * 5.0 + 1.4) * 0.5 + 0.5;
  vec3 glowColor = mix(uGlow, uAccent, smoothstep(0.4, 0.92, cyan));
  float band = smoothstep(-0.02, 0.045, h) * (1.0 - smoothstep(0.05, 0.24, h));
  float hot = smoothstep(0.62, 1.0, violet);
  sky = mix(sky, glowColor, band * (0.48 + hot * 0.42));

  // Fixed stars. Direction only — no time uniform, nothing to update per frame.
  vec2 cell = floor(dir.xz * vec2(90.0, 70.0) + dir.y * 40.0);
  float star = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  float starMask = step(0.996, star) * smoothstep(0.34, 0.55, h);
  sky += vec3(0.8, 0.86, 1.0) * starMask * 0.45;

  // Below the horizon, hold the fog color so a gap reads as haze.
  float above = smoothstep(-0.04, 0.07, h);
  sky = mix(uHorizon, sky, above);

  gl_FragColor = vec4(sky, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createNeonSkyMaterial(zenith: string, horizon: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uZenith: { value: new Color(zenith) },
      uHorizon: { value: new Color(horizon) },
      uGlow: { value: new Color(NEON_GLOW) },
      uAccent: { value: new Color(NEON_ACCENT) },
    },
    vertexShader: NEON_SKY_VERTEX,
    fragmentShader: NEON_SKY_FRAGMENT,
    // Fog on the dome would flatten it to a solid past fogFar. The horizon
    // uniform is the fog color, so the skirt's fade lands on this sky.
    fog: false,
    side: BackSide,
    depthWrite: false,
    toneMapped: true,
  });
}

export function createNeonSkyGeometry(): SphereGeometry {
  return new SphereGeometry(NEON_SKY_RADIUS, 28, 16);
}
