/**
 * Ride lab world kits — deterministic layout descriptors, no React, no GL.
 *
 * Both worlds dress the SAME route through `labAnchorAt`: an arc position u,
 * a horizontal lateral offset, and a height offset from the route centre.
 * The study switch only changes which layouts get included; the base layer
 * (distant masses) is identical for every study so spatial comparisons stay
 * honest.
 *
 * Everything is instanced primitives. Clouds are opaque shaded lobes — no
 * volumetric raymarch — and neon is boxes; both are deliberately simple
 * prototype geometry for judging space, not finished art.
 */

import { Vector3, type CatmullRomCurve3 } from "three";
import { labAnchorAt, labSideAt, seeded, type LabStudy } from "./config";

/** One instanced ellipsoid/box: position + scale (+ yaw for boxes). */
export interface LabInstance {
  position: Vector3;
  scale: Vector3;
  yaw: number;
}

const inst = (p: Vector3, sx: number, sy: number, sz: number, yaw = 0): LabInstance => ({
  position: p.clone(),
  scale: new Vector3(sx, sy, sz),
  yaw,
});

// ─── Shared anchors ────────────────────────────────────────────────

/** Route-space point at u, lifted to `dy`, pushed `lateral` to one side. */
function anchor(curve: CatmullRomCurve3, u: number, lateral: number, dy: number): Vector3 {
  return labAnchorAt(curve, u, lateral, dy);
}

/** Yaw so a box's local +Z faces along the route tangent at u. */
function tangentYaw(curve: CatmullRomCurve3, u: number): number {
  const t = curve.getTangentAt(u, new Vector3());
  return Math.atan2(t.x, t.z);
}

// ─── Cloud world ───────────────────────────────────────────────────

export interface CloudField {
  /** Opaque lobes near the road — detail mesh (sphere 20×12). */
  near: LabInstance[];
  /** Opaque lobes far away — same detail mesh now; count stays bounded. */
  far: LabInstance[];
  /** Soft billboard impostors — ≤12, low opacity, depthWrite off. */
  wisps: LabInstance[];
}

function farClusterLobes(curve: CatmullRomCurve3, base: number): LabInstance[] {
  // ~40 broad clusters flanking the route, sitting BELOW the deck so the
  // world reads as a cloud sea the ribbon flies over. Lateral clearance
  // starts at 45 — far beyond the ribbon study's 14 minimum.
  const lobes: LabInstance[] = [];
  const CLUSTERS = 40;
  for (let c = 0; c < CLUSTERS; c++) {
    const u = (c + 0.3 + seeded(base + c * 13) * 0.4) / CLUSTERS;
    const sideSign = c % 2 === 0 ? 1 : -1;
    const lateral = sideSign * (45 + seeded(base + c * 7 + 1) * 75);
    const dy = -35 + seeded(base + c * 5 + 2) * 23; // -35..-12
    const center = anchor(curve, u, lateral, dy);
    const lobeCount = 3 + Math.floor(seeded(base + c * 3 + 5) * 5); // 3..7
    const spread = 15 + seeded(base + c * 11 + 3) * 20; // cluster 15..35 wide
    for (let l = 0; l < lobeCount; l++) {
      const r = 8 + seeded(base + c * 17 + l * 23) * 10; // radii 8..18
      lobes.push(
        inst(
          center.clone().add(
            new Vector3(
              (seeded(base + c * 19 + l) - 0.5) * spread,
              (seeded(base + c * 29 + l) - 0.5) * 4,
              (seeded(base + c * 31 + l) - 0.5) * spread * 0.7,
            ),
          ),
          r,
          r * 0.55, // lobes are flattened ellipsoids, not balls
          r * 0.8,
        ),
      );
    }
  }

  // +16 broad horizon banks — one connected lower layer far below the route,
  // so the space beyond the reveal is inhabited, not empty air.
  for (let c = 0; c < 16; c++) {
    const u = (c + 0.5) / 16;
    const sideSign = c % 2 ? 1 : -1;
    const lateral = sideSign * (145 + seeded(6000 + c) * 40);
    const center = anchor(curve, u, lateral, -48);
    for (let l = 0; l < 3; l++) {
      lobes.push(
        inst(
          center.clone().add(
            new Vector3(
              (l - 1) * 22,
              seeded(6100 + c * 3 + l) * 5,
              (seeded(6200 + c * 3 + l) - 0.5) * 24,
            ),
          ),
          42,
          15,
          33,
        ),
      );
    }
  }
  return lobes;
}

