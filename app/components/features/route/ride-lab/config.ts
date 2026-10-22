/**
 * Ride lab — shared experiment contract.
 *
 * One open spline route, one rider, one 45s deterministic playback clock.
 * The world switch swaps only the art kit (cloud masses vs night city); the
 * study switch swaps only the spatial composition around the same road;
 * the camera switch keeps the current time. Nothing here is production UI —
 * it exists to compare three spatial directions side by side.
 */

import { CatmullRomCurve3, Vector3 } from "three";

export type LabWorld = "cloud" | "neon";
export type LabStudy = "ribbon" | "passage" | "landmark";
export type LabCamera = "chase" | "low" | "first";
export type LabEffort = "steady" | "build" | "push";

export interface LabOptions {
  world: LabWorld;
  study: LabStudy;
  camera: LabCamera;
  effects: boolean;
  effort: LabEffort;
  dpr: 1 | 1.5;
}

export const DURATION = 45;

export const DEFAULT_OPTIONS: LabOptions = {
  world: "cloud",
  study: "passage",
  camera: "low",
  effects: false,
  effort: "steady",
  dpr: 1,
};

export const STUDIES = [
  {
    id: "ribbon",
    label: "Open ribbon",
    description: "A thin road above the world. Test height, openness, and air.",
  },
  {
    id: "passage",
    label: "Passage & reveal",
    description: "Close surroundings give way to an expansive view.",
  },
  {
    id: "landmark",
    label: "Landmark journey",
    description: "Approach a destination, pass through, and discover the next.",
  },
] as const;

export const CAMERAS = {
  chase: { label: "High chase", back: 10, height: 6.5, side: 2.5, lookAhead: 1.5, lookHeight: 1.2, fov: 60 },
  low: { label: "Low chase", back: 5.5, height: 2.6, side: 0, lookAhead: 15, lookHeight: 1.2, fov: 65 },
  first: { label: "First person", back: 0, height: 1.8, side: 0, lookAhead: 20, lookHeight: 1.5, fov: 70 },
} as const;

export const EFFORT = {
  steady: { watts: 150, cadence: 75, amount: 0 },
  build: { watts: 220, cadence: 90, amount: 0.5 },
  push: { watts: 320, cadence: 105, amount: 1 },
} as const;

export function buildLabCurve() {
  return new CatmullRomCurve3(
    [
      new Vector3(0, 20, -35),
      new Vector3(0, 20, 0),
      new Vector3(8, 22, 75),
      new Vector3(-20, 27, 160),
      new Vector3(-8, 29, 245),
      new Vector3(28, 24, 340),
      new Vector3(14, 22, 435),
      new Vector3(0, 22, 485),
    ],
    false,
    "centripetal",
  );
}

export function labProgress(seconds: number) {
  return 0.07 + 0.86 * Math.min(1, Math.max(0, seconds / DURATION));
}

export function seeded(index: number) {
  const n = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// ─── Playback ──────────────────────────────────────────────────────

/**
 * The one mutable clock owner inside the Canvas. React never re-renders per
 * frame: controls mutate this ref and bump `revision` so the camera snaps
 * instead of interpolating across a scrub/restart/loop boundary.
 */
export interface LabPlayback {
  seconds: number;
  playing: boolean;
  loop: boolean;
  revision: number;
}

export function createLabPlayback(seconds: number, playing: boolean): LabPlayback {
  return { seconds, playing, loop: false, revision: 0 };
}

// ─── URL params ────────────────────────────────────────────────────

/** Minimal reader both URLSearchParams and ReadonlyURLSearchParams satisfy. */
export interface LabParamSource {
  get(name: string): string | null;
}

const WORLDS: readonly LabWorld[] = ["cloud", "neon"];
const STUDY_IDS = STUDIES.map((s) => s.id) as readonly LabStudy[];
const CAMERA_IDS = Object.keys(CAMERAS) as readonly LabCamera[];
const EFFORT_IDS = Object.keys(EFFORT) as readonly LabEffort[];

function pick<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/** Whitelisted options from the query string; anything unknown falls back. */
export function parseLabOptions(params: LabParamSource): LabOptions {
  const d = DEFAULT_OPTIONS;
  return {
    world: pick(params.get("world"), WORLDS, d.world),
    study: pick(params.get("study"), STUDY_IDS, d.study),
    camera: pick(params.get("camera"), CAMERA_IDS, d.camera),
    effects: params.get("effects") === "1" ? true : params.get("effects") === "0" ? false : d.effects,
    effort: pick(params.get("effort"), EFFORT_IDS, d.effort),
    dpr: params.get("dpr") === "1.5" ? 1.5 : params.get("dpr") === "1" ? 1 : d.dpr,
  };
}

/**
 * Time + paused flags from the query. `t` is clamped to a finite 0..DURATION;
 * `paused` is null when absent so the caller can apply its own default
 * (reduced motion starts paused, otherwise autoplays).
 */
export function parseLabTime(params: LabParamSource): { t: number; paused: boolean | null } {
  const raw = Number(params.get("t"));
  const t = params.get("t") === null || !Number.isFinite(raw) ? 0 : Math.min(DURATION, Math.max(0, raw));
  const p = params.get("paused");
  return { t, paused: p === "1" ? true : p === "0" ? false : null };
}

/** Serialize the comparison state — includes paused time so a link lands on
 *  the exact frame the sender was looking at. */
export function labQueryString(options: LabOptions, seconds: number, paused: boolean, loop: boolean): string {
  const sp = new URLSearchParams();
  sp.set("world", options.world);
  sp.set("study", options.study);
  sp.set("camera", options.camera);
  sp.set("effects", options.effects ? "1" : "0");
  sp.set("effort", options.effort);
  sp.set("dpr", String(options.dpr));
  sp.set("t", String(Math.round(Math.min(DURATION, Math.max(0, seconds)) * 100) / 100));
  sp.set("paused", paused ? "1" : "0");
  if (loop) sp.set("loop", "1");
  return sp.toString();
}

// ─── Curve helpers (shared by geometry + scene) ─────────────────────

const _side = new Vector3();
const _up = new Vector3(0, 1, 0);

/**
 * Horizontal side vector at arc position `u` — tangent × world-up, so the
 * road and every lateral offset stay level even on climbing segments.
 * Writes into `out`; returns it.
 */
export function labSideAt(curve: CatmullRomCurve3, u: number, out: Vector3): Vector3 {
  const tangent = curve.getTangentAt(u, new Vector3());
  out.crossVectors(tangent, _up);
  if (out.lengthSq() < 1e-10) out.set(1, 0, 0); // vertical tangent fallback
  return out.normalize();
}

/**
 * Anchor point for world dressing: the route point at arc `u`, offset
 * `lateral` units along the horizontal side and `dy` units vertically.
 * Every cloud bank, tower and beam in the lab hangs off this one helper so
 * both worlds address "same place on the route" identically.
 */
export function labAnchorAt(
  curve: CatmullRomCurve3,
  u: number,
  lateral: number,
  dy: number,
  out: Vector3 = new Vector3(),
): Vector3 {
  curve.getPointAt(u, out);
  const side = labSideAt(curve, u, _side);
  out.addScaledVector(side, lateral);
  out.y += dy;
  return out;
}
