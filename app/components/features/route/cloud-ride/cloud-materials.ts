/**
 * Cloud ride materials — sky dome shader, emissive pulse strip, toon ramp.
 * All shaders are built once in useMemo and carry the tone-mapping /
 * colorspace chunks so output lands in the right space.
 */

import { BackSide, Color, DataTexture, NearestFilter, RedFormat, ShaderMaterial, SphereGeometry, Vector3 } from "three";

export const CLOUD_SKY = {
  zenith: "#69b7f3",
  horizon: "#ffe9ce",
  nadir: "#c9bbec",
  sunDir: new Vector3(0.65, 0.24, 0.72).normalize(), // warm disc into the forward view
  sunColor: "#fff0d2",
};

const SKY_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const SKY_FRAG = /* glsl */ `
#include <common>
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uNadir;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uWarmth;
varying vec3 vWorld;
void main() {
  vec3 dir = normalize(vWorld - cameraPosition);
  float h = dir.y;
  vec3 sky = h >= 0.0
    ? mix(uHorizon, uZenith, pow(clamp(h * 2.2, 0.0, 1.0), 0.55))
    : mix(uHorizon, uNadir, pow(clamp(-h, 0.0, 1.0), 0.6));
  // Warm sun disc + gentle halo, never a bloom substitute.
  float sd = max(dot(dir, normalize(uSunDir)), 0.0);
  float disc = smoothstep(cos(0.055), 1.0, sd);
  float halo = pow(sd, 24.0) * 0.35;
  sky += uSunColor * (disc * 0.85 + halo) * (1.0 + uWarmth * 0.3);
  // Subtle warmth lift across the whole sky during the reveal.
  sky = mix(sky, sky * vec3(1.06, 1.0, 0.92), uWarmth * 0.35);
  gl_FragColor = vec4(sky, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createCloudSkyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uZenith: { value: new Color(CLOUD_SKY.zenith) },
      uHorizon: { value: new Color(CLOUD_SKY.horizon) },
      uNadir: { value: new Color(CLOUD_SKY.nadir) },
      uSunDir: { value: CLOUD_SKY.sunDir.clone() },
      uSunColor: { value: new Color(CLOUD_SKY.sunColor) },
      uWarmth: { value: 0 },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    fog: false,
    side: BackSide,
    depthWrite: false,
    toneMapped: false,
  });
}

export function createCloudSkyGeometry(): SphereGeometry {
  return new SphereGeometry(1500, 36, 20);
}

/**
 * Thin mint pulse strip on the deck — travelling soft bands keyed to
 * seconds (uTime) and effort (uEffort). Unlit; UV.y is the route fraction.
 */
const PULSE_FRAG = /* glsl */ `
#include <common>
uniform float uTime;
uniform float uEffort;
varying vec2 vUv;
void main() {
  float band = fract(vUv.y * 8.0 - uTime * (0.10 + 0.08 * uEffort));
  float pulse = smoothstep(0.0, 0.35, band) * (1.0 - smoothstep(0.35, 1.0, band));
  vec3 base = vec3(0.608, 0.91, 0.859); // mint
  vec3 col = base * (0.55 + 0.75 * pulse + 0.35 * uEffort);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const PULSE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export function createPulseMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uEffort: { value: 0 } },
    vertexShader: PULSE_VERT,
    fragmentShader: PULSE_FRAG,
    fog: false,
    toneMapped: false,
  });
}

/** 4-step gradient map for MeshToonMaterial (rider + kit). */
export function toonGradientMap(): DataTexture {
  const data = new Uint8Array([90, 140, 200, 255]);
  const tex = new DataTexture(data, 4, 1, RedFormat);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
