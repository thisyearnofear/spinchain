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
 * Planetary atmospheres — the sky and horizon for the worlds that are not
 * "a city at night" or "a mountain at noon".
 *
 * Alpine and Neon have bespoke art direction already. Mars, Toon Valley and
 * Spectrum Run share one parametric implementation: a profile drives the
 * ridge shape, the palette, and the sky shader's style, so each world still
 * reads as its own place instead of a recolour of the same place.
 *
 * All of it is built once per route. Nothing here runs from the frame loop
 * except the sky's slow time uniform.
 */

/** Sky shader styles. */
export const SKY_STYLE = {
  /** Red planet: dust bands, a low dim sun, heavy haze. */
  dust: 0,
  /** Pastel daylight: big soft sun, clean gradient, cotton clouds. */
  sun: 1,
  /** Prismatic night: stars, aurora ribbons, spectrum band on the horizon. */
  prism: 2,
} as const;

export type SkyStyle = (typeof SKY_STYLE)[keyof typeof SKY_STYLE];

export interface PlanetProfile {
  name: string;
  horizonName: string;
  style: SkyStyle;

  /** Sky dome colours. */
  zenith: string;
  horizon: string;
  /** Colour the ridge fades into at its far edge. */
  haze: string;

  /** Ridge colours: base (near, in shadow) and crest (lit). */
  ridgeBase: string;
  ridgeCrest: string;

  /** Accent used by the sky's bands / aurora / spectrum. */
  accent: string;
  accentAlt: string;

  /** Sun (or primary light) direction, colour and disc strength. */
  sunDir: Vector3;
  sunColor: string;
  sunStrength: number;

  /** Ridge silhouette: height multiplier and how jagged the crests are. */
  ridgeHeight: number;
  ridgeJagged: number;
  ridgeSegments: number;
  /**
   * How far the horizon ring's base falls below the route. The ring is a
   * cylinder, so this is its height: 26 reads as a land wall, a small number
   * reads as a low bank sitting on the horizon (the Cloud world wants the
   * latter — it is a bank of cumulus, not a cliff).
   */
  ridgeDepth?: number;
  /**
   * The height of the ring's crest above the route's LOWEST point.
   *
   * By default the crest clears the route's *highest* point, which on a
   * hilly course is tens of units up — the ring then reads as a wall around
   * the whole ride. A world whose horizon is a soft bank (clouds, sea mist)
   * sets this instead, so the bank sits low and the road flies above it.
   */
  ridgeCrestHeight?: number;
  /**
   * Whether the world gets the horizon ring at all.
   *
   * The ring is a cylinder around the route's ORIGIN, not around the route —
   * on a long course the ride eventually drives through it and it looms as a
   * wall on one side. Worlds whose horizon should be the sky itself (the
   * Cloud world floats above a cloud sea, so there is nothing to ring) turn
   * it off.
   */
  ridge?: boolean;

  /** Star density for night skies (0 for daylight). */
  stars: number;
  /** Band / ribbon strength in the sky shader. */
  bands: number;

  /** Scene lighting used by the route visualizer for this world. */
  ambientColor: string;
  ambientGain: number;
  keyColor: string;
  keyIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  pointColor: string;

  /** Fog far plane for this world. */
  fogFar: number;
}

/** Direction helper — keeps every profile pointing at a real vector. */
function dir(x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y, z).normalize();
}

export const MARS_PROFILE: PlanetProfile = {
  name: "mars",
  horizonName: "mesa",
  style: SKY_STYLE.dust,
  zenith: "#2b0b0b",
  horizon: "#c2571f",
  haze: "#8a3c18",
  ridgeBase: "#331207",
  ridgeCrest: "#c2410c",
  accent: "#f97316",
  accentAlt: "#fb7185",
  sunDir: dir(-0.55, 0.34, -0.76),
  sunColor: "#ffb37a",
  sunStrength: 0.55,
  ridgeHeight: 0.72,
  ridgeJagged: 0.35,
  ridgeSegments: 72,
  stars: 0.12,
  bands: 0.85,
  ambientColor: "#ffb08a",
  ambientGain: 0.72,
  keyColor: "#ffd0a8",
  keyIntensity: 1.15,
  hemiSky: "#ff9a5c",
  hemiGround: "#4a1d12",
  hemiIntensity: 0.55,
  pointColor: "#ff7a45",
  fogFar: 260,
};

