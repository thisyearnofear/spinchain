/**
 * Cloud ride geometry — the sculpted ribbon and shared route frame.
 *
 * One rounded-rectangle ribbon swept along the authored curve with a gentle
 * signed bank (max ±0.08 rad, zero under reduced motion). `cloudFrameAt`
 * returns the road/rider/marker frame so tyres, shadows and dashes all sit
 * on the same banked deck — never a Frenet roll.
 */

import { BufferAttribute, BufferGeometry, Color, Matrix4, Quaternion, Vector3, type CatmullRomCurve3 } from "three";

export const CLOUD_ROAD_WIDTH = 5.2;
export const CLOUD_ROAD_HALF = CLOUD_ROAD_WIDTH / 2;
export const CLOUD_ROAD_THICKNESS = 0.85;
export const CLOUD_ROAD_SEGMENTS = 400;

export const CLOUD_COLORS = {
  top: "#dcc6f2", // warm lilac deck
  bevel: "#fff0cc", // cream rounded edges
  underside: "#9375bf", // plum belly
  piping: "#9be8db", // mint edge piping (trim strips)
};

export interface CloudFrame {
  point: Vector3;
  tangent: Vector3;
  side: Vector3;
  up: Vector3;
  /** Signed bank in radians, clamped ±0.08. */
  bank: number;
}

const _t0 = new Vector3();
const _t1 = new Vector3();
const _upWorld = new Vector3(0, 1, 0);
const _roll = new Quaternion();

function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * The shared road frame at arc u. `out` supplies every scratch vector so
 * per-frame callers never allocate.
 */
export function cloudFrameAt(curve: CatmullRomCurve3, u: number, out: CloudFrame, banked = true): CloudFrame {
  const uu = Math.min(1, Math.max(0, u));
  curve.getPointAt(uu, out.point);
  curve.getTangentAt(uu, out.tangent).normalize();
  out.side.crossVectors(out.tangent, _upWorld);
  if (out.side.lengthSq() < 1e-10) out.side.set(1, 0, 0);
  out.side.normalize();
  out.up.crossVectors(out.side, out.tangent).normalize();

  // Signed turn rate sampled across u±.01 → bank, clamped.
  curve.getTangentAt(Math.min(1, uu + 0.01), _t1);
  curve.getTangentAt(Math.max(0, uu - 0.01), _t0);
  const yaw1 = Math.atan2(_t1.x, _t1.z);
  const yaw0 = Math.atan2(_t0.x, _t0.z);
  // Signed turn over the ±.01 window, scaled and clamped — no /du (that
  // saturated to ±.08 and snapped at inflections).
  const turn = wrapAngle(yaw1 - yaw0);
  out.bank = banked ? Math.max(-0.08, Math.min(0.08, turn * 0.7)) : 0;

  if (out.bank !== 0) {
    _roll.setFromAxisAngle(out.tangent, out.bank);
    out.side.applyQuaternion(_roll);
    out.up.applyQuaternion(_roll);
  }
  return out;
}

/** 12-point rounded-rect cross-section (lateral, vertical) + color role. */
const PROFILE: [number, number, keyof typeof CLOUD_COLORS][] = [
  [-2.35, 0, "top"],
  [2.35, 0, "top"],
  [2.52, -0.04, "bevel"],
  [2.6, -0.2, "bevel"],
  [2.6, -0.65, "underside"],
  [2.52, -0.81, "underside"],
  [2.35, -0.85, "underside"],
  [-2.35, -0.85, "underside"],
  [-2.52, -0.81, "underside"],
  [-2.6, -0.65, "underside"],
  [-2.6, -0.2, "bevel"],
  [-2.52, -0.04, "bevel"],
];

/**
 * Sculpted ribbon: indexed quad strip between 400 stations of the 12-point
 * profile. Vertex colors carry top/bevel/underside roles (one draw call).
 * UV.y = route fraction for the emissive pulse strip. `banked=false` builds
 * the reduced-motion flat variant.
 */
