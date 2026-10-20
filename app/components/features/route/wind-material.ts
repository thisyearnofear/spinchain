import * as THREE from "three";

/**
 * Wind — the world reacts to a moving air.
 *
 * The technique is the one used by stylized grass and foliage: displace
 * vertices in the *vertex* shader, weighted by the vertex's height above the
 * prop's base, so the trunk stays planted and the tips move most. Nothing
 * touches the CPU per frame — the instance matrices are uploaded once and
 * never written again; the motion is one uniform.
 *
 * The displacement is applied in world space (after the instance matrix, before
 * the model-view transform), so every prop in the world leans the same way.
 * A per-instance phase derived from the instance's own origin keeps the
 * motion from looking like a single rigid wave.
 *
 * Cost: one `sin`/`cos` set and one vector add per vertex. No CPU work, no
 * extra draw calls, no extra memory.
 */

/**
 * Shared uniform objects. Every wind-enabled material points at these exact
 * objects, so one write per frame updates the whole world.
 */
export const WIND_UNIFORMS = {
  uWindTime: { value: 0 },
  uWindStrength: { value: 0.6 },
};

/**
 * How much each prop type moves in the wind.
 *
 * Trees and blossom respond strongly; crystals barely shimmer; rocks and
 * buildings do not move at all — they are the thing the wind moves *around*.
 */
export const WIND_FACTORS: Record<string, number> = {
  tree: 1,
  blossom: 1.15,
  crystal: 0.22,
  rock: 0,
  building: 0,
};

export function windFactorFor(propType: string): number {
  return WIND_FACTORS[propType] ?? 0;
}

/**
 * Patch a standard material so its vertices sway with the wind.
 *
 * `onBeforeCompile` is the only supported hook for injecting into
 * MeshStandardMaterial without shipping a custom shader. The injected code:
 *  - reads the instance's world origin for a per-prop phase,
 *  - computes the vertex's height above the prop's base,
 *  - offsets the vertex in world space by a gusting, two-frequency sway.
 */
export function applyWind(
  material: THREE.Material,
  opts: { factor?: number } = {},
): void {
  const factor = opts.factor ?? 1;
  if (factor <= 0) return;

  const previousCompile = material.onBeforeCompile;

  material.onBeforeCompile = (shader, renderer) => {
    if (previousCompile) previousCompile.call(material, shader, renderer);

    shader.uniforms.uWindTime = WIND_UNIFORMS.uWindTime;
    shader.uniforms.uWindStrength = WIND_UNIFORMS.uWindStrength;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uWindTime;
        uniform float uWindStrength;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float windScaleY = length( instanceMatrix[1].xyz );
          vec3 windOrigin = vec3( instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2] );
        #else
          float windScaleY = 1.0;
          vec3 windOrigin = vec3( 0.0 );
        #endif
        float windHeight = max( transformed.y, 0.0 ) * windScaleY;
        float windPhase = dot( windOrigin.xz, vec2( 0.137, 0.219 ) );
        // Two fast frequencies plus one slow swell: the fast pair reads as
        // flutter, the slow one as a gust passing through the world.
        float windGust = 0.62 + 0.38 * sin( uWindTime * 0.37 + windPhase * 0.6 );
        float windSway =
            sin( uWindTime * 1.90 + windPhase ) * 0.60
          + sin( uWindTime * 3.70 + windPhase * 2.10 ) * 0.26
          + sin( uWindTime * 0.85 + windPhase * 0.40 ) * 0.44;
        // Quadratic in height: a tip moves, a trunk barely does.
        float windAmp = uWindStrength * ${factor.toFixed(3)} * windGust * windHeight * windHeight * 0.014;`,
      )
      // Insert the world-space offset immediately before the model-view
      // transform.
      //
      // `onBeforeCompile` runs BEFORE three resolves `#include` directives,
      // so the chunk body is not in the string yet — the only thing we can
      // match is the `#include` line itself. We therefore inline the chunk
      // (three r182's project_vertex) with the offset spliced in. The chunk
      // body is stable across recent three releases; if it ever changes, the
      // guard below turns a silent no-op into a loud one.
      .replace(
        "#include <project_vertex>",
        `vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_BATCHING
          mvPosition = batchingMatrix * mvPosition;
        #endif
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        mvPosition.x += windSway * windAmp;
        mvPosition.z += windSway * windAmp * 0.45;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`,
      );

    if (!shader.vertexShader.includes("windSway * windAmp")) {
      // The include was not found — the chunk name changed. Wind silently
      // doing nothing is worse than a visible warning.
      console.warn(
        "[spinchain] wind: could not patch <project_vertex>; the world will not sway",
      );
    }
  };

  // Without a distinct cache key, a wind-enabled material and a plain one
  // with otherwise identical parameters would share a compiled program.
  material.customProgramCacheKey = () => `spinchain-wind-${factor.toFixed(3)}`;
  material.needsUpdate = true;
}
