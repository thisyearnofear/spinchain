import * as THREE from "three";

/**
 * Height fog — Sleepers' fake volumetric technique.
 *
 * The vertical dimension of the world haze: fragments whose *world Y* sits
 * in a low band mix toward the theme's fog colour, weighted by how far they
 * are from the camera. The ground melts into mist, ridgelines read as
 * distant, and the road's far end dissolves into the same colour the skirt
 * already fades to.
 *
 * Same contract as `wind-material.ts`:
 *  - one shared uniform object per channel, so a theme change is one write;
 *  - an `onBeforeCompile` injection that *preserves* the include lines it
 *    latches onto (chaining with `applyWind` relies on this — both patches
 *    compose because each keeps the `#include` text intact);
 *  - fragment-side change inside `fog_fragment`, which every standard
 *    material compiles when scene fog is active (Scene always attaches one).
 *
 * The patch never touches `project_vertex` (that chunk is fully inlined by
 * the wind patch; a second replace there would find nothing and the wind
 * guard would fire). World Y never changes with the wind anyway — the sway
 * is purely horizontal.
 */

export const HEIGHT_FOG_UNIFORMS = {
  uHFogColor: { value: new THREE.Color("#07090f") },
  /** World-Y band: fragments below `yNear` fog fully, above `yFar` not at all. */
  uHFogYNear: { value: 0.5 },
  uHFogYFar: { value: 22 },
  /** View-distance band: the near road/props stay crisp, the horizon melts. */
  uHFogDistNear: { value: 36 },
  uHFogDistFar: { value: 205 },
  uHFogStrength: { value: 0.85 },
};

export interface HeightFogOptions {
  /** Override the shared strength for this material (0..1). */
  strength?: number;
}

export function applyHeightFog(
  material: THREE.Material,
  opts: HeightFogOptions = {},
): void {
  const strength = opts.strength ?? HEIGHT_FOG_UNIFORMS.uHFogStrength.value;

  const previousCompile = material.onBeforeCompile;

  material.onBeforeCompile = (shader, renderer) => {
    if (previousCompile) previousCompile.call(material, shader, renderer);

    shader.uniforms.uHFogColor = HEIGHT_FOG_UNIFORMS.uHFogColor;
    shader.uniforms.uHFogYNear = HEIGHT_FOG_UNIFORMS.uHFogYNear;
    shader.uniforms.uHFogYFar = HEIGHT_FOG_UNIFORMS.uHFogYFar;
    shader.uniforms.uHFogDistNear = HEIGHT_FOG_UNIFORMS.uHFogDistNear;
    shader.uniforms.uHFogDistFar = HEIGHT_FOG_UNIFORMS.uHFogDistFar;
    shader.uniforms.uHFogStrength = { value: strength };

    // ── Vertex: pass world Y + view depth as varyings ────────────────
    // Appended *after* `fog_vertex`, which sits at the very end of
    // main() — `transformed`, `instanceMatrix` and `mvPosition` (from
    // project_vertex) are all in scope by then.
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uHFogYNear;
        uniform float uHFogYFar;
        varying float vHFogWorldY;
        varying float vHFogViewZ;`,
      )
      .replace(
        "#include <fog_vertex>",
        `#include <fog_vertex>
        #ifdef USE_INSTANCING
          vec4 hFogWorld = modelMatrix * instanceMatrix * vec4( transformed, 1.0 );
        #else
          vec4 hFogWorld = modelMatrix * vec4( transformed, 1.0 );
        #endif
        vHFogWorldY = hFogWorld.y;
        vHFogViewZ = -mvPosition.z;`,
      );

    // ── Fragment: mix toward the haze inside fog_fragment ────────────
    // fog_fragment already mixes scene fog into gl_FragColor.rgb; the
    // height fog rides along in the same vein.
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uHFogColor;
        uniform float uHFogYNear;
        uniform float uHFogYFar;
        uniform float uHFogDistNear;
        uniform float uHFogDistFar;
        uniform float uHFogStrength;
        varying float vHFogWorldY;
        varying float vHFogViewZ;`,
      )
      .replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>
        float hFogY = 1.0 - smoothstep( uHFogYNear, uHFogYFar, vHFogWorldY );
        float hFogDist = smoothstep( uHFogDistNear, uHFogDistFar, vHFogViewZ );
        float hFog = hFogY * hFogDist * uHFogStrength;
        gl_FragColor.rgb = mix( gl_FragColor.rgb, uHFogColor, hFog );`,
      );

    if (!shader.fragmentShader.includes("hFogY * hFogDist")) {
      console.warn(
        "[spinchain] height fog: could not patch <fog_fragment>; the haze will not render",
      );
    }
  };

  material.customProgramCacheKey = () => "spinchain-hfog";
  material.needsUpdate = true;
}
