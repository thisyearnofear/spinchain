import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { buildRouteCurve } from "../route-curve";
import {
  SHAFT_VERTICES_PER_BOX,
  SHAFT_BAND,
  SHAFT_COUNTS,
  SHAFT_DEFAULT_KEY_DIRECTION,
  SHAFT_Y_OFFSET,
  buildShaftLayout,
  buildShaftVolume,
  shaftAxis,
  shaftCount,
} from "../canopy-shafts";
import { roadProfile } from "../route-skirt";

const curve = buildRouteCurve([]);
const halfWidth = roadProfile("woodland").halfWidth;

const layout = () =>
  buildShaftLayout({ curve, count: 24, halfWidth, height: 13, width: 3.4, edgeDrop: 0.5 });

describe("shaft axis", () => {
  it("leans the beam along the world's own key light", () => {
    const key = [0.38, 0.78, 0.5] as const;
    const axis = shaftAxis(key);
    const length = Math.hypot(key[0], key[1], key[2]);
    const unit = [key[0] / length, key[1] / length, key[2] / length];
    const dot = axis[0] * unit[0] + axis[1] * unit[1] + axis[2] * unit[2];
    expect(dot).toBeGreaterThan(0.99);
    expect(Math.hypot(...axis)).toBeCloseTo(1, 6);
    // A beam rises: it can never point at the floor.
    expect(axis[1]).toBeGreaterThan(0);
  });

  it("keeps a low sun's beams steep rather than horizontal", () => {
    // Light on the horizon would give horizontal shafts, which read as lens
    // flare rather than canopy.
    const axis = shaftAxis([1, 0, 0]);
    expect(axis[1]).toBeGreaterThan(0.4);
    expect(Math.hypot(...axis)).toBeCloseTo(1, 6);
  });

  it("falls back to the declared sun when a world gives none or something broken", () => {
    const expected = shaftAxis(SHAFT_DEFAULT_KEY_DIRECTION);
    expect(shaftAxis(undefined)).toEqual(expected);
    expect(shaftAxis([0, 0, 0])).toEqual(expected);
    expect(shaftAxis([Number.NaN, 1, 0])).toEqual(expected);
  });
});

describe("shaft count", () => {
  it("caps the world's declaration by the performance tier", () => {
    expect(shaftCount(30, "high")).toBe(Math.min(30, SHAFT_COUNTS.high));
    expect(shaftCount(1000, "low")).toBe(SHAFT_COUNTS.low);
    expect(shaftCount(4, "high")).toBe(4);
  });

  it("draws nothing when nothing is declared", () => {
    expect(shaftCount(undefined, "high")).toBe(0);
    expect(shaftCount(0, "high")).toBe(0);
    expect(shaftCount(-5, "high")).toBe(0);
  });
});

describe("shaft layout", () => {
  it("is deterministic, so a seek or a re-render lands the same beams", () => {
    expect(layout().bases).toEqual(layout().bases);
    expect(layout().seeds).toEqual(layout().seeds);
  });

  it("plants every beam on the ground, on the sides of the road it declares", () => {
    const { count, bases, stations } = layout();
    expect(count).toBe(24);
    expect(bases).toHaveLength(24 * 3);

    const point = new Vector3();
    let left = 0;
    let right = 0;

    for (let i = 0; i < count; i++) {
      const x = bases[i * 3];
      const y = bases[i * 3 + 1];
      const z = bases[i * 3 + 2];
      expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true);

      // The route is a loop that passes close to itself, so the band is checked
      // against the beam's own station — not against whichever turn of the
      // spiral happens to be nearest.
      const u = stations[i];
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      curve.getPointAt(u, point);
      const lateral = Math.hypot(x - point.x, z - point.z);
      expect(lateral).toBeGreaterThanOrEqual(SHAFT_BAND.inner - 0.5);
      expect(lateral).toBeLessThanOrEqual(SHAFT_BAND.outer + 0.5);

      // Slightly below the road: the skirt drops away and the rider group sits
      // 10 units down, so a beam's foot is on the floor, not on the ribbon.
      expect(y).toBeLessThan(point.y + SHAFT_Y_OFFSET + 1);

      if (i % 2 === 0) right++;
      else left++;
    }
    // Both verges are lit, not one.
    expect(left).toBe(right);
  });

  it("varies reach and width per beam instead of stamping one shape", () => {
    const { count, widths, heights, alphas } = layout();
    const spread = (values: Float32Array) => {
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < count; i++) {
        min = Math.min(min, values[i]);
        max = Math.max(max, values[i]);
      }
      return max - min;
    };
    // Round the declared size, never double it.
    for (let i = 0; i < count; i++) {
      expect(widths[i]).toBeGreaterThanOrEqual(3.4 * 0.55 - 1e-6);
      expect(widths[i]).toBeLessThanOrEqual(3.4 * 1.45 + 1e-6);
      expect(heights[i]).toBeGreaterThanOrEqual(13 * 0.7 - 1e-6);
      expect(heights[i]).toBeLessThanOrEqual(13 * 1.4 + 1e-6);
      expect(alphas[i]).toBeGreaterThan(0);
      expect(alphas[i]).toBeLessThanOrEqual(1);
    }
    expect(spread(widths)).toBeGreaterThan(1);
    expect(spread(heights)).toBeGreaterThan(2);
    expect(spread(alphas)).toBeGreaterThan(0.3);
  });

  it("covers the whole route, so a long ride never runs out of light", () => {
    // Golden-ratio stride: consecutive beams are far apart on the route, and
    // the ends of the ride get beams like its middle.
    const { count, stations } = layout();
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < count; i++) {
      min = Math.min(min, stations[i]);
      max = Math.max(max, stations[i]);
    }
    expect(min).toBeLessThan(0.15);
    expect(max).toBeGreaterThan(0.85);
    for (let i = 0; i < count; i++) {
      expect(Number.isFinite(stations[i])).toBe(true);
    }
  });

  it("builds nothing when the world asks for no beams", () => {
    const empty = buildShaftLayout({ curve, count: 0, halfWidth, height: 13, width: 3.4 });
    expect(empty.count).toBe(0);
    expect(empty.bases).toHaveLength(0);
  });
});

