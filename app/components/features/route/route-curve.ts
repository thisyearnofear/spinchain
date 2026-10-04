import { CatmullRomCurve3, MathUtils, Vector3 } from "three";

const DEFAULT_ELEVATION_PROFILE = [120, 180, 140, 210, 260, 220, 280, 240, 300, 260, 320, 280];

/**
 * Closed route the road, skirt, and props share.
 * `i < steps` (not `<=`) keeps the seam from duplicating a point — a repeated
 * endpoint makes a zero-length segment whose tangent is NaN.
 */
export function buildRouteCurve(elevationProfile: number[]): CatmullRomCurve3 {
  const rawProfile = elevationProfile.length > 0 ? elevationProfile : DEFAULT_ELEVATION_PROFILE;
  const profile = rawProfile.map((v) => (Number.isFinite(v) ? v : 0));

  const points: Vector3[] = [];
  const radius = 50;
  const steps = 150;

  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI * 4;

    const r = radius + Math.sin(t * Math.PI * 6) * 15;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    const u = t * profile.length;
    const elevIndex = Math.floor(u) % profile.length;
    const nextElevIndex = (elevIndex + 1) % profile.length;
    const elevAlpha = u - Math.floor(u);

    const h1 = profile[elevIndex] ?? 0;
    const h2 = profile[nextElevIndex] ?? 0;
    const height = MathUtils.lerp(h1, h2, elevAlpha);

    points.push(new Vector3(x, height / 4, z));
  }

  const curve = new CatmullRomCurve3(points, true, "centripetal");
  curve.arcLengthDivisions = 600;
  return curve;
}
