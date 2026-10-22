import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { VISUALIZER_THEMES } from "../visualizer-theme";
import { buildReadout } from "../bike-computer";
import { FLOW_COLORS } from "@/app/lib/flow-state";
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
  buildGroundCoverField,
  buildPropField,
  propOrigin,
  seededRandom,
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
    tuft: ["cone", "cone", "cone"],
  };

  it("builds one instanced silhouette per theme, planted on the skirt", () => {
    expect(VISUALIZER_THEMES.alpine.props.count).toBe(120);
    expect(VISUALIZER_THEMES.neon.props.count).toBe(40);
    expect(VISUALIZER_THEMES.mars.props.count).toBe(80);
    expect(VISUALIZER_THEMES.anime.props.count).toBe(200);
    expect(VISUALIZER_THEMES.rainbow.props.count).toBe(60);
    // The Cloud Kingdom owns no silhouette: its dressing is the authored
    // metaball layout, not a shared prop set.
    expect("props" in VISUALIZER_THEMES.cloud).toBe(false);

    for (const name of Object.keys(VISUALIZER_THEMES) as Array<keyof typeof VISUALIZER_THEMES>) {
      const theme = VISUALIZER_THEMES[name] as (typeof VISUALIZER_THEMES)["neon"] & {
        props?: { type: PropType; color: string; count: number; scale: readonly [number, number, number] };
      };
      const config = theme.props;
      if (!config) {
        expect(name).toBe("cloud");
        continue;
      }
      const spec = SILHOUETTES[config.type];
      expect(spec.map((part) => part.shape)).toEqual(shapes[config.type]);
      // At most one part of a silhouette breathes — the building's cap and
      // the crystal's shard.
      expect(spec.filter((part) => part.breathes).length).toBeLessThanOrEqual(1);
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

describe("ground cover band", () => {
  it("plants tufts in the close roadside band, denser than the props, deterministically", () => {
    for (const name of Object.keys(VISUALIZER_THEMES) as Array<keyof typeof VISUALIZER_THEMES>) {
      const theme = VISUALIZER_THEMES[name] as (typeof VISUALIZER_THEMES)["neon"] & {
        groundCover?: { color: string; count: number; scale: readonly [number, number, number] };
      };
      const groundCover = theme.groundCover;
      // Every world that renders the shared skirt kit carries the tuft band.
      // The Cloud Kingdom is exempt — it renders the authored kit instead.
      if (!groundCover) {
        expect(name).toBe("cloud");
        continue;
      }
      const halfWidth = roadProfile(name).halfWidth;
      const field = buildGroundCoverField(
        curve,
        { type: "tuft", color: groundCover.color, count: groundCover.count, scale: groundCover.scale },
        halfWidth,
      );
      expect(field.parts).toHaveLength(3);

      for (const index of [0, 5, 44]) {
        const contact = groundContact(field.parts[0].matrices, index, SILHOUETTES.tuft[0]);
        const u = seededRandom(index + 5000);
        const onCurve = curve.getPointAt(u - Math.floor(u));
        const horizontal = Math.hypot(contact.x - onCurve.x, contact.z - onCurve.z);
        // The band hug: closer than the silhouette props ever come (8–23),
        // and never on the tarmac — the narrow-road scale factor bottoms the
        // band out at 2.5 * 0.85 = 2.125 lateral.
        expect(horizontal).toBeGreaterThanOrEqual(2.0);
        expect(horizontal).toBeLessThanOrEqual(23.5);
        // Planted below the road surface line, on the skirt's fall.
        expect(contact.y).toBeLessThan(onCurve.y);
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
    const shared = readFileSync(new URL("../theme-atmosphere.tsx", import.meta.url), "utf8");
    expect(view).toContain("buildHorizonGeometry: buildNeonSkylineGeometry");
    expect(shared).toContain("useMemo(() => kit.buildHorizonGeometry(curve)");
    expect(atmosphere).not.toContain("children.forEach");
    expect(visualizer).toContain("NeonAtmosphere");
    expect(visualizer).toContain("AlpineAtmosphere");
    expect(visualizer).toContain('theme === "alpine" || theme === "neon"');
    // Fog far plane: alpine and neon keep their own, and the planetary
    // worlds carry their own too — none of them fall through to the
    // neutral 250.
    expect(visualizer).toContain("NEON_FOG_FAR");
    expect(visualizer).toContain("planetProfile.fogFar");
    expect(visualizer).toContain("BreathingMaterial");
    // Skyline geometry is built in the view's useMemo, not from the visualizer
    // frame loop. The one allowed neon/rainbow pulse still writes a single
    // emissive uniform.
    expect(visualizer).not.toContain("buildNeonSkylineGeometry");
    expect(view).not.toContain("children.forEach");
  });
});

describe("diegetic bike readout", () => {
  it("formats watt ranges, bare numbers (the harness casts one in), and free rides", () => {
    expect(buildReadout([200, 300], 0, "#74c0fc")).toEqual({
      headline: "250 W",
      tierLabel: "STEADY",
      accent: "#74c0fc",
    });
    expect(buildReadout([180, 220], 2, "#fallback").headline).toBe("200 W");
    expect(buildReadout(249.4, 3, "#fallback").headline).toBe("249 W");
    expect(buildReadout(null, 1, "#fallback").headline).toBe("FREE RIDE");
  });

  it("swaps the accent to the tier's color and names the baseline STEADY", () => {
    const low = buildReadout([100, 200], 1, "#fallback");
    const high = buildReadout([100, 200], 4, "#fallback");
    expect(low.tierLabel).toBe("Focused");
    expect(low.accent).toBe(FLOW_COLORS[1]);
    expect(high.tierLabel).toBe("Mastery");
    expect(high.accent).toBe(FLOW_COLORS[4]);
    // Tier 0 has no flow identity — it stays on the rider's own color.
    expect(buildReadout([100, 200], 0, "#rider").accent).toBe("#rider");
  });

  it("stays presentation-only: no frame loop, no telemetry read, no scene lights", () => {
    const source = readFileSync(new URL("../bike-computer.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("useFrame");
    expect(source).not.toContain("useTelemetryStore");
    expect(source).not.toContain("pointLight");
    // Mounted only in ride mode; the projection is capped off on the low tier,
    // and the device + chip ride the same rider group the YOU label does.
    const visualizer = readFileSync(new URL("../route-visualizer.tsx", import.meta.url), "utf8");
    expect(visualizer).toContain('showReadout={mode === "ride"}');
    expect(visualizer).toContain('readoutProjected={performanceTier !== "low"}');
  });

  it("shares the tier vocabulary with the HUD and the world reaction, not copies of it", () => {
    const hud = readFileSync(new URL("../../ride/ride-hud-overlay-v2.tsx", import.meta.url), "utf8");
    const reactive = readFileSync(new URL("../../../../hooks/route/use-reactive-world.ts", import.meta.url), "utf8");
    expect(hud).toContain('from "@/app/lib/flow-state"');
    expect(reactive).toContain('from "@/app/lib/flow-state"');
    expect(hud).not.toMatch(/const FLOW_LABELS =/);
    const bias = reactive.match(/FLOW_COLORS\[flowTier\] as string.+\|\| null/);
    expect(bias).not.toBeNull();
  });
});

// ─── Ride lab (test-harness experiment) ────────────────────────────
import {
  DEFAULT_OPTIONS,
  DURATION,
  buildLabCurve,
  labSideAt,
  parseLabOptions,
  parseLabTime,
} from "../ride-lab/config";
import { LAB_ROAD_WIDTH, buildLabEdgeTrims, buildLabRoadGeometry } from "../ride-lab/lab-geometry";
import { buildNeonField } from "../ride-lab/lab-worlds";

describe("ride lab", () => {
  const curve = buildLabCurve();
  const road = buildLabRoadGeometry(curve, { top: "#b7aacb", underside: "#5d4f78", side: "#7d6f96" });

  it("sweeps a ~3.8-wide deck with finite vertices and up-facing top", () => {
    const pos = road.getAttribute("position");
    const nor = road.getAttribute("normal");
    // First two verts are station 0's top-left / top-right.
    const tl = new Vector3(pos.getX(0), pos.getY(0), pos.getZ(0));
    const tr = new Vector3(pos.getX(1), pos.getY(1), pos.getZ(1));
    expect(tl.distanceTo(tr)).toBeCloseTo(LAB_ROAD_WIDTH, 5);
    // Top face normal is world-up — the ribbon never banks.
    expect(nor.getX(0)).toBeCloseTo(0, 5);
    expect(nor.getY(0)).toBeCloseTo(1, 5);
    expect(nor.getZ(0)).toBeCloseTo(0, 5);
    for (let i = 0; i < pos.count; i++) {
      expect(Number.isFinite(pos.getX(i))).toBe(true);
      expect(Number.isFinite(pos.getY(i))).toBe(true);
      expect(Number.isFinite(pos.getZ(i))).toBe(true);
    }
  });

  it("winds both edge trims up — geometric normals, not attributes", () => {
    const trims = buildLabEdgeTrims(curve);
    const pos = trims.getAttribute("position");
    // Two strips × SEGMENTS quads × 2 triangles; strip 0 is sign −1,
    // strip 1 is sign +1. Sample a triangle from each half.
    const triCount = pos.count / 3;
    const half = triCount / 2;
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const ab = new Vector3();
    const ac = new Vector3();
    for (const [name, tri] of [["left", 10], ["right", half + 10]] as const) {
      a.set(pos.getX(tri * 3), pos.getY(tri * 3), pos.getZ(tri * 3));
      b.set(pos.getX(tri * 3 + 1), pos.getY(tri * 3 + 1), pos.getZ(tri * 3 + 1));
      c.set(pos.getX(tri * 3 + 2), pos.getY(tri * 3 + 2), pos.getZ(tri * 3 + 2));
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      const n = new Vector3().crossVectors(ab, ac);
      expect(n.y, `${name} edge strip should face up`).toBeGreaterThan(0);
    }
  });

  it("parses only whitelisted params; everything else falls back", () => {
    const bad = new URLSearchParams("world=cyberpunk&study=mega&camera=drone&effects=yes&effort=max&dpr=2");
    expect(parseLabOptions(bad)).toEqual(DEFAULT_OPTIONS);
    const good = new URLSearchParams("world=neon&study=landmark&camera=first&effects=1&effort=push&dpr=1.5");
    expect(parseLabOptions(good)).toEqual({
      world: "neon",
      study: "landmark",
      camera: "first",
      effects: true,
      effort: "push",
      dpr: 1.5,
    });
  });

  it("clamps time to the 45s window and reads paused honestly", () => {
    expect(parseLabTime(new URLSearchParams("t=999")).t).toBe(DURATION);
    expect(parseLabTime(new URLSearchParams("t=-5")).t).toBe(0);
    expect(parseLabTime(new URLSearchParams("t=banana")).t).toBe(0);
    expect(parseLabTime(new URLSearchParams("t=12.5&paused=1"))).toEqual({ t: 12.5, paused: true });
    expect(parseLabTime(new URLSearchParams("paused=0")).paused).toBe(false);
    // Garbage paused values must not silently force autoplay.
    expect(parseLabTime(new URLSearchParams("paused=maybe")).paused).toBeNull();
    expect(parseLabTime(new URLSearchParams("")).paused).toBeNull();
  });

  it("keeps the base city under the neon passage walls", () => {
    const field = buildNeonField("passage", curve);
    const base = buildNeonField("ribbon", curve);
    // Passage must ADD walls on top of the base towers, never replace them.
    expect(field.towers.length).toBeGreaterThan(base.towers.length);
    expect(field.citySignals.length).toBe(base.citySignals.length);
  });

  it("spans passage beams across the road, not along it", () => {
    const field = buildNeonField("passage", curve);
    expect(field.beams.length).toBeGreaterThan(0);
    for (const beam of field.beams) {
      // Beam local X (its long axis) after yaw must be ~perpendicular to
      // the route tangent — i.e. roughly parallel to the side vector.
      // Find the closest anchor on the curve to measure the local tangent.
      let bestU = 0;
      let bestD = Infinity;
      const p = new Vector3();
      for (let i = 0; i <= 200; i++) {
        curve.getPointAt(i / 200, p);
        const d = p.distanceTo(beam.position);
        if (d < bestD) {
          bestD = d;
          bestU = i / 200;
        }
      }
      const tangent = curve.getTangentAt(bestU, new Vector3());
      const side = labSideAt(curve, bestU, new Vector3());
      // Local X in world after yaw = (cos yaw, 0, -sin yaw).
      const localX = new Vector3(Math.cos(beam.yaw), 0, -Math.sin(beam.yaw));
      expect(Math.abs(localX.dot(tangent)), "beam long axis should be ~perpendicular to the route").toBeLessThan(0.2);
      expect(Math.abs(localX.dot(side))).toBeGreaterThan(0.8);
    }
  });
});

// ─── Cloud ride sequence (authored 45s route) ──────────────────────
import { buildCloudGeometry, buildCloudLayout } from "../cloud-ride/cloud-world";
import {
  buildCloudRoadGeometry,
  cloudFrameAt,
  CLOUD_ROAD_SEGMENTS,
  CLOUD_ROAD_WIDTH,
  type CloudFrame,
} from "../cloud-ride/cloud-geometry";
import {
  CLOUD_DURATION,
  makeCloudCurve,
  revealAt,
  sequenceProgress,
  parseCloudOptions,
  parseCloudTime,
} from "../cloud-ride/sequence";

describe("cloud ride", () => {
  const curve = makeCloudCurve();
  const road = buildCloudRoadGeometry(curve, false);

  it("lays the authored world on the production curve too", () => {
    // The same buildCloudLayout drives /rider/ride — run it on the real
    // closed route curve and check every placement is finite and sane.
    const prodCurve = buildRouteCurve([]);
    const layout = buildCloudLayout(prodCurve);
    expect(layout.sea.length).toBeGreaterThan(0);
    expect(layout.towers.length).toBeGreaterThan(0);
    for (const p of [...layout.sea, ...layout.towers, ...layout.islands]) {
      for (const v of [p.position.x, p.position.y, p.position.z, p.scale.x, p.scale.y, p.scale.z]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(p.scale.x).toBeGreaterThan(0);
    }
    // Landmark arches exist on both halves of a ride.
    expect(layout.towers.some((t) => t.period > 0)).toBe(true);
  });

  it("sweeps a 5.2-wide deck: finite verts, correct top winding", () => {
    const pos = road.getAttribute("position");
    const idx = road.getIndex()!;
    for (let i = 0; i < pos.count; i += 37) {
      expect(Number.isFinite(pos.getX(i))).toBe(true);
      expect(Number.isFinite(pos.getY(i))).toBe(true);
      expect(Number.isFinite(pos.getZ(i))).toBe(true);
    }
    // N faces per station — the profile loop is closed.
    const N = 12;
    expect(idx.count).toBe(CLOUD_ROAD_SEGMENTS * N * 6);
    // Geometric normal from the ACTUAL index triangles on the top face
    // (profile j=0→j=1 is the deck's top edge) at start/mid/end.
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), ab = new Vector3(), ac = new Vector3();
    for (const station of [0, 200, 399]) {
      const triBase = station * N * 6; // first two tris of this station's first face
      const [i0, i1, i2] = [idx.getX(triBase), idx.getX(triBase + 1), idx.getX(triBase + 2)];
      a.set(pos.getX(i0), pos.getY(i0), pos.getZ(i0));
      b.set(pos.getX(i1), pos.getY(i1), pos.getZ(i1));
      c.set(pos.getX(i2), pos.getY(i2), pos.getZ(i2));
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      const n = new Vector3().crossVectors(ab, ac);
      expect(n.y, `top face at station ${station} should face up`).toBeGreaterThan(0);
    }
    // Width from actual profile extrema projected on the frame side.
    // Frame at the SAME station as the verts being measured (u = 0).
    const f: CloudFrame = { point: new Vector3(), tangent: new Vector3(), side: new Vector3(), up: new Vector3(), bank: 0 };
    cloudFrameAt(curve, 0, f, false);
    let min = Infinity, max = -Infinity;
    const p = new Vector3();
    for (let j = 0; j < N; j++) {
      p.set(pos.getX(j), pos.getY(j), pos.getZ(j)).sub(f.point);
      const lat = p.dot(f.side);
      min = Math.min(min, lat);
      max = Math.max(max, lat);
    }
    expect(max - min).toBeCloseTo(CLOUD_ROAD_WIDTH, 4);
    expect(CLOUD_ROAD_WIDTH).toBeCloseTo(5.2);
  });

  it("derives a consistent banked frame; bank stays continuous", () => {
    const f: CloudFrame = { point: new Vector3(), tangent: new Vector3(), side: new Vector3(), up: new Vector3(), bank: 0 };
    cloudFrameAt(curve, 0.3, f, true);
    expect(Math.abs(f.bank)).toBeLessThanOrEqual(0.08);
    expect(f.side.length()).toBeCloseTo(1, 5);
    expect(Math.abs(f.side.dot(f.tangent))).toBeLessThan(0.01);
    cloudFrameAt(curve, 0.3, f, false);
    expect(f.bank).toBe(0);
    // No snapped banks: adjacent stations never jump more than .025 rad.
    const g: CloudFrame = { point: new Vector3(), tangent: new Vector3(), side: new Vector3(), up: new Vector3(), bank: 0 };
    cloudFrameAt(curve, 0, g, true);
    for (let i = 1; i <= 400; i++) {
      const u = i / 400;
      const prev = g.bank;
      cloudFrameAt(curve, u, g, true);
      expect(Math.abs(g.bank - prev), `bank step near u=${u}`).toBeLessThanOrEqual(0.025);
    }
  });

  it("builds continuous cloud geometry with finite bounds", () => {
    const g = buildCloudGeometry(14, 31);
    const pos = g.getAttribute("position");
    expect(pos.count).toBeGreaterThan(0);
    for (let i = 0; i < pos.count; i += 97) {
      expect(Number.isFinite(pos.getX(i))).toBe(true);
      expect(Number.isFinite(pos.getY(i))).toBe(true);
      expect(Number.isFinite(pos.getZ(i))).toBe(true);
      expect(Math.abs(pos.getX(i))).toBeLessThanOrEqual(1.001);
    }
    g.dispose();
  });

  it("clamps/monotonically maps the sequence", () => {
    expect(sequenceProgress(0)).toBeCloseTo(0.065, 6);
    expect(sequenceProgress(45)).toBeCloseTo(0.935, 6);
    for (const t of [0, 9, 21, 29, 45]) {
      const v = sequenceProgress(t);
      expect(v).toBeGreaterThanOrEqual(0.065);
      expect(v).toBeLessThanOrEqual(0.935);
    }
    expect(sequenceProgress(-10)).toBe(sequenceProgress(0));
    expect(sequenceProgress(99)).toBe(sequenceProgress(45));
    expect(sequenceProgress(30)).toBeGreaterThan(sequenceProgress(10));
  });

  it("reveals smoothly and clamps at both ends", () => {
    expect(revealAt(0)).toBe(0);
    expect(revealAt(19)).toBe(0);
    expect(revealAt(25)).toBe(1);
    expect(revealAt(45)).toBe(1);
    const mid = revealAt(22);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it("parses cloud params safely", () => {
    expect(parseCloudOptions(new URLSearchParams("view=cinema&effort=push"), false)).toEqual({ view: "cinema", effort: "push", reducedMotion: false });
    expect(parseCloudOptions(new URLSearchParams("view=drone&effort=max"), true)).toEqual({ view: "play", effort: "cruise", reducedMotion: true });
    expect(parseCloudTime(new URLSearchParams("t=50")).t).toBe(CLOUD_DURATION);
    expect(parseCloudTime(new URLSearchParams("t=x")).t).toBe(0);
    expect(parseCloudTime(new URLSearchParams("paused=1")).paused).toBe(true);
    expect(parseCloudTime(new URLSearchParams("paused=maybe")).paused).toBeNull();
  });
});
