import { describe, expect, it } from "vitest";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { VISUALIZER_THEMES } from "../visualizer-theme";
import { buildRouteCurve } from "../route-curve";
import {
  SKIRT_EDGE_DROP,
  SKIRT_FRAGMENT_SHADER,
  SKIRT_HALF_WIDTH,
  SKIRT_STEPS,
  SKIRT_WIDTH_SEGMENTS,
  buildRouteSkirtGeometry,
  createSkirtMaterial,
  roadProfile,
  skirtSurfacePoint,
} from "../route-skirt";
import {
  SILHOUETTES,
  buildPropField,
  propOrigin,
  silhouetteBaseY,
  type PropType,
  type SilhouettePart,
} from "../route-silhouettes";

const curve = buildRouteCurve([]);

function centerIndex(ring: number): number {
  const across = SKIRT_WIDTH_SEGMENTS + 1;
  return ring * across + SKIRT_WIDTH_SEGMENTS / 2;
}

/** Undo the part's local transform so the instance matrix yields the skirt contact. */
function groundContact(matrices: Float32Array, index: number, part: SilhouettePart): Vector3 {
  const instance = new Matrix4().fromArray(matrices, index * 16);
  const local = new Matrix4().compose(
    new Vector3(part.position[0], part.position[1], part.position[2]),
    new Quaternion().setFromEuler(new Euler(part.rotation[0], part.rotation[1], part.rotation[2])),
    new Vector3(part.scale[0], part.scale[1], part.scale[2]),
  );
  return new Vector3().setFromMatrixPosition(instance.multiply(local.invert()));
}

describe("route skirt", () => {
  const halfWidth = roadProfile("neon").halfWidth;
  const geometry = buildRouteSkirtGeometry(curve, halfWidth);
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const frames = curve.computeFrenetFrames(SKIRT_STEPS, true);

  it("follows the road curve, with the rim dropped so it can fade out", () => {
    expect(position.count).toBe((SKIRT_STEPS + 1) * (SKIRT_WIDTH_SEGMENTS + 1));

    const center = new Vector3();
    const edge = new Vector3();
    const expected = new Vector3();
    const onCurve = new Vector3();

    for (let i = 0; i < position.count; i++) {
      expect(Number.isFinite(position.getX(i))).toBe(true);
      expect(Number.isFinite(position.getY(i))).toBe(true);
      expect(Number.isFinite(position.getZ(i))).toBe(true);
    }

    for (const ring of [0, 40, 80, 120]) {
      const u = ring / SKIRT_STEPS;
      center.fromBufferAttribute(position, centerIndex(ring));
      skirtSurfacePoint(curve, frames, SKIRT_STEPS, u, 0, halfWidth, expected);
      expect(center.distanceTo(expected)).toBeLessThan(1e-4);

      curve.getPointAt(u, onCurve);
      // Lowest edge of the ribbon rests on the skirt.
      expect(center.y).toBeLessThan(onCurve.y - 1);

      const edgeVertex = ring * (SKIRT_WIDTH_SEGMENTS + 1);
      edge.fromBufferAttribute(position, edgeVertex);
      expect(Math.hypot(edge.x - center.x, edge.z - center.z)).toBeCloseTo(SKIRT_HALF_WIDTH, 4);
      expect(center.y - edge.y).toBeCloseTo(SKIRT_EDGE_DROP, 4);
      expect(uv.getY(centerIndex(ring))).toBe(0);
      expect(uv.getY(edgeVertex)).toBe(1);
    }
  });

  it("faces upward so the chase camera sees the ground", () => {
    const index = geometry.getIndex()!;
    const a = new Vector3().fromBufferAttribute(position, index.getX(0));
    const b = new Vector3().fromBufferAttribute(position, index.getX(1));
    const c = new Vector3().fromBufferAttribute(position, index.getX(2));
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    expect(normal.y).toBeGreaterThan(0);
  });

  it("dissolves the rim into the existing fog instead of cutting a hole", () => {
    expect(SKIRT_FRAGMENT_SHADER).toContain("fogColor");
    expect(SKIRT_FRAGMENT_SHADER).toContain("smoothstep(0.05, 0.85, edge)");
    expect(SKIRT_FRAGMENT_SHADER).toContain("smoothstep(0.42, 1.0, edge)");
    // The renderer writes these every frame when material.fog is set.
    const material = createSkirtMaterial("#25473d", "#84cc16");
    expect(material.fog).toBe(true);
    expect(material.uniforms.fogColor.value).toBeDefined();
    expect(material.uniforms.fogNear.value).toEqual(expect.any(Number));
    expect(material.uniforms.fogFar.value).toEqual(expect.any(Number));
    material.dispose();
  });

  it("drops the wider rainbow ribbon onto the skirt as well", () => {
    expect(roadProfile("rainbow").halfWidth).toBe(4);
    expect(roadProfile("alpine").halfWidth).toBe(2.5);
    const neonY = buildRouteSkirtGeometry(curve, 2.5).getAttribute("position").getY(centerIndex(40));
    const rainbowY = buildRouteSkirtGeometry(curve, 4).getAttribute("position").getY(centerIndex(40));
    expect(rainbowY).toBeLessThan(neonY);
  });
});

