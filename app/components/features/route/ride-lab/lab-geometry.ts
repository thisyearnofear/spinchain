/**
 * Ride lab road geometry — pure builders, no React, no R3F.
 *
 * One horizontal ribbon swept along the lab curve. "Horizontal" means the
 * deck normal stays world-up: the lateral axis is tangent × (0,1,0), never
 * a Frenet binormal, so the road never rolls or banks. The ribbon has a top
 * face, a visible thin underside, and side faces — from a low chase camera
 * you see the road's edge, not a flat card.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
  type CatmullRomCurve3,
} from "three";
import { labSideAt } from "./config";

export const LAB_ROAD_WIDTH = 3.8;
export const LAB_ROAD_HALF = LAB_ROAD_WIDTH / 2;
export const LAB_ROAD_THICKNESS = 0.22;
export const LAB_ROAD_SEGMENTS = 320;
export const LAB_EDGE_OFFSET = 1.9;
export const LAB_EDGE_WIDTH = 0.07;

const UP = new Vector3(0, 1, 0);

export interface LabRoadColors {
  top: string;
  underside: string;
  side: string;
}

/** Append two triangles (a,b,c)(a,c,d) with one shared flat normal + colour. */
function addQuad(
  positions: number[],
  normals: number[],
  colors: number[] | null,
  color: Color | null,
  a: Vector3,
  b: Vector3,
  c: Vector3,
  d: Vector3,
  normal: Vector3,
) {
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  positions.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
  for (let i = 0; i < 6; i++) {
    normals.push(normal.x, normal.y, normal.z);
    if (colors && color) colors.push(color.r, color.g, color.b);
  }
}

/** Per-station corners: top-left, top-right, bottom-left, bottom-right. */
interface Station {
  tl: Vector3;
  tr: Vector3;
  bl: Vector3;
  br: Vector3;
  side: Vector3;
}

function roadStations(curve: CatmullRomCurve3, segments: number): Station[] {
  const stations: Station[] = [];
  const p = new Vector3();
  const side = new Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, p);
    labSideAt(curve, u, side);
    const tl = p.clone().addScaledVector(side, -LAB_ROAD_HALF);
    const tr = p.clone().addScaledVector(side, LAB_ROAD_HALF);
    const bl = tl.clone();
    const br = tr.clone();
    bl.y -= LAB_ROAD_THICKNESS;
    br.y -= LAB_ROAD_THICKNESS;
    stations.push({ tl, tr, bl, br, side: side.clone() });
  }
  return stations;
}

/**
 * The deck ribbon: top face (world-up normal), underside (down normal),
 * and both edge faces — four flat-shaded quad strips in one geometry.
 * Per-face vertex colours let one mesh carry the matte deck and the darker
 * underside without a second draw call. Vertex layout per station is
 * tl,tr,br,bl quads so the first two positions measure the deck width.
 */
export function buildLabRoadGeometry(curve: CatmullRomCurve3, colors: LabRoadColors): BufferGeometry {
  const stations = roadStations(curve, LAB_ROAD_SEGMENTS);
  const positions: number[] = [];
  const normals: number[] = [];
  const vertexColors: number[] = [];
  const down = new Vector3(0, -1, 0);
  const negSide = new Vector3();
  const cTop = new Color(colors.top);
  const cBottom = new Color(colors.underside);
  const cSide = new Color(colors.side);

  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i];
    const b = stations[i + 1];
    addQuad(positions, normals, vertexColors, cTop, a.tl, a.tr, b.tr, b.tl, UP); // top
    addQuad(positions, normals, vertexColors, cBottom, a.br, a.bl, b.bl, b.br, down); // underside
    addQuad(positions, normals, vertexColors, cSide, a.bl, a.tl, b.tl, b.bl, negSide.copy(a.side).negate()); // left edge
    addQuad(positions, normals, vertexColors, cSide, a.tr, a.br, b.br, b.tr, a.side); // right edge
  }

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
  geo.setAttribute("color", new BufferAttribute(new Float32Array(vertexColors), 3));
  geo.computeBoundingSphere();
  return geo;
}

/**
 * A thin horizontal strip floating just above the deck at a fixed lateral
 * offset — the road's edge trim lines (cloud trim, neon cyan). Both offsets
 * in one geometry.
 */
export function buildLabEdgeTrims(curve: CatmullRomCurve3): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const lift = 0.012; // sit proud of the deck, no z-fight
  const p = new Vector3();
  const side = new Vector3();
  const edgePoint = (u: number, lateral: number) => {
    curve.getPointAt(u, p);
    labSideAt(curve, u, side);
    return p.clone().addScaledVector(side, lateral).setY(p.y + lift);
  };

  for (const sign of [-1, 1] as const) {
    const eIn = sign * (LAB_EDGE_OFFSET - LAB_EDGE_WIDTH / 2);
    const eOut = sign * (LAB_EDGE_OFFSET + LAB_EDGE_WIDTH / 2);
    for (let i = 0; i < LAB_ROAD_SEGMENTS; i++) {
      const u0 = i / LAB_ROAD_SEGMENTS;
      const u1 = (i + 1) / LAB_ROAD_SEGMENTS;
      // Ordering keeps the strip's visible face up for both signs.
      const aIn = edgePoint(u0, eIn);
      const aOut = edgePoint(u0, eOut);
      const bIn = edgePoint(u1, eIn);
      const bOut = edgePoint(u1, eOut);
      // Winding differs per side or the −edge strip backfaces.
      if (sign === 1) addQuad(positions, normals, null, null, aIn, aOut, bOut, bIn, UP);
      else addQuad(positions, normals, null, null, aOut, aIn, bIn, bOut, UP);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Transverse dash marks on the deck — instanced, fixed density, purely a
 * speed reference. Never driven by effort.
 */
export function labDistanceMarkPlacements(curve: CatmullRomCurve3, count = 44): Matrix4[] {
  const mats: Matrix4[] = [];
  const p = new Vector3();
  const t = new Vector3();
  const q = new Quaternion();
  const one = new Vector3(1, 1, 1);
  for (let i = 0; i < count; i++) {
    const u = 0.03 + (0.94 * i) / (count - 1);
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    q.setFromEuler(new Euler(0, Math.atan2(t.x, t.z), 0));
    p.y += 0.015;
    mats.push(new Matrix4().compose(p, q, one));
  }
  return mats;
}