function passageCloudLobes(curve: CatmullRomCurve3, base: number): LabInstance[] {
  // Near banks: anchors at u .18–.42, ±18 lateral, centre routeY+2, radii
  // 9–12. Lobe extent stays inside ±18 − radius so road/camera clearance
  // ≥5 holds. Overhead lobes hang with their lower edge above routeY+8.
  const lobes: LabInstance[] = [];
  const anchorUs = [0.18, 0.24, 0.3, 0.36, 0.42];
  anchorUs.forEach((u, i) => {
    for (const sideSign of [1, -1] as const) {
      const lateral = sideSign * 18;
      const center = anchor(curve, u, lateral, 2);
      const r = 9 + seeded(base + i * 41 + sideSign) * 3;
      lobes.push(inst(center, r, r * 0.7, r * 0.7));
      lobes.push(
        inst(
          center.clone().add(new Vector3(sideSign * 5, 1.5, 4 * sideSign)),
          r * 0.7,
          r * 0.5,
          r * 0.55,
        ),
      );
    }
    // Overhead lobe — bottom edge above routeY+8 keeps the corridor open.
    if (i % 2 === 0) {
      const r = 5 + seeded(base + i * 43) * 2;
      lobes.push(inst(anchor(curve, u + 0.015, (seeded(base + i * 47) - 0.5) * 6, 8 + r + 1), r, r * 0.45, r * 0.6));
    }
  });
  return lobes;
}

function landmarkCloudLobes(curve: CatmullRomCurve3, base: number): LabInstance[] {
  // A cloud arch across the route: an OPEN half-ellipse, lobes chained from
  // angle 0..π so they overlap into one bank — base at deck level, apex
  // above the road, nothing crossing the deck.
  const lobes: LabInstance[] = [];
  const arch = (u: number, radius: number, height: number, count: number, scale: [number, number, number], seedBase: number) => {
    const side = labSideAt(curve, u, new Vector3());
    for (let i = 0; i < count; i++) {
      const a = (i / (count - 1)) * Math.PI; // 0..π — half-ellipse
      const v = 0.9 + seeded(seedBase + i) * 0.2; // ±10% lobe variance
      const center = anchor(curve, u, 0, 0)
        .addScaledVector(side, Math.cos(a) * radius)
        .add(new Vector3(0, Math.sin(a) * height, 0));
      lobes.push(inst(center, scale[0] * v, scale[1] * v, scale[2] * v));
    }
  };
  arch(0.58, 20, 25, 15, [5.5, 5.5, 7], base + 1000); // radius 20, apex ~+25
  arch(0.9, 14, 18, 13, [4, 4, 5], base + 2000); // second, smaller, farther
  // Broad floating islands below the arch so it reads held up, not glued on.
  for (const u of [0.54, 0.58, 0.62]) {
    const center = anchor(curve, u, (seeded(base + u * 100) - 0.5) * 10, -16);
    lobes.push(inst(center, 16, 5, 12));
  }
  return lobes;
}

export function buildCloudField(study: LabStudy, curve: CatmullRomCurve3): CloudField {
  const far = farClusterLobes(curve, 10);
  const near: LabInstance[] = [];
  if (study === "passage") near.push(...passageCloudLobes(curve, 500));
  if (study === "landmark") near.push(...landmarkCloudLobes(curve, 700));

  // A few high soft impostors — billboard texture, not geometry. Max 12.
  const wisps: LabInstance[] = [];
  for (let i = 0; i < 10; i++) {
    const u = 0.05 + 0.9 * seeded(3000 + i * 7);
    const lateral = (seeded(3000 + i * 11) - 0.5) * 160;
    const dy = 18 + seeded(3000 + i * 13) * 26;
    wisps.push(inst(anchor(curve, u, lateral, dy), 30 + seeded(3000 + i * 17) * 25, 10, 1));
  }
  return { near, far, wisps };
}

// ─── Neon world ────────────────────────────────────────────────────

export interface NeonField {
  /** Solid tower boxes — one instanced mesh. */
  towers: LabInstance[];
  /** Thin horizontal roof-edge signals on each base tower (city lights). */
  citySignals: LabInstance[];
  /** Luminous vertical seam strips on the passage walls. */
  seams: LabInstance[];
  /** Overhead beams spanning the corridor (bottom edge ≥ routeY+10). */
  beams: LabInstance[];
  /** Portal frame boxes for the landmark study. */
  frames: LabInstance[];
  /** Emissive accent strips on the landmark portals. */
  strips: LabInstance[];
}

const TOWER_TOPS: [number, number] = [-40, -12]; // city tops range under the road

