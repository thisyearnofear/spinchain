import {
  BackSide,
  Color,
  ShaderMaterial,
  SphereGeometry,
} from "three";

/**
 * Night to Day — a time-of-day sky kit driven by a single 0–1 value.
 *
 * `uDayProgress` is the world's whole clock: 0 is dusk (stars out, sun below
 * the skyline, indigo haze) and 1 is dawn (sun up, warm horizon, zenith lit).
 * The scene moves it with sustained effort — the rider's work is the sun
 * coming up (docs/WORLD-SYSTEM.md §8, "Night to Day").
 *
 * Dawn colours come from the palette (`uZenith`/`uHorizon` are written from
 * the theme every render); the night end is a mechanical darken of the same
 * colours, so the kit keeps the one-colour-vocabulary rule. The skyline is
 * the shared neon skyline band — a silhouette against the brightening sky.
 */

export const DAYCYCLE_SKY_RADIUS = 1800;

/** Elevation (radians) the sun travels over the cycle: below the ridge → mid-sky. */
const SUN_LOW = -0.07;
const SUN_HIGH = 0.38;

export const DAYCYCLE_SKY_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const DAYCYCLE_SKY_FRAGMENT = /* glsl */ `
#include <common>
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform float uDayProgress;
varying vec3 vWorld;
void main() {
  vec3 dir = normalize(vWorld - cameraPosition);
  float h = dir.y;
  float up = clamp(h, 0.0, 1.0);
  float day = clamp(uDayProgress, 0.0, 1.0);

  // Night end: the same palette darkened — dusk is the dawn palette asleep.
  vec3 nightZenith = uZenith * vec3(0.10, 0.12, 0.30);
  vec3 nightHaze = uHorizon * vec3(0.35, 0.30, 0.45);

  vec3 dusk = mix(nightHaze, nightZenith, smoothstep(0.0, 0.55, up));
  vec3 dawn = mix(uHorizon, uZenith, smoothstep(0.0, 0.7, up));
  vec3 sky = mix(dusk, dawn, smoothstep(0.15, 0.9, day));

  // The sun: one disc climbing a fixed azimuth as the day advances. Its glow
  // warms the horizon band around it before the disc itself clears the ridge.
  float sunElev = mix(${SUN_LOW.toFixed(3)}, ${SUN_HIGH.toFixed(3)}, smoothstep(0.05, 0.95, day));
  vec3 sunDir = normalize(vec3(0.8, sin(sunElev), 0.6 * cos(sunElev)));
  float sunDot = max(dot(dir, sunDir), 0.0);
  float disc = smoothstep(0.9994, 0.9999, sunDot) * smoothstep(0.1, 0.5, day);
  float glow = pow(sunDot, 24.0) * (0.35 + day * 0.65) * (1.0 - smoothstep(0.25, 0.6, up));
  vec3 sunColor = mix(vec3(1.0, 0.55, 0.35), vec3(1.0, 0.92, 0.72), day);
  sky += sunColor * (disc * 1.4 + glow * 0.8);

  // Stars die with the night — same hash field as the neon sky, fading out.
  vec2 cell = floor(dir.xz * vec2(90.0, 70.0) + dir.y * 40.0);
  float star = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  float starMask = step(0.996, star) * smoothstep(0.30, 0.5, h) * (1.0 - smoothstep(0.15, 0.55, day));
  sky += vec3(0.8, 0.86, 1.0) * starMask * 0.5;

  // Below the skyline, hold the haze colour so a gap reads as fog.
  float above = smoothstep(-0.04, 0.07, h);
  sky = mix(mix(nightHaze, uHorizon, day), sky, above);

  gl_FragColor = vec4(sky, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createDaycycleSkyMaterial(zenith: string, horizon: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uZenith: { value: new Color(zenith) },
      uHorizon: { value: new Color(horizon) },
      uDayProgress: { value: 0 },
    },
    vertexShader: DAYCYCLE_SKY_VERTEX,
    fragmentShader: DAYCYCLE_SKY_FRAGMENT,
    // Fog on the dome would flatten it past fogFar; the horizon uniform is
    // the fog colour, so the skirt's fade lands on this sky.
    fog: false,
    side: BackSide,
    depthWrite: false,
    toneMapped: true,
  });
}

export function createDaycycleSkyGeometry(): SphereGeometry {
  return new SphereGeometry(DAYCYCLE_SKY_RADIUS, 28, 16);
}
