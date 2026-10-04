import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Euler,
  Matrix4,
  OctahedronGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { SKIRT_STEPS, skirtSurfacePoint } from "./route-skirt";

export type PropType = "building" | "tree" | "rock" | "blossom" | "crystal";
export type PropShape = "box" | "cylinder" | "cone" | "sphere" | "dodecahedron" | "octahedron";

export interface PropConfig {
  type: PropType;
  color: string;
  count: number;
  scale: readonly [number, number, number];
}

/**
 * One silhouette per world, two or three primitives, local Y up, base on y=0
 * so instance scale grows them off the skirt instead of through it.
 *
 * - tree: cylinder trunk + two stacked cones (pine, not a single cone)
 * - building: wide podium + narrower tower + thin lit cap
 * - rock: three grounded stones, largest in the middle, radii decreasing
 * - blossom: stem + crown bloom + smaller side bloom
 * - crystal: low point + tall shard + shorter leaning shard
 *
 * At most one part breathes. The visualizer writes that part's
 * emissiveIntensity once per frame — one uniform, not a material walk.
 */
export interface SilhouettePart {
  shape: PropShape;
  args: readonly number[];
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: readonly [number, number, number];
  /** Multiply the theme prop color. 1 keeps it exact. */
  shade: number;
  emissive: number;
  roughness: number;
  metalness: number;
  breathes: boolean;
}

const S = [1, 1, 1] as const;
const R0 = [0, 0, 0] as const;

export const SILHOUETTES: Record<PropType, readonly SilhouettePart[]> = {
  tree: [
    { shape: "cylinder", args: [0.14, 0.24, 1.05, 6], position: [0, 0.525, 0], rotation: R0, scale: S, shade: 0.42, emissive: 0.02, roughness: 0.9, metalness: 0, breathes: false },
    { shape: "cone", args: [1.05, 2.15, 7], position: [0, 1.9, 0], rotation: R0, scale: S, shade: 1, emissive: 0.06, roughness: 0.78, metalness: 0, breathes: false },
    { shape: "cone", args: [0.62, 1.55, 7], position: [0, 2.9, 0], rotation: R0, scale: S, shade: 1, emissive: 0.08, roughness: 0.74, metalness: 0, breathes: false },
  ],
  building: [
    { shape: "box", args: [1.3, 0.18, 1.3], position: [0, 0.09, 0], rotation: R0, scale: S, shade: 0.5, emissive: 0.08, roughness: 0.45, metalness: 0.35, breathes: false },
    { shape: "box", args: [0.68, 0.64, 0.68], position: [0, 0.5, 0], rotation: R0, scale: S, shade: 0.82, emissive: 0.16, roughness: 0.38, metalness: 0.42, breathes: false },
    { shape: "box", args: [0.16, 0.18, 0.16], position: [0, 0.91, 0], rotation: R0, scale: S, shade: 1, emissive: 0.5, roughness: 0.25, metalness: 0.55, breathes: true },
  ],
  rock: [
    { shape: "dodecahedron", args: [0.72], position: [0, 0.58, 0], rotation: [0.25, 0.4, 0.1], scale: [1.15, 0.78, 1.05], shade: 1, emissive: 0.04, roughness: 0.94, metalness: 0.02, breathes: false },
    { shape: "dodecahedron", args: [0.36], position: [0.66, 0.3, 0.12], rotation: [0.4, 0.2, 0.35], scale: S, shade: 0.72, emissive: 0.03, roughness: 0.94, metalness: 0.02, breathes: false },
    { shape: "dodecahedron", args: [0.2], position: [-0.5, 0.16, 0.28], rotation: [0.2, 0.9, 0.15], scale: S, shade: 0.55, emissive: 0.02, roughness: 0.94, metalness: 0.02, breathes: false },
  ],
  blossom: [
    { shape: "cylinder", args: [0.07, 0.12, 7, 5], position: [0, 3.5, 0], rotation: R0, scale: S, shade: 0.48, emissive: 0.02, roughness: 0.8, metalness: 0, breathes: false },
    { shape: "sphere", args: [1.7, 7, 5], position: [0, 7.15, 0], rotation: R0, scale: S, shade: 1, emissive: 0.28, roughness: 0.42, metalness: 0.04, breathes: false },
    { shape: "sphere", args: [0.95, 7, 5], position: [0.85, 5.35, 0.25], rotation: R0, scale: S, shade: 0.9, emissive: 0.22, roughness: 0.42, metalness: 0.04, breathes: false },
  ],
  crystal: [
    { shape: "octahedron", args: [0.4], position: [0, 0.28, 0], rotation: R0, scale: S, shade: 0.62, emissive: 0.25, roughness: 0.18, metalness: 0.2, breathes: false },
    { shape: "octahedron", args: [0.72], position: [0, 1.2, 0], rotation: R0, scale: [0.38, 1.45, 0.38], shade: 1, emissive: 0.8, roughness: 0.12, metalness: 0.28, breathes: true },
    { shape: "octahedron", args: [0.36], position: [0.32, 0.72, 0], rotation: [0, 0, 0.42], scale: [0.55, 1.15, 0.55], shade: 0.8, emissive: 0.4, roughness: 0.14, metalness: 0.24, breathes: false },
  ],
};

export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