function neonBaseTowers(curve: CatmullRomCurve3, base: number): { towers: LabInstance[]; citySignals: LabInstance[] } {
  // Three depth layers of the lower-level city: distance controls height
  // band and footprint. All tops stay under the road (routeY-12 at most).
  // Each tower also gets one thin luminous roof edge — the city must read
  // as inhabited, not a void.
  const towers: LabInstance[] = [];
  const citySignals: LabInstance[] = [];
  const LAYERS = [
    { lateral: [30, 55], w: [8, 14], h: [10, 20], count: 22 }, // near layer, taller
    { lateral: [55, 90], w: [12, 22], h: [8, 16], count: 26 },
    { lateral: [90, 140], w: [20, 34], h: [6, 12], count: 30 }, // far silhouettes
  ];
  let k = 0;
  for (const layer of LAYERS) {
    for (let i = 0; i < layer.count; i++) {
      k++;
      const u = seeded(base + k * 3);
      const sideSign = seeded(base + k * 5) > 0.5 ? 1 : -1;
      const lateral = sideSign * (layer.lateral[0] + seeded(base + k * 7) * (layer.lateral[1] - layer.lateral[0]));
      const w = layer.w[0] + seeded(base + k * 11) * (layer.w[1] - layer.w[0]);
      const h = layer.h[0] + seeded(base + k * 13) * (layer.h[1] - layer.h[0]);
      const top = TOWER_TOPS[0] + seeded(base + k * 17) * (TOWER_TOPS[1] - TOWER_TOPS[0]);
      const yaw = seeded(base + k * 19) * Math.PI;
      towers.push(inst(anchor(curve, u, lateral, top - h / 2), w, h, w * (0.7 + seeded(base + k * 23) * 0.6), yaw));
      // Roof-edge signal: a thin emissive slab sitting on the tower top.
      citySignals.push(inst(anchor(curve, u, lateral, top + 0.06), w * 0.8, 0.12, 0.12, yaw));
    }
  }
  return { towers, citySignals };
}

function passageNeon(curve: CatmullRomCurve3, base: number): Pick<NeonField, "towers" | "seams" | "beams"> {
  // Corridor walls at ±14 from u .18 to .48 — tall, thin, with luminous
  // vertical seams — and a few beams crossing overhead. Nothing past .48:
  // the corridor ENDS and the reveal is the lower city + horizon.
  const towers: LabInstance[] = [];
  const seams: LabInstance[] = [];
  const beams: LabInstance[] = [];
  const wallUs = [0.18, 0.22, 0.26, 0.3, 0.34, 0.38, 0.42, 0.46];
  wallUs.forEach((u, i) => {
    for (const sideSign of [1, -1] as const) {
      const h = 16 + seeded(base + i * 29 + sideSign) * 10;
      towers.push(inst(anchor(curve, u, sideSign * 14, h / 2 - 2), 3.5, h, 8, tangentYaw(curve, u)));
      // Seams on the road-facing side of each wall.
      seams.push(inst(anchor(curve, u, sideSign * 12.2, h / 2 - 1), 0.12, h * 0.7, 0.12, tangentYaw(curve, u)));
    }
  });
  for (const u of [0.22, 0.32, 0.42]) {
    // Beam long axis (local X) spans laterally across the road; bottom edge
    // ≥ routeY+10 (centre +11, half-height 1).
    beams.push(inst(anchor(curve, u, 0, 11), 30, 2, 2.2, tangentYaw(curve, u)));
  }
  return { towers, seams, beams };
}

function landmarkNeon(curve: CatmullRomCurve3, base: number): Pick<NeonField, "frames" | "strips"> {
  // Two offset rectangular frames across the route — the near one opening
  // half-width 12 / apex ~28, the far one smaller — plus emissive strips.
  // Each portal is three boxes (two uprights + lintel), never a slab.
  void base;
  const frames: LabInstance[] = [];
  const strips: LabInstance[] = [];
  const portal = (u: number, halfWidth: number, height: number, offset: number) => {
    const thick = 1.6;
    const uu = u + offset;
    const yaw = tangentYaw(curve, uu);
    for (const sideSign of [1, -1] as const) {
      frames.push(inst(anchor(curve, uu, sideSign * (halfWidth + thick / 2), height / 2 - 0.5), thick, height, 2.2, yaw));
      strips.push(inst(anchor(curve, uu, sideSign * (halfWidth + thick / 2) * 0.98, height / 2 - 0.5), 0.18, height * 0.85, 0.18, yaw));
    }
    frames.push(inst(anchor(curve, uu, 0, height - thick / 2 - 0.5), halfWidth * 2 + thick * 2, thick, 2.2, yaw));
    strips.push(inst(anchor(curve, uu, 0, height - thick - 0.3), halfWidth * 2, 0.16, 0.16, yaw));
  };
  // Primary gate, then a second set just behind it scaled a touch larger —
  // reads as a gate with depth, not a wall.
  portal(0.58, 12, 28, 0);
  portal(0.58, 12 * 1.12, 28 * 0.92, 0.012);
  portal(0.9, 7, 15, 0);
  return { frames, strips };
}

export function buildNeonField(study: LabStudy, curve: CatmullRomCurve3): NeonField {
  const base = neonBaseTowers(curve, 20);
  const field: NeonField = { towers: base.towers, citySignals: base.citySignals, seams: [], beams: [], frames: [], strips: [] };
  if (study === "passage") {
    const passage = passageNeon(curve, 600);
    field.towers.push(...passage.towers); // preserve the base city
    field.seams = passage.seams;
    field.beams = passage.beams;
  }
  if (study === "landmark") Object.assign(field, landmarkNeon(curve, 800));
  return field;
}
