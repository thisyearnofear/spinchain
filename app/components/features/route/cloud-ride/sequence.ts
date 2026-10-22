/**
 * Cloud ride — one authored 45s sequence. The contract below is fixed:
 * curve, timing bands, views and effort values are the experiment's recipe.
 */

import { CatmullRomCurve3, Vector3 } from "three";
import { seeded } from "../ride-lab/config";

export type CloudView = "play" | "cinema";
export type CloudEffort = "cruise" | "build" | "push";
export const CLOUD_DURATION = 45;
export const CLOUD_EFFORT = {
  cruise: { watts: 150, cadence: 75, amount: 0 },
  build: { watts: 220, cadence: 90, amount: 0.5 },
  push: { watts: 320, cadence: 105, amount: 1 },
} as const;
export interface CloudPlayback {
  seconds: number;
  playing: boolean;
  revision: number;
  pedalPhase: number;
}
export interface CloudOptions {
  view: CloudView;
  effort: CloudEffort;
  reducedMotion: boolean;
}
export function smoothRange(a: number, b: number, t: number) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}
export function sequenceProgress(seconds: number) {
  return 0.065 + 0.87 * Math.max(0, Math.min(45, seconds)) / 45;
}
export function revealAt(seconds: number) {
  return smoothRange(19, 25, seconds);
}
export function sequenceChapter(seconds: number) {
  return seconds < 9 ? "Above the clouds" : seconds < 21 ? "The cloud cathedral" : seconds < 29 ? "Into the light" : "One road. Open sky.";
}
export function makeCloudCurve() {
  return new CatmullRomCurve3(
    [
      new Vector3(0, 30, -40),
      new Vector3(0, 30, 0),
      new Vector3(20, 33, 65),
      new Vector3(4, 36, 130),
      new Vector3(-28, 39, 190),
      new Vector3(-12, 43, 245),
      new Vector3(40, 45, 305),
      new Vector3(70, 40, 365),
      new Vector3(46, 35, 420),
      new Vector3(15, 34, 480),
      new Vector3(10, 34, 530),
    ],
    false,
    "centripetal",
  );
}
export const CLOUD_VIEWS = {
  play: { back: 7.8, height: 3.1, side: 0, lookAhead: 17, lookHeight: 1.1, fov: 64 },
  cinema: { back: 17, height: 8.5, side: 4.5, lookAhead: 29, lookHeight: 1.5, fov: 54 },
} as const;

export { seeded };

export const DEFAULT_CLOUD_OPTIONS: CloudOptions = { view: "play", effort: "cruise", reducedMotion: false };

export interface CloudParamSource {
  get(name: string): string | null;
}

export function parseCloudOptions(params: CloudParamSource, reducedMotion: boolean): CloudOptions {
  const v = params.get("view");
  const e = params.get("effort");
  return {
    view: v === "cinema" ? "cinema" : "play",
    effort: e === "build" || e === "push" ? e : "cruise",
    reducedMotion,
  };
}

export function parseCloudTime(params: CloudParamSource): { t: number; paused: boolean | null } {
  const raw = Number(params.get("t"));
  const t = params.get("t") === null || !Number.isFinite(raw) ? 0 : Math.min(CLOUD_DURATION, Math.max(0, raw));
  const p = params.get("paused");
  return { t, paused: p === "1" ? true : p === "0" ? false : null };
}

export function cloudQueryString(options: CloudOptions, seconds: number, paused: boolean): string {
  const sp = new URLSearchParams();
  sp.set("view", options.view);
  sp.set("effort", options.effort);
  sp.set("t", String(Math.round(Math.min(CLOUD_DURATION, Math.max(0, seconds)) * 100) / 100));
  sp.set("paused", paused ? "1" : "0");
  return sp.toString();
}