export const ANIME_PROFILE: PlanetProfile = {
  name: "anime",
  horizonName: "hills",
  style: SKY_STYLE.sun,
  zenith: "#8ec5ff",
  horizon: "#ffe4f0",
  haze: "#ffd9ea",
  ridgeBase: "#4f7f46",
  ridgeCrest: "#a8dc7a",
  accent: "#ff90b3",
  accentAlt: "#fff3b0",
  sunDir: dir(0.35, 0.72, 0.6),
  sunColor: "#fff6d8",
  sunStrength: 1.1,
  ridgeHeight: 0.78,
  ridgeJagged: 0.16,
  ridgeSegments: 64,
  stars: 0,
  bands: 0.35,
  ambientColor: "#fff6fb",
  ambientGain: 1.45,
  keyColor: "#fff2d0",
  keyIntensity: 1.5,
  hemiSky: "#dff1ff",
  hemiGround: "#9ec48b",
  hemiIntensity: 0.85,
  pointColor: "#ffd6e6",
  fogFar: 300,
};

export const RAINBOW_PROFILE: PlanetProfile = {
  name: "rainbow",
  horizonName: "crystal-ridge",
  style: SKY_STYLE.prism,
  zenith: "#0b0420",
  horizon: "#2d0a5e",
  haze: "#3b1178",
  ridgeBase: "#150735",
  ridgeCrest: "#7c3aed",
  accent: "#00ffff",
  accentAlt: "#ff00ff",
  sunDir: dir(0.2, 0.55, -0.81),
  sunColor: "#c4b5fd",
  sunStrength: 0.4,
  ridgeHeight: 0.85,
  ridgeJagged: 0.85,
  ridgeSegments: 80,
  stars: 1,
  bands: 1,
  ambientColor: "#c4b5fd",
  ambientGain: 0.85,
  keyColor: "#a78bfa",
  keyIntensity: 0.95,
  hemiSky: "#4c1d95",
  hemiGround: "#12042b",
  hemiIntensity: 0.6,
  pointColor: "#e879f9",
  fogFar: 230,
};

/**
 * Cloud Kingdom — the soft one.
 *
 * `SKY_STYLE.sun` is the pastel daylight style, and its shader already draws
 * cotton cloud bands, so the sky needs no new code: only a palette. The
 * horizon ring is the interesting part — the "ridge" geometry is a smooth
 * rounded band (`ridgeJagged` near zero) in white, which reads as a distant
 * bank of cumulus rather than as land.
 */
export const CLOUD_PROFILE: PlanetProfile = {
  name: "cloud",
  horizonName: "cloud-bank",
  style: SKY_STYLE.sun,
  zenith: "#8fc9ff",
  horizon: "#ffd9ee",
  haze: "#ffd0e8",
  ridgeBase: "#ffd0e8",
  ridgeCrest: "#ffeaf7",
  accent: "#ff9fd2",
  accentAlt: "#9ad9ff",
  sunDir: dir(0.22, 0.5, -0.84),
  sunColor: "#fff4d6",
  sunStrength: 0.75,
  // The ridge is a distant bank of cumulus, not a hill. Any height and it
  // reads as a wall beside the road — it has to sit almost flat.
  ridgeHeight: 0.06,
  ridgeJagged: 0.05,
  ridgeSegments: 60,
  // A bank of cumulus sitting on the horizon, not a cliff around the route.
  ridgeDepth: 3.5,
  // No horizon ring at all: the ride floats above a cloud sea, so the horizon
  // is the sky meeting the ground, not a bank of land.
  ridge: false,
  // The bank stays low whatever the route does. The default would clear the
  // course's highest point, which on a hilly route is tens of units up — and
  // a "distant cloud bank" that high reads as a wall beside the road.
  ridgeCrestHeight: 14,
  stars: 0,
  bands: 0.85,
  // A white world over a white world blows out fast: the ambient and key
  // gains are deliberately below 1 so the road keeps its edges.
  ambientColor: "#fff8fd",
  ambientGain: 0.85,
  keyColor: "#fff0dc",
  keyIntensity: 0.85,
  hemiSky: "#e6f6ff",
  hemiGround: "#ffdcf0",
  hemiIntensity: 0.7,
  pointColor: "#ffc6e9",
  fogFar: 280,
};

export const PLANET_PROFILES: Record<string, PlanetProfile> = {
  mars: MARS_PROFILE,
  anime: ANIME_PROFILE,
  rainbow: RAINBOW_PROFILE,
  cloud: CLOUD_PROFILE,
};