export function shadeHex(hex: string, factor: number): string {
  if (factor === 1) return hex;
  const n = hex.startsWith("#") ? hex.slice(1) : hex;
  const channel = (start: number) => {
    const value = Math.round(parseInt(n.slice(start, start + 2), 16) * factor);
    return Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

const geometryCache = new Map<string, BufferGeometry>();

export function createPartGeometry(part: { shape: PropShape; args: readonly number[] }): BufferGeometry {
  switch (part.shape) {
    case "box":
      return new BoxGeometry(part.args[0], part.args[1], part.args[2]);
    case "cylinder":
      return new CylinderGeometry(part.args[0], part.args[1], part.args[2], part.args[3] ?? 6);
    case "cone":
      return new ConeGeometry(part.args[0], part.args[1], part.args[2] ?? 7);
    case "sphere":
      return new SphereGeometry(part.args[0], part.args[1] ?? 7, part.args[2] ?? 5);
    case "dodecahedron":
      return new DodecahedronGeometry(part.args[0], 0);
    case "octahedron":
      return new OctahedronGeometry(part.args[0], 0);
    default:
      return new BoxGeometry(1, 1, 1);
  }
}

/** Shared across instances. A handful of primitives for the life of the page. */
export function getPartGeometry(part: { shape: PropShape; args: readonly number[] }): BufferGeometry {
  const key = `${part.shape}:${part.args.join(",")}`;
  let geometry = geometryCache.get(key);
  if (!geometry) {
    geometry = createPartGeometry(part);
    geometryCache.set(key, geometry);
  }
  return geometry;
}

export interface PropPartField {
  id: string;
  shape: PropShape;
  args: readonly number[];
  color: string;
  emissive: number;
  roughness: number;
  metalness: number;
  breathes: boolean;
  matrices: Float32Array;
  count: number;
}

export interface PropField {
  type: PropType;
  parts: PropPartField[];
}

const _propPos = new Vector3();
const _propQuat = new Quaternion();
const _propScale = new Vector3();
const _euler = new Euler();
const _localPos = new Vector3();
const _localQuat = new Quaternion();
const _localScale = new Vector3();
const _propMatrix = new Matrix4();
const _localMatrix = new Matrix4();
const _outMatrix = new Matrix4();
const WORLD_UP = new Vector3(0, 1, 0);

/** Ground contact for prop `index`, on the same skirt the road sits on. */
export function propOrigin(
  curve: CatmullRomCurve3,
  frames: ReturnType<CatmullRomCurve3["computeFrenetFrames"]>,
  index: number,
  roadHalfWidth: number,
  target: Vector3,
): Vector3 {
  const u = seededRandom(index);
  const lateral = (index % 2 === 0 ? 1 : -1) * (8 + seededRandom(index + 1000) * 15);
  return skirtSurfacePoint(curve, frames, SKIRT_STEPS, u, lateral, roadHalfWidth, target);
}

/**
 * Instance matrices for every part of the theme's silhouette.
 * Built once per curve/theme — the frame loop only touches a single
 * emissive uniform on the breathing part.
 */
export function buildPropField(
  curve: CatmullRomCurve3,
  config: PropConfig,
  roadHalfWidth: number,
): PropField {
  const spec = SILHOUETTES[config.type];
  const count = Math.max(0, Math.floor(config.count));
  const frames = curve.computeFrenetFrames(SKIRT_STEPS, true);
  const parts: PropPartField[] = spec.map((part, partIndex) => ({
    id: `${config.type}-${partIndex}`,
    shape: part.shape,
    args: part.args,
    color: shadeHex(config.color, part.shade),
    emissive: part.emissive,
    roughness: part.roughness,
    metalness: part.metalness,
    breathes: part.breathes,
    matrices: new Float32Array(count * 16),
    count,
  }));

  for (let i = 0; i < count; i++) {
    propOrigin(curve, frames, i, roadHalfWidth, _propPos);
    _propQuat.setFromAxisAngle(WORLD_UP, seededRandom(i + 2000) * Math.PI * 2);
    _propScale.set(
      config.scale[0] * (0.8 + seededRandom(i + 3000) * 0.4),
      config.scale[1] * (0.5 + seededRandom(i + 4000) * 1.5),
      config.scale[2] * (0.8 + seededRandom(i + 5000) * 0.4),
    );
    _propMatrix.compose(_propPos, _propQuat, _propScale);

    for (let p = 0; p < spec.length; p++) {
      const part = spec[p];
      _euler.set(part.rotation[0], part.rotation[1], part.rotation[2]);
      _localMatrix.compose(
        _localPos.set(part.position[0], part.position[1], part.position[2]),
        _localQuat.setFromEuler(_euler),
        _localScale.set(part.scale[0], part.scale[1], part.scale[2]),
      );
      _outMatrix.multiplyMatrices(_propMatrix, _localMatrix);
      _outMatrix.toArray(parts[p].matrices, i * 16);
    }
  }

  return { type: config.type, parts };
}

/** Lowest local Y of a silhouette. 0 means the base meets the skirt origin. */
export function silhouetteBaseY(type: PropType): number {
  const spec = SILHOUETTES[type];
  let minY = Infinity;
  const position = new Vector3();
  for (const part of spec) {
    const geometry = createPartGeometry(part);
    const matrix = new Matrix4().compose(
      position.set(part.position[0], part.position[1], part.position[2]),
      new Quaternion().setFromEuler(new Euler(part.rotation[0], part.rotation[1], part.rotation[2])),
      new Vector3(part.scale[0], part.scale[1], part.scale[2]),
    );
    const attr = geometry.getAttribute("position");
    const vertex = new Vector3();
    for (let i = 0; i < attr.count; i++) {
      vertex.fromBufferAttribute(attr, i).applyMatrix4(matrix);
      if (vertex.y < minY) minY = vertex.y;
    }
    geometry.dispose();
  }
  return minY;
}