describe("route silhouettes", () => {
  const shapes: Record<PropType, string[]> = {
    tree: ["cylinder", "cone", "cone"],
    building: ["box", "box", "box"],
    rock: ["dodecahedron", "dodecahedron", "dodecahedron"],
    blossom: ["cylinder", "sphere", "sphere"],
    crystal: ["octahedron", "octahedron", "octahedron"],
  };

  it("builds one instanced silhouette per theme, planted on the skirt", () => {
    expect(VISUALIZER_THEMES.alpine.props.count).toBe(120);
    expect(VISUALIZER_THEMES.neon.props.count).toBe(40);
    expect(VISUALIZER_THEMES.mars.props.count).toBe(80);
    expect(VISUALIZER_THEMES.anime.props.count).toBe(200);
    expect(VISUALIZER_THEMES.rainbow.props.count).toBe(60);

    for (const name of Object.keys(VISUALIZER_THEMES) as Array<keyof typeof VISUALIZER_THEMES>) {
      const config = VISUALIZER_THEMES[name].props;
      const spec = SILHOUETTES[config.type];
      expect(spec.map((part) => part.shape)).toEqual(shapes[config.type]);
      expect(spec.filter((part) => part.breathes)).toHaveLength(
        config.type === "building" || config.type === "crystal" ? 1 : 0,
      );

      const base = silhouetteBaseY(config.type);
      expect(base).toBeLessThanOrEqual(0.05);
      expect(base).toBeGreaterThan(-0.25);

      const halfWidth = roadProfile(name).halfWidth;
      const field = buildPropField(curve, config, halfWidth);
      const frames = curve.computeFrenetFrames(SKIRT_STEPS, true);
      const expected = new Vector3();

      expect(field.parts).toHaveLength(spec.length);
      for (const part of field.parts) {
        expect(part.count).toBe(config.count);
        expect(part.matrices.length).toBe(config.count * 16);
      }

      // Theme color is kept on the unshaded part; the grounded part is darker.
      const primary = field.parts.find((part) => part.color === config.color);
      expect(primary).toBeDefined();

      for (const index of [0, 1, Math.min(7, config.count - 1)]) {
        propOrigin(curve, frames, index, halfWidth, expected);
        const contact = groundContact(field.parts[0].matrices, index, spec[0]);
        expect(contact.distanceTo(expected)).toBeLessThan(1e-3);

        const u = Math.sin(index * 9999) * 10000;
        const onCurve = curve.getPointAt(u - Math.floor(u));
        const horizontal = Math.hypot(expected.x - onCurve.x, expected.z - onCurve.z);
        expect(horizontal).toBeGreaterThanOrEqual(8);
        expect(horizontal).toBeLessThanOrEqual(23);
        expect(expected.y).toBeLessThan(onCurve.y);
      }
    }
  });
});