describe("shaft volume", () => {
  const axis = shaftAxis([0.38, 0.78, 0.5]);
  const volume = () => buildShaftVolume(layout(), axis);

  it("gives every beam a closed box of its own", () => {
    const { count, vertexCount, positions } = volume();
    expect(count).toBe(24);
    expect(vertexCount).toBe(24 * SHAFT_VERTICES_PER_BOX);
    expect(positions).toHaveLength(vertexCount * 3);
    for (const value of positions) expect(Number.isFinite(value)).toBe(true);
  });

  it("winds every face outward, because BackSide draws exactly one side", () => {
    // A box wound inward loses its far faces and the beam gets holes; one wound
    // from both sides counts the same light twice.
    const { count, positions, bases, axes, heights } = volume();
    const axisVector = new Vector3(axes[0], axes[1], axes[2]);
    const centre = new Vector3();

    for (let beam = 0; beam < count; beam++) {
      const offset = beam * SHAFT_VERTICES_PER_BOX;
      centre
        .set(bases[offset * 3], bases[offset * 3 + 1], bases[offset * 3 + 2])
        .addScaledVector(axisVector, heights[offset] * 0.5);

      for (let tri = 0; tri < SHAFT_VERTICES_PER_BOX / 3; tri++) {
        const p0 = new Vector3().fromArray(positions, (offset + tri * 3) * 3);
        const p1 = new Vector3().fromArray(positions, (offset + tri * 3 + 1) * 3);
        const p2 = new Vector3().fromArray(positions, (offset + tri * 3 + 2) * 3);
        const normal = new Vector3().crossVectors(
          new Vector3().subVectors(p1, p0),
          new Vector3().subVectors(p2, p0),
        );
        // Degenerate triangles are the box's own edges after projection; a real
        // face has a normal that points away from the box centre.
        if (normal.length() < 1e-8) continue;
        const centroid = new Vector3().add(p0).add(p1).add(p2).divideScalar(3);
        expect(normal.dot(centroid.clone().sub(centre))).toBeGreaterThan(0);
      }
    }
  });

  it("covers the whole column: boxes span the beam's radius and its length", () => {
    // The proxy has to contain every pixel the volume can shade, or the beam is
    // clipped by its own bounds.
    const { count, positions, bases, axes, heights, widths } = volume();
    const axisVector = new Vector3(axes[0], axes[1], axes[2]).normalize();

    for (let beam = 0; beam < count; beam++) {
      const offset = beam * SHAFT_VERTICES_PER_BOX;
      const base = new Vector3().fromArray(bases, offset * 3);
      const height = heights[offset];
      const width = widths[offset];
      const rel = new Vector3();

      for (let v = 0; v < SHAFT_VERTICES_PER_BOX; v++) {
        rel.fromArray(positions, (offset + v) * 3).sub(base);
        const along = rel.dot(axisVector);
        expect(along).toBeGreaterThanOrEqual(-1e-4);
        expect(along).toBeLessThanOrEqual(height + 1e-4);
        // Corners sit at the box's diagonal: sqrt(2) * width from the axis.
        const radial = Math.sqrt(Math.max(0, rel.lengthSq() - along * along));
        expect(radial).toBeLessThanOrEqual(Math.SQRT2 * width + 1e-3);
      }
    }
  });

  it("builds no geometry when there is nothing to draw", () => {
    const empty = buildShaftVolume(
      buildShaftLayout({ curve, count: 0, halfWidth, height: 13, width: 3.4 }),
      axis,
    );
    expect(empty.vertexCount).toBe(0);
    expect(empty.positions).toHaveLength(0);
  });
});
