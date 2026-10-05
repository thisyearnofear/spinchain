import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { VISUALIZER_THEMES } from "../visualizer-theme";
import { buildRouteCurve } from "../route-curve";
import {
  NEUTRAL_SKIRT_LIGHT,
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
  ALPINE_FOG_FAR,
  ALPINE_SKIRT_ALBEDO_GAIN,
  ALPINE_SKIRT_EDGE_SHADE,
  ALPINE_SKIRT_FOG_END,
  ALPINE_SKIRT_FOG_START,
  ALPINE_SKIRT_SUN_GAIN,
  ALPINE_SKY_FRAGMENT,
  ALPINE_SUN_COLOR,
  ALPINE_SUN_DIR,
  buildAlpineHorizonGeometry,
  createAlpineSkyMaterial,
  sampleCurveVertical,
  skirtOuterRadius,
} from "../alpine-atmosphere";
import {
  NEON_ACCENT,
  NEON_FOG_FAR,
  NEON_GLOW,
  NEON_KEY_COLOR,
  NEON_KEY_DIR,
  NEON_SKY_FRAGMENT,
  NEON_SKYLINE_BLOCKS,
  NEON_SKYLINE_ROWS,
  NEON_SKYLINE_SEGMENTS,
  NEON_SKIRT_ALBEDO_GAIN,
  NEON_SKIRT_EDGE_SHADE,
  NEON_SKIRT_FOG_END,
  NEON_SKIRT_FOG_START,
  buildNeonSkylineGeometry,
  createNeonSkyMaterial,
  neonSkirtLight,
  neonSkylineUnit,
} from "../neon-atmosphere";
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
    expect(SKIRT_FRAGMENT_SHADER).toContain("smoothstep(uFogStart, uFogEnd, edge)");
    // The renderer writes these every frame when material.fog is set.
    const material = createSkirtMaterial("#25473d", "#84cc16");
    expect(material.fog).toBe(true);
    expect(material.uniforms.fogColor.value).toBeDefined();
    expect(material.uniforms.fogNear.value).toEqual(expect.any(Number));
    expect(material.uniforms.fogFar.value).toEqual(expect.any(Number));
    // Default light is a no-op so the other themes keep the flat skirt.
    expect(material.uniforms.uAlbedoGain.value).toBe(NEUTRAL_SKIRT_LIGHT.albedoGain);
    expect(material.uniforms.uEdgeShade.value).toBe(0.22);
    expect(material.uniforms.uSunGain.value).toBe(0);
    expect(material.uniforms.uFogStart.value).toBe(0.42);
    expect(material.uniforms.uFogEnd.value).toBe(1);
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