export function buildCloudRoadGeometry(curve: CatmullRomCurve3, banked = true): BufferGeometry {
  const N = PROFILE.length;
  const S = CLOUD_ROAD_SEGMENTS;
  const positions = new Float32Array((S + 1) * N * 3);
  const uvs = new Float32Array((S + 1) * N * 2);
  const colors = new Float32Array((S + 1) * N * 3);
  const frame: CloudFrame = { point: new Vector3(), tangent: new Vector3(), side: new Vector3(), up: new Vector3(), bank: 0 };
  const v = new Vector3();
  const col = new Color();

  for (let i = 0; i <= S; i++) {
    const u = i / S;
    cloudFrameAt(curve, u, frame, banked);
    for (let j = 0; j < N; j++) {
      const [lx, ly, role] = PROFILE[j];
      v.copy(frame.point).addScaledVector(frame.side, lx).addScaledVector(frame.up, ly);
      const o = (i * N + j) * 3;
      positions[o] = v.x;
      positions[o + 1] = v.y;
      positions[o + 2] = v.z;
      uvs[(i * N + j) * 2] = j / (N - 1);
      uvs[(i * N + j) * 2 + 1] = u;
      col.set(CLOUD_COLORS[role]);
      colors[o] = col.r;
      colors[o + 1] = col.g;
      colors[o + 2] = col.b;
    }
  }
  const index: number[] = [];
  for (let i = 0; i < S; i++) {
    for (let j = 0; j < N; j++) {
      const a = i * N + j;
      const b = i * N + ((j + 1) % N);
      const c = (i + 1) * N + j;
      const d = (i + 1) * N + ((j + 1) % N);
      index.push(a, b, c, b, d, c);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(positions, 3));
  geo.setAttribute("uv", new BufferAttribute(uvs, 2));
  geo.setAttribute("color", new BufferAttribute(colors, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** Thin mint piping strips hugging the deck's top corners. */
export function buildCloudPiping(curve: CatmullRomCurve3, banked = true): BufferGeometry {
  const S = CLOUD_ROAD_SEGMENTS;
  const positions: number[] = [];
  const uvs: number[] = [];
  const frame: CloudFrame = { point: new Vector3(), tangent: new Vector3(), side: new Vector3(), up: new Vector3(), bank: 0 };
  const halfW = 0.08;
  const at = (u: number, lat: number) =>
    new Vector3().copy(frame.point).addScaledVector(frame.side, lat).addScaledVector(frame.up, 0.02);
  for (const sign of [-1, 1]) {
    for (let i = 0; i < S; i++) {
      cloudFrameAt(curve, i / S, frame, banked);
      const a0 = at(i / S, sign * (2.35 - halfW));
      const a1 = at(i / S, sign * (2.35 + halfW));
      cloudFrameAt(curve, (i + 1) / S, frame, banked);
      const b0 = at((i + 1) / S, sign * (2.35 - halfW));
      const b1 = at((i + 1) / S, sign * (2.35 + halfW));
      // Winding per side keeps both strips facing up (same lesson as the
      // lab trims: opposite signs need opposite quad order).
      if (sign === 1) positions.push(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, b1.x, b1.y, b1.z, a0.x, a0.y, a0.z, b1.x, b1.y, b1.z, b0.x, b0.y, b0.z);
      else positions.push(a1.x, a1.y, a1.z, a0.x, a0.y, a0.z, b0.x, b0.y, b0.z, a1.x, a1.y, a1.z, b0.x, b0.y, b0.z, b1.x, b1.y, b1.z);
      const u0 = i / S, u1 = (i + 1) / S;
      uvs.push(0, u0, 1, u0, 1, u1, 0, u0, 1, u1, 0, u1);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

const _mDash = new Matrix4();
const _neg = new Vector3();

/** Inset dash markers — consistent spacing, motion reference only. */
export function cloudDashPlacements(curve: CatmullRomCurve3, count = 36, banked = true): Matrix4[] {
  const mats: Matrix4[] = [];
  const frame: CloudFrame = { point: new Vector3(), tangent: new Vector3(), side: new Vector3(), up: new Vector3(), bank: 0 };
  const q = new Quaternion();
  const one = new Vector3(1, 1, 1);
  for (let i = 0; i < count; i++) {
    const u = 0.05 + (0.9 * i) / (count - 1);
    cloudFrameAt(curve, u, frame, banked);
    // Basis: localX = −side (left), localY = banked up, localZ = tangent —
    // same frame the rider uses, so dashes lie ON the deck.
    _mDash.makeBasis(_neg.copy(frame.side).negate(), frame.up, frame.tangent);
    q.setFromRotationMatrix(_mDash);
    mats.push(
      new Matrix4().compose(frame.point.clone().addScaledVector(frame.up, 0.015), q, one),
    );
  }
  return mats;
}