// ─── Horizon geometry ─────────────────────────────────────────────────

/**
 * A ridge ring around the route. The base sits below the lowest road and
 * the crest clears the highest point, so the slope rises through the fog
 * instead of floating on it.
 *
 * The silhouette is layered noise: a slow swell for the mass of the land,
 * a faster ridge for the crests, and a sharp term for the jaggedness that
 * separates a crystal range from a mesa.
 */
export function buildPlanetHorizonGeometry(
  curve: CatmullRomCurve3,
  profile: PlanetProfile,
): BufferGeometry {
  const segments = profile.ridgeSegments;
  const rows = 5;

  const point = new Vector3();
  let minY = Infinity;
  let maxY = -Infinity;
  const samples = 64;
  for (let i = 0; i < samples; i++) {
    curve.getPointAt(i / samples, point);
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }

  const baseY = minY - (profile.ridgeDepth ?? 26);
  const rise = Math.max(30, (maxY - minY) * 0.6 + 26) * profile.ridgeHeight;
  const peakY =
    profile.ridgeCrestHeight !== undefined
      ? minY + profile.ridgeCrestHeight
      : maxY + rise * 0.55;

  // Outer reach of the skirt this curve produces.
  const skirtGeometry = buildRouteSkirtGeometry(curve, 2.5);
  const skirtPosition = skirtGeometry.getAttribute("position");
  let baseRadius = 0;
  for (let i = 0; i < skirtPosition.count; i++) {
    const radius = Math.hypot(skirtPosition.getX(i), skirtPosition.getZ(i));
    if (radius > baseRadius) baseRadius = radius;
  }
  skirtGeometry.dispose();
  baseRadius += 10;
  const peakRadius = baseRadius + 46;

  const positions = new Float32Array(segments * rows * 3);
  const colors = new Float32Array(segments * rows * 3);

  const haze = new Color(profile.haze);
  const base = new Color(profile.ridgeBase);
  const crest = new Color(profile.ridgeCrest);
  const color = new Color();

  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const theta = t * Math.PI * 2;

    // Layered silhouette. Stable for a given angle.
    const swell = Math.sin(theta * 2 + 0.4) * 0.5 + 0.5;
    const ridge = Math.sin(theta * 5 + 1.9) * 0.5 + 0.5;
    const sharp = Math.sin(theta * 13 + 0.7) * 0.5 + 0.5;
    const crestUnit = Math.min(
      1,
      Math.max(
        0,
        swell * 0.5 + ridge * 0.32 + sharp * 0.18 * profile.ridgeJagged,
      ),
    );
    const shaped = Math.pow(crestUnit, 1.25);

    for (let row = 0; row < rows; row++) {
      const v = row / (rows - 1);
      const radius = baseRadius + (peakRadius - baseRadius) * v;
      const y = baseY + (peakY - baseY) * Math.pow(v, 1.3) * (0.55 + shaped * 0.45);

      const idx = (i * rows + row) * 3;
      positions[idx] = Math.cos(theta) * radius;
      positions[idx + 1] = y;
      positions[idx + 2] = Math.sin(theta) * radius;

      color.copy(base).lerp(crest, shaped * 0.8);
      // Fade the far edge into the world's haze so the horizon band and the
      // sky meet in the same colour — but never all the way, or the ridge
      // reads as flat haze instead of land.
      color.lerp(haze, Math.pow(v, 1.5) * 0.78);
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
  return geometry;
}

export function createPlanetHorizonMaterial(): MeshLambertMaterial {
  return new MeshLambertMaterial({
    vertexColors: true,
    fog: true,
    side: FrontSide,
  });
}

// ─── Sky shader ───────────────────────────────────────────────────────

export const PLANET_SKY_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const PLANET_SKY_FRAGMENT = /* glsl */ `
#include <common>
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAccent;
uniform vec3 uAccentAlt;
uniform float uStyle;
uniform float uSunStrength;
uniform float uStars;
uniform float uBands;
uniform float uTime;
varying vec3 vWorld;

float hash21(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

void main() {
  vec3 dir = normalize(vWorld - cameraPosition);
  float h = dir.y;
  float up = clamp(h, 0.0, 1.0);
  float above = smoothstep(-0.05, 0.10, h);

  vec3 sky = mix(uHorizon, uZenith, pow(up, 0.55));

  // ── Stars (night styles) ──────────────────────────────────────────
  if (uStars > 0.001) {
    vec2 cell = floor(dir.xz * 140.0 / max(0.25, abs(dir.y) + 0.35));
    float star = hash21(cell);
    float bright = smoothstep(0.9975, 0.99995, star);
    float twinkle = 0.65 + 0.35 * sin(uTime * 1.6 + star * 90.0);
    sky += vec3(0.85, 0.92, 1.0) * bright * twinkle * uStars * above;
  }

  // ── Style 0: dust bands ───────────────────────────────────────────
  if (uStyle < 0.5) {
    float band = sin(h * 26.0 - uTime * 0.05) * 0.5 + 0.5;
    float fine = sin(dir.x * 5.0 + dir.z * 3.1 + uTime * 0.03) * 0.5 + 0.5;
    float bandMask = (1.0 - smoothstep(0.02, 0.55, abs(h - 0.10)));
    sky = mix(sky, uAccent * 0.85, band * bandMask * 0.28 * uBands);
    sky = mix(sky, uAccentAlt * 0.7, fine * bandMask * 0.16 * uBands);
    sky *= 1.0 - 0.18 * bandMask * uBands;
  }

  // ── Style 1: soft daylight sun with cotton cloud bands ───────────
  if (uStyle >= 0.5 && uStyle < 1.5) {
    float cloudBand = smoothstep(0.06, 0.30, h) * (1.0 - smoothstep(0.34, 0.78, h));
    float puff = sin(dir.x * 3.4 + uTime * 0.02) * sin(dir.z * 2.6 - uTime * 0.015);
    float cloud = smoothstep(0.15, 0.85, puff * 0.5 + 0.5);
    sky = mix(sky, vec3(1.0, 0.99, 0.98), cloud * cloudBand * 0.42 * uBands);
    sky = mix(sky, uAccent, cloudBand * 0.10 * uBands);
  }

  // ── Style 2: prismatic night with aurora ribbons ──────────────────
  if (uStyle >= 1.5) {
    float ribbon = sin(dir.x * 2.3 + uTime * 0.12) * 0.5 + 0.5;
    float ribbon2 = sin(dir.z * 3.1 - uTime * 0.09 + 1.4) * 0.5 + 0.5;
    float auroraMask = smoothstep(0.02, 0.42, h) * (1.0 - smoothstep(0.55, 0.95, h));
    float aurora = pow(ribbon * 0.6 + ribbon2 * 0.4, 2.2);
    sky += mix(uAccent, uAccentAlt, ribbon2) * aurora * auroraMask * 0.30 * uBands;

    // Spectrum band sitting on the horizon line.
    float spectrum = smoothstep(0.0, 0.10, h) * (1.0 - smoothstep(0.10, 0.26, h));
    float sweep = sin(dir.x * 8.0 + dir.z * 5.0 + uTime * 0.2) * 0.5 + 0.5;
    vec3 spectrumColor = mix(uAccent, uAccentAlt, sweep);
    sky += spectrumColor * spectrum * 0.42 * uBands;
  }

  // ── Sun / primary light ───────────────────────────────────────────
  float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
  float glow = pow(sunDot, 22.0);
  float disc = smoothstep(0.9986, 0.9995, sunDot);
  sky += uSunColor * (glow * 0.34 + disc) * uSunStrength * above;

  // Below the horizon, hold the haze colour so a gap reads as distance.
  sky = mix(uHorizon, sky, above);

  gl_FragColor = vec4(sky, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createPlanetSkyMaterial(
  profile: PlanetProfile,
  zenith: string,
  horizon: string,
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uZenith: { value: new Color(zenith) },
      uHorizon: { value: new Color(horizon) },
      uSunDir: { value: profile.sunDir.clone() },
      uSunColor: { value: new Color(profile.sunColor) },
      uAccent: { value: new Color(profile.accent) },
      uAccentAlt: { value: new Color(profile.accentAlt) },
      uStyle: { value: profile.style },
      uSunStrength: { value: profile.sunStrength },
      uStars: { value: profile.stars },
      uBands: { value: profile.bands },
      uTime: { value: 0 },
    },
    vertexShader: PLANET_SKY_VERTEX,
    fragmentShader: PLANET_SKY_FRAGMENT,
    fog: false,
    side: BackSide,
    depthWrite: false,
    toneMapped: true,
  });
}

export function createPlanetSkyGeometry(): SphereGeometry {
  return new SphereGeometry(1600, 40, 20);
}