describe("alpine atmosphere", () => {
  it("lifts only the alpine skirt into the sun and leaves the sky unfogged", () => {
    const lit = createSkirtMaterial("#25473d", "#84cc16", {
      albedoGain: ALPINE_SKIRT_ALBEDO_GAIN,
      edgeShade: ALPINE_SKIRT_EDGE_SHADE,
      sunGain: ALPINE_SKIRT_SUN_GAIN,
      sunDir: ALPINE_SUN_DIR,
      fogStart: ALPINE_SKIRT_FOG_START,
      fogEnd: ALPINE_SKIRT_FOG_END,
    });
    expect(lit.uniforms.uAlbedoGain.value).toBeGreaterThan(1);
    expect(lit.uniforms.uEdgeShade.value).toBeGreaterThan(0.22);
    expect(lit.uniforms.uSunGain.value).toBeGreaterThan(0);
    expect(lit.uniforms.uFogStart.value).toBeLessThan(0.42);
    expect(lit.uniforms.uFogEnd.value).toBeLessThan(1);
    expect(lit.fog).toBe(true);
    lit.dispose();

    const sky = createAlpineSkyMaterial("#b7d3f2", "#caccf0");
    expect(sky.fog).toBe(false);
    expect(sky.depthWrite).toBe(false);
    expect(ALPINE_SKY_FRAGMENT).not.toContain("fog_fragment");
    expect(ALPINE_SKY_FRAGMENT).toContain("uHorizon");
    expect(sky.uniforms.uHorizon.value).toBeDefined();
    expect(sky.uniforms.uSunDir.value).toBeDefined();
    sky.dispose();

    expect(ALPINE_FOG_FAR).toBeLessThan(250);
    expect(ALPINE_FOG_FAR).toBeGreaterThan(40);
  });

  it("rings the skirt with ridges that face the valley", () => {
    const { minY, maxY, midY } = sampleCurveVertical(curve);
    const geometry = buildAlpineHorizonGeometry(curve);
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex()!;
    expect(position.count).toBeGreaterThan(0);

    let minVertexY = Infinity;
    let maxVertexY = -Infinity;
    let maxR = 0;
    for (let i = 0; i < position.count; i++) {
      expect(Number.isFinite(position.getX(i))).toBe(true);
      expect(Number.isFinite(position.getY(i))).toBe(true);
      expect(Number.isFinite(position.getZ(i))).toBe(true);
      minVertexY = Math.min(minVertexY, position.getY(i));
      maxVertexY = Math.max(maxVertexY, position.getY(i));
      maxR = Math.max(maxR, Math.hypot(position.getX(i), position.getZ(i)));
    }

    expect(minVertexY).toBeLessThan(minY);
    expect(maxVertexY).toBeGreaterThan(maxY);
    expect(maxVertexY).toBeGreaterThan(midY + 20);
    expect(geometry.userData.baseRadius).toBeGreaterThan(skirtOuterRadius(curve));

    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const normal = new Vector3();
    const mid = new Vector3();
    let inward = 0;
    let up = 0;
    const faces = index.count / 3;
    for (let face = 0; face < faces; face += 17) {
      const offset = face * 3;
      a.fromBufferAttribute(position, index.getX(offset));
      b.fromBufferAttribute(position, index.getX(offset + 1));
      c.fromBufferAttribute(position, index.getX(offset + 2));
      normal.copy(b).sub(a).cross(c.clone().sub(a));
      mid.copy(a).add(b).add(c);
      inward += normal.dot(new Vector3(-mid.x, 0, -mid.z));
      up += normal.y;
    }
    expect(inward).toBeGreaterThan(0);
    expect(up).toBeGreaterThan(0);
    expect(maxR).toBeGreaterThan(0);
    geometry.dispose();
  });

  it("does not walk the sky or the ridge from the frame loop", () => {
    const atmosphere = readFileSync(new URL("../alpine-atmosphere.ts", import.meta.url), "utf8");
    const view = readFileSync(new URL("../alpine-view.tsx", import.meta.url), "utf8");
    const shared = readFileSync(new URL("../theme-atmosphere.tsx", import.meta.url), "utf8");
    expect(atmosphere).not.toContain("useFrame");
    expect(view).not.toContain("useFrame");
    expect(shared).not.toContain("useFrame");
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

describe("neon atmosphere", () => {
  it("lifts only the neon skirt into a cool key and leaves the sky unfogged", () => {
    const lit = neonSkirtLight();
    expect(lit.albedoGain).toBe(NEON_SKIRT_ALBEDO_GAIN);
    expect(lit.albedoGain).toBeGreaterThan(1);
    expect(lit.albedoGain).not.toBe(ALPINE_SKIRT_ALBEDO_GAIN);
    expect(lit.edgeShade).toBe(NEON_SKIRT_EDGE_SHADE);
    expect(lit.edgeShade).toBeGreaterThan(NEUTRAL_SKIRT_LIGHT.edgeShade);
    expect(lit.edgeShade).not.toBe(ALPINE_SKIRT_EDGE_SHADE);
    expect(lit.sunGain).toBeGreaterThan(0);
    expect(lit.sunGain).toBeLessThan(ALPINE_SKIRT_SUN_GAIN);
    expect(lit.fogStart).toBe(NEON_SKIRT_FOG_START);
    expect(lit.fogStart).toBeLessThan(NEUTRAL_SKIRT_LIGHT.fogStart);
    expect(lit.fogEnd).toBe(NEON_SKIRT_FOG_END);
    expect(lit.fogEnd).toBeLessThan(1);
    expect(lit.fogEnd).not.toBe(ALPINE_SKIRT_FOG_END);

    const material = createSkirtMaterial("#0f172a", "#1d4ed8", lit);
    expect(material.fog).toBe(true);
    expect(material.uniforms.fogColor.value).toBeDefined();
    expect(material.uniforms.uAlbedoGain.value).toBe(NEON_SKIRT_ALBEDO_GAIN);
    material.dispose();

    const neutral = createSkirtMaterial("#0f172a", "#1d4ed8");
    expect(neutral.uniforms.uAlbedoGain.value).toBe(1);
    expect(neutral.uniforms.uSunGain.value).toBe(0);
    neutral.dispose();

    const sky = createNeonSkyMaterial("#050816", "#07090f");
    expect(sky.fog).toBe(false);
    expect(sky.depthWrite).toBe(false);
    expect(NEON_SKY_FRAGMENT).not.toContain("fog_fragment");
    expect(NEON_SKY_FRAGMENT).not.toContain("uSunDir");
    expect(NEON_SKY_FRAGMENT).toContain("uHorizon");
    expect(NEON_SKY_FRAGMENT).toContain("uGlow");
    expect(NEON_SKY_FRAGMENT).toContain("uAccent");
    expect(sky.uniforms.uHorizon.value.getHexString()).toBe("07090f");
    expect(sky.uniforms.uGlow.value.getHexString()).toBe(NEON_GLOW.slice(1));
    expect(sky.uniforms.uAccent.value.getHexString()).toBe(NEON_ACCENT.slice(1));
    sky.dispose();

    expect(NEON_FOG_FAR).toBeLessThan(250);
    expect(NEON_FOG_FAR).toBeGreaterThan(40);
    expect(NEON_FOG_FAR).not.toBe(ALPINE_FOG_FAR);
    expect(NEON_KEY_COLOR).not.toBe(ALPINE_SUN_COLOR);
    expect(NEON_KEY_DIR.y).toBeLessThan(ALPINE_SUN_DIR.y);
    expect(ALPINE_SKY_FRAGMENT).toContain("uSunDir");
  });

  it("rings the skirt with a stepped skyline that faces the valley", () => {
    const { minY, midY } = sampleCurveVertical(curve);
    const geometry = buildNeonSkylineGeometry(curve);
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex()!;
    expect(position.count).toBe(NEON_SKYLINE_SEGMENTS * NEON_SKYLINE_ROWS);

    const baseRadius = geometry.userData.baseRadius as number;
    const roofDepth = geometry.userData.roofDepth as number;
    expect(baseRadius).toBeGreaterThan(skirtOuterRadius(curve));

    let minVertexY = Infinity;
    let maxVertexY = -Infinity;
    const eaveHeights = new Set<number>();
    for (let i = 0; i < NEON_SKYLINE_SEGMENTS; i++) {
      for (let row = 0; row < NEON_SKYLINE_ROWS; row++) {
        const vertex = i * NEON_SKYLINE_ROWS + row;
        expect(Number.isFinite(position.getX(vertex))).toBe(true);
        expect(Number.isFinite(position.getY(vertex))).toBe(true);
        expect(Number.isFinite(position.getZ(vertex))).toBe(true);
        const radius = Math.hypot(position.getX(vertex), position.getZ(vertex));
        const expectedRadius = row === NEON_SKYLINE_ROWS - 1 ? baseRadius + roofDepth : baseRadius;
        expect(radius).toBeCloseTo(expectedRadius, 3);
        minVertexY = Math.min(minVertexY, position.getY(vertex));
        maxVertexY = Math.max(maxVertexY, position.getY(vertex));
      }
      eaveHeights.add(Math.round(position.getY(i * NEON_SKYLINE_ROWS + 2) * 1000));
    }

    expect(minVertexY).toBeLessThan(minY);
    expect(maxVertexY).toBeGreaterThan(midY);
    // A handful of story heights, not a smooth ridge.
    expect(eaveHeights.size).toBeGreaterThan(3);
    expect(eaveHeights.size).toBeLessThan(16);

    const eaveY = (segment: number) => position.getY(segment * NEON_SKYLINE_ROWS + 2);
    let gaps = 0;
    for (let block = 0; block < NEON_SKYLINE_BLOCKS; block++) {
      const face = block * 3;
      expect(eaveY(face)).toBeCloseTo(eaveY(face + 1), 4);
      if (eaveY(face + 2) < eaveY(face) - 1) gaps += 1;
    }
    expect(gaps).toBeGreaterThan(5);

    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const normal = new Vector3();
    const mid = new Vector3();
    let inward = 0;
    let up = 0;
    const faces = index.count / 3;
    for (let face = 0; face < faces; face += 11) {
      const offset = face * 3;
      a.fromBufferAttribute(position, index.getX(offset));
      b.fromBufferAttribute(position, index.getX(offset + 1));
      c.fromBufferAttribute(position, index.getX(offset + 2));
      normal.copy(b).sub(a).cross(c.clone().sub(a));
      mid.copy(a).add(b).add(c);
      inward += normal.dot(new Vector3(-mid.x, 0, -mid.z));
      up += normal.y;
    }
    expect(inward).toBeGreaterThan(0);
    expect(up).toBeGreaterThan(0);
    geometry.dispose();
  });

  it("keeps story heights constant across a block and zero in the gaps", () => {
    for (let block = 0; block < NEON_SKYLINE_BLOCKS; block++) {
      const left = neonSkylineUnit((block + 0.05) / NEON_SKYLINE_BLOCKS);
      const right = neonSkylineUnit((block + 0.45) / NEON_SKYLINE_BLOCKS);
      expect(left).toBeCloseTo(right, 6);
      expect(left).toBeGreaterThan(0);
      expect(neonSkylineUnit((block + 0.97) / NEON_SKYLINE_BLOCKS)).toBe(0);
    }
  });

  it("does not walk the sky or the skyline from the frame loop", () => {
    const atmosphere = readFileSync(new URL("../neon-atmosphere.ts", import.meta.url), "utf8");
    const view = readFileSync(new URL("../neon-view.tsx", import.meta.url), "utf8");
    const visualizer = readFileSync(new URL("../route-visualizer.tsx", import.meta.url), "utf8");
    expect(atmosphere).not.toContain("useFrame");
    expect(view).not.toContain("useFrame");
    expect(view).not.toMatch(/new (Vector3|Color|Float32Array|Matrix4)/);
    expect(view).toContain("useMemo(() => buildNeonSkylineGeometry(curve)");
    expect(atmosphere).not.toContain("children.forEach");
    expect(visualizer).toContain("NeonAtmosphere");
    expect(visualizer).toContain("AlpineAtmosphere");
    expect(visualizer).toContain('theme === "alpine" || theme === "neon"');
    expect(visualizer).toContain('theme === "neon" ? NEON_FOG_FAR : 250');
    expect(visualizer).toContain("BreathingMaterial");
    // Skyline geometry is built in the view's useMemo, not from the visualizer
    // frame loop. The one allowed neon/rainbow pulse still writes a single
    // emissive uniform.
    expect(visualizer).not.toContain("buildNeonSkylineGeometry");
    expect(view).not.toContain("children.forEach");
  });
});
