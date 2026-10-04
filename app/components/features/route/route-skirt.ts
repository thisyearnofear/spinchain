import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  FrontSide,
  ShaderMaterial,
  Vector3,
  type Curve,
} from "three";

/**
 * Road cross-section, matching Road's extrude profile.
 * Shape X is the wide axis (±halfWidth) and shape Y is the 0.5 thickness.
 * On this course the Frenet normal points down, so the wide axis is vertical:
 * the road is a ribbon straddling the curve, and its lowest corner is what
 * the skirt has to catch.
 */
export const ROAD_PROFILE_HEIGHT = 0.5;

export function roadProfile(theme: string): { halfWidth: number; height: number } {
  return {
    halfWidth: theme === "rainbow" ? 4 : 2.5,
    height: ROAD_PROFILE_HEIGHT,
  };
}

/** Half-width of the ground strip. Props sit inside the solid center; the rest fades. */
export const SKIRT_HALF_WIDTH = 64;
export const SKIRT_STEPS = 160;
export const SKIRT_WIDTH_SEGMENTS = 8;
/** Extra sink so the ribbon's lowest edge rests on the skirt instead of z-fighting it. */
export const SKIRT_SINK = 0.06;
/** How far the outer edge falls, in world units. Hides the cut and tucks overlaps under. */
export const SKIRT_EDGE_DROP = 5;

const WORLD_UP = new Vector3(0, 1, 0);
const WORLD_X = new Vector3(1, 0, 0);

export function horizontalSide(tangent: Vector3, target: Vector3): Vector3 {
  target.crossVectors(tangent, WORLD_UP);
  if (target.lengthSq() < 1e-8) target.crossVectors(tangent, WORLD_X);
  return target.normalize();
}

/** World-Y offset from the curve point down to just under the road's lowest corner. */
export function roadBottomOffset(normal: Vector3, binormal: Vector3, halfWidth: number): number {
  const h = ROAD_PROFILE_HEIGHT;
  const corners: ReadonlyArray<readonly [number, number]> = [
    [-halfWidth, 0],
    [halfWidth, 0],
    [halfWidth * 0.9, h],
    [-halfWidth * 0.9, h],
  ];
  let minY = 0;
  for (let i = 0; i < corners.length; i++) {
    const [x, y] = corners[i];
    const offset = normal.y * x + binormal.y * y;
    if (offset < minY) minY = offset;
  }
  return minY - SKIRT_SINK;
}

/** 0 at the road, 1 at the skirt edge. */
export function skirtEdge(lateral: number): number {
  return Math.min(1, Math.abs(lateral) / SKIRT_HALF_WIDTH);
}

/** Added to the road-bottom offset. 0 at the center, -SKIRT_EDGE_DROP at the edge. */
export function skirtEdgeDrop(edge: number): number {
  const e = Math.min(1, Math.max(0, edge));
  return -SKIRT_EDGE_DROP * e * e;
}

export function frameIndex(u: number, steps: number): number {
  if (!Number.isFinite(u)) return 0;
  const clamped = Math.min(1, Math.max(0, u));
  return Math.min(steps, Math.max(0, Math.round(clamped * steps)));
}

type FrenetFrames = ReturnType<Curve<Vector3>["computeFrenetFrames"]>;

const _point = new Vector3();
const _tangent = new Vector3();
const _side = new Vector3();

/**
 * Point on the skirt surface. `lateral` is world-horizontal distance from the
 * curve, along the side perpendicular to travel. Reuses the curve the road
 * extrudes along — same arc-length samples and Frenet frames.
 */
export function skirtSurfacePoint(
  curve: CatmullRomCurve3,
  frames: FrenetFrames,
  steps: number,
  u: number,
  lateral: number,
  roadHalfWidth: number,
  target: Vector3,
): Vector3 {
  const uu = Number.isFinite(u) ? Math.min(1, Math.max(0, u)) : 0;
  curve.getPointAt(uu, _point);
  curve.getTangentAt(uu, _tangent);
  if (!Number.isFinite(_tangent.x) || _tangent.lengthSq() < 1e-10) {
    _side.set(1, 0, 0);
  } else {
    horizontalSide(_tangent, _side);
  }
  if (!Number.isFinite(_point.x)) _point.set(0, 0, 0);
  const fi = frameIndex(uu, steps);
  const drop = roadBottomOffset(frames.normals[fi], frames.binormals[fi], roadHalfWidth) + skirtEdgeDrop(skirtEdge(lateral));
  return target.set(
    _point.x + _side.x * lateral,
    _point.y + drop,
    _point.z + _side.z * lateral,
  );
}

/**
 * Horizontal strip under the route. Center follows the road's lowest edge;
 * the outer vertices darken and fall away. One static mesh — nothing here
 * runs per frame.
 */
export function buildRouteSkirtGeometry(curve: CatmullRomCurve3, roadHalfWidth: number, steps = SKIRT_STEPS): BufferGeometry {
  const widthSegments = SKIRT_WIDTH_SEGMENTS;
  const frames = curve.computeFrenetFrames(steps, true);
  const rings = steps + 1;
  const across = widthSegments + 1;
  const positions = new Float32Array(rings * across * 3);
  const uvs = new Float32Array(rings * across * 2);
  const point = new Vector3();

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    for (let j = 0; j <= widthSegments; j++) {
      const acrossT = j / widthSegments;
      const edge = Math.abs(acrossT * 2 - 1);
      const lateral = (acrossT * 2 - 1) * SKIRT_HALF_WIDTH;
      skirtSurfacePoint(curve, frames, steps, u, lateral, roadHalfWidth, point);
      const idx = (i * across + j) * 3;
      positions[idx] = point.x;
      positions[idx + 1] = point.y;
      positions[idx + 2] = point.z;
      const uvIdx = (i * across + j) * 2;
      uvs[uvIdx] = u;
      uvs[uvIdx + 1] = edge;
    }
  }

  const indices = new Uint16Array(steps * widthSegments * 6);
  let cursor = 0;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < widthSegments; j++) {
      const a = i * across + j;
      const b = a + 1;
      const c = (i + 1) * across + j;
      const d = c + 1;
      // Both triangles face world +Y (see horizontalSide: side × tangent ≈ up).
      indices[cursor++] = a;
      indices[cursor++] = b;
      indices[cursor++] = c;
      indices[cursor++] = b;
      indices[cursor++] = d;
      indices[cursor++] = c;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export const SKIRT_VERTEX_SHADER = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying float vEdge;
void main() {
  vEdge = uv.y;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

export const SKIRT_FRAGMENT_SHADER = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform vec3 uAccent;
varying float vEdge;
void main() {
  float edge = clamp(vEdge, 0.0, 1.0);
  // Terrain under the road, a hint of the theme accent, gone before the fade.
  vec3 albedo = mix(uColor, uAccent, 0.08 * (1.0 - edge));
  // Darken toward the rim, then dissolve into the scene fog color so the
  // cut reads as a horizon instead of a hole.
  float shade = mix(1.0, 0.22, smoothstep(0.05, 0.85, edge));
  gl_FragColor = vec4(albedo * shade, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
  #ifdef USE_FOG
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(0.42, 1.0, edge));
  #endif
}
`;

export function createSkirtMaterial(terrainColor: string, terrainAccent: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(terrainColor) },
      uAccent: { value: new Color(terrainAccent) },
    },
    vertexShader: SKIRT_VERTEX_SHADER,
    fragmentShader: SKIRT_FRAGMENT_SHADER,
    fog: true,
    depthWrite: true,
    side: FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
}
