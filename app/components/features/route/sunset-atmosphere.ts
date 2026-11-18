import {
  BackSide,
  Color,
  ShaderMaterial,
  SphereGeometry,
} from "three";

/**
 * Sunset Ride — a golden-hour sky kit.
 *
 * The sun sits low and fixed on the horizon; the rider rides into it. The
 * sky is a warm gradient (palette-driven like every kit: `uZenith` deep
 * dusk blue, `uHorizon` amber haze) with a sun disc whose glow bleeds into
 * the horizon band, and two layers of soft cloud bands drifting on `uTime`
 * so the sky breathes even at a standstill.
 *
 * Colour vocabulary rule: the palette carries the world; the shader adds
 * structure (sun, clouds), not new hues — sun and cloud tints are derived
 * from the horizon colour.
 */

export const SUNSET_SKY_RADIUS = 1800;

/** Sun elevation (radians) and azimuth — low, ahead of the rider. */
const SUN_ELEVATION = 0.055;
const SUN_AZIMUTH = 0.8;

export const SUNSET_SKY_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const SUNSET_SKY_FRAGMENT = /* glsl */ `
#include <common>
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform float uTime;
varying vec3 vWorld;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec3 dir = normalize(vWorld - cameraPosition);
  float h = dir.y;
  float up = clamp(h, 0.0, 1.0);

  // The gradient: amber haze at the horizon into deep dusk at the zenith.
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.62, up));

  // The sun: a low disc on a fixed azimuth, warm core, wide glow that
  // pools into the horizon band around it.
  vec3 sunDir = normalize(vec3(sin(${SUN_AZIMUTH.toFixed(3)}), sin(${SUN_ELEVATION.toFixed(3)}), cos(${SUN_AZIMUTH.toFixed(3)})));
  float sunDot = max(dot(dir, sunDir), 0.0);
  float disc = smoothstep(0.99955, 0.99992, sunDot);
  float nearGlow = pow(sunDot, 40.0) * (1.0 - smoothstep(0.18, 0.55, up));
  float wideGlow = pow(sunDot, 9.0) * (1.0 - smoothstep(0.05, 0.4, up));
  vec3 sunCore = mix(uHorizon, vec3(1.0, 0.96, 0.86), 0.65);
  sky += sunCore * (disc * 1.5 + nearGlow * 0.9 + wideGlow * 0.35);

  // Cloud bands: two octaves of value noise stretched along the horizon,
  // drifting slowly. Lit from the sun side — edges toward the sun pick up
  // the warm core colour, away from it they sink into the zenith colour.
  float azimuth = atan(dir.x, dir.z);
  vec2 cloudUV = vec2(azimuth * 2.6, h * 9.0);
  float drift = uTime * 0.012;
  for (int layer = 0; layer < 2; layer++) {
    float fl = float(layer);
    vec2 uv = cloudUV * (1.0 + fl * 1.7) + vec2(drift * (1.0 + fl), fl * 3.1);
    float n = valueNoise(uv) * 0.62 + valueNoise(uv * 2.3 + 7.3) * 0.38;
    float band = smoothstep(0.52, 0.78, n)
      * smoothstep(0.02, 0.16, h)          // clouds live above the haze line
      * (1.0 - smoothstep(0.30, 0.62, h))  // and thin out toward the zenith
      * (0.55 - fl * 0.22);
    float lit = 0.5 + 0.5 * dot(normalize(vec3(dir.x, 0.0, dir.z)), normalize(vec3(sunDir.x, 0.0, sunDir.z)));
    vec3 cloudColor = mix(uZenith * 1.15, sunCore, lit * 0.8);
    sky = mix(sky, cloudColor, band);
  }

  // Below the skyline, hold the haze colour so a gap reads as fog.
  float above = smoothstep(-0.04, 0.07, h);
  sky = mix(uHorizon, sky, above);

  gl_FragColor = vec4(sky, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createSunsetSkyMaterial(zenith: string, horizon: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uZenith: { value: new Color(zenith) },
      uHorizon: { value: new Color(horizon) },
      uTime: { value: 0 },
    },
    vertexShader: SUNSET_SKY_VERTEX,
    fragmentShader: SUNSET_SKY_FRAGMENT,
    // Fog on the dome would flatten it past fogFar; the horizon uniform is
    // the fog colour, so the skirt's fade lands on this sky.
    fog: false,
    side: BackSide,
    depthWrite: false,
    toneMapped: true,
  });
}

export function createSunsetSkyGeometry(): SphereGeometry {
  return new SphereGeometry(SUNSET_SKY_RADIUS, 28, 16);
}
