"use client";

/**
 * Ride lab world dressing — R3F components for the road, sky, fog, lights
 * and the two art kits (cloud lobes / neon city). All geometry comes from
 * the deterministic descriptors in lab-geometry.ts and lab-worlds.ts; these
 * components only own materials and instancing.
 */

import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  InstancedMesh,
  Matrix4,
  type CatmullRomCurve3,
} from "three";
import { createPlanetSkyGeometry, createPlanetSkyMaterial, CLOUD_PROFILE } from "../planetary-atmosphere";
import { createNeonSkyGeometry, createNeonSkyMaterial } from "../neon-atmosphere";
import { buildLabEdgeTrims, buildLabRoadGeometry, labDistanceMarkPlacements } from "./lab-geometry";
import { buildCloudField, buildNeonField, type LabInstance } from "./lab-worlds";
import type { LabStudy, LabWorld } from "./config";

// ─── Palette ───────────────────────────────────────────────────────

const CLOUD_ROAD: Parameters<typeof buildLabRoadGeometry>[1] = {
  top: "#b7aacb", // matte lilac deck
  underside: "#5d4f78", // darker plum underside
  side: "#7d6f96",
};
const NEON_ROAD: Parameters<typeof buildLabRoadGeometry>[1] = {
  top: "#101f30", // charcoal deck
  underside: "#060b14",
  side: "#0b1626",
};

const CLOUD_FOG = "#e3d6ea";
const NEON_FOG = "#0a1526";

// ─── Sky ───────────────────────────────────────────────────────────

function LabSky({ world }: { world: LabWorld }) {
  const { material, geometry } = useMemo(() => {
    if (world === "cloud") {
      // Bright blue zenith, peach horizon, soft daylight sun.
      return {
        material: createPlanetSkyMaterial(CLOUD_PROFILE, "#7fb8f5", "#ffcfae"),
        geometry: createPlanetSkyGeometry(),
      };
    }
    return { material: createNeonSkyMaterial("#050b1c", "#0e1e38"), geometry: createNeonSkyGeometry() };
  }, [world]);
  useEffect(() => () => {
    material.dispose();
    geometry.dispose();
  }, [material, geometry]);
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

// ─── Road ──────────────────────────────────────────────────────────

function LabRoad({ world, curve, edgeGlow }: { world: LabWorld; curve: CatmullRomCurve3; edgeGlow: number }) {
  const road = useMemo(() => buildLabRoadGeometry(curve, world === "cloud" ? CLOUD_ROAD : NEON_ROAD), [curve, world]);
  const trims = useMemo(() => buildLabEdgeTrims(curve), [curve]);
  const marks = useMemo(() => labDistanceMarkPlacements(curve), [curve]);
  useEffect(() => () => road.dispose(), [road]);
  useEffect(() => () => trims.dispose(), [trims]);

  const neon = world === "neon";
  return (
    <group>
      <mesh geometry={road}>
        <meshStandardMaterial vertexColors roughness={0.75} metalness={neon ? 0.25 : 0} />
      </mesh>
      <mesh geometry={trims}>
        <meshStandardMaterial
          color={neon ? "#0e2a38" : "#a294bd"}
          emissive={neon ? "#35e0ff" : "#cbbde6"}
          emissiveIntensity={neon ? edgeGlow : edgeGlow * 0.35}
          roughness={0.5}
        />
      </mesh>
      <instancedMesh args={[undefined, undefined, marks.length]} ref={(node) => {
        if (node) {
          marks.forEach((m, i) => node.setMatrixAt(i, m));
          node.instanceMatrix.needsUpdate = true;
          node.computeBoundingSphere();
        }
      }}>
        <boxGeometry args={[0.5, 0.012, 0.14]} />
        <meshStandardMaterial color={neon ? "#28506b" : "#9b8cb8"} roughness={0.8} />
      </instancedMesh>
    </group>
  );
}

// ─── Cloud world ───────────────────────────────────────────────────

function softRadialTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, "rgba(255,252,255,0.85)");
  g.addColorStop(0.55, "rgba(238,230,248,0.4)");
  g.addColorStop(1, "rgba(238,230,248,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new CanvasTexture(c);
  return tex;
}

function CloudWorld({ study, curve }: { study: LabStudy; curve: CatmullRomCurve3 }) {
  const field = useMemo(() => buildCloudField(study, curve), [study, curve]);
  const wispTex = useMemo(() => softRadialTexture(), []);
  useEffect(() => () => wispTex.dispose(), [wispTex]);
  return (
    <group>
      <instancedMesh
        args={[undefined, undefined, field.far.length]}
        ref={(node) => {
          if (node) {
            field.far.forEach((d, i) => node.setMatrixAt(i, new Matrix4().scale(d.scale).setPosition(d.position)));
            node.instanceMatrix.needsUpdate = true;
            node.computeBoundingSphere();
          }
        }}
      >
        <sphereGeometry args={[1, 20, 12]} />
        <meshStandardMaterial color="#e4e2f0" roughness={0.95} />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, Math.max(1, field.near.length)]}
        ref={(node) => {
          if (node) {
            field.near.forEach((d, i) => node.setMatrixAt(i, new Matrix4().scale(d.scale).setPosition(d.position)));
            node.instanceMatrix.needsUpdate = true;
            node.computeBoundingSphere();
          }
        }}
      >
        <sphereGeometry args={[1, 20, 12]} />
        <meshStandardMaterial color="#f5eff4" roughness={0.9} />
      </instancedMesh>
      {field.wisps.map((w, i) => (
        <sprite key={i} position={w.position} scale={[w.scale.x, w.scale.y, 1]}>
          <spriteMaterial map={wispTex} transparent opacity={0.32} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

// ─── Neon world ────────────────────────────────────────────────────

function NeonWorld({ study, curve }: { study: LabStudy; curve: CatmullRomCurve3 }) {
  const field = useMemo(() => buildNeonField(study, curve), [study, curve]);
  const set = (node: InstancedMesh | null, list: LabInstance[]) => {
    if (node) {
      list.forEach((d, i) => node.setMatrixAt(i, new Matrix4().makeRotationY(d.yaw).scale(d.scale).setPosition(d.position)));
      node.instanceMatrix.needsUpdate = true;
      node.computeBoundingSphere();
    }
  };
  return (
    <group>
      {/* Lower-level city: muted towers in three depth layers. */}
      <instancedMesh args={[undefined, undefined, field.towers.length]} ref={(n) => set(n, field.towers)}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#263959" roughness={0.85} metalness={0.2} />
      </instancedMesh>
      {/* Warm roof-edge signals so the city reads as inhabited. */}
      <instancedMesh args={[undefined, undefined, field.citySignals.length]} ref={(n) => set(n, field.citySignals)}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0a1526" emissive="#567bb6" emissiveIntensity={0.7} />
      </instancedMesh>
      {field.seams.length > 0 && (
        <instancedMesh args={[undefined, undefined, field.seams.length]} ref={(n) => set(n, field.seams)}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#0c2030" emissive="#35e0ff" emissiveIntensity={1.4} />
        </instancedMesh>
      )}
      {field.beams.length > 0 && (
        <instancedMesh args={[undefined, undefined, field.beams.length]} ref={(n) => set(n, field.beams)}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#0d1726" roughness={0.8} />
        </instancedMesh>
      )}
      {field.frames.length > 0 && (
        <instancedMesh args={[undefined, undefined, field.frames.length]} ref={(n) => set(n, field.frames)}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#1b2b45" roughness={0.7} metalness={0.35} />
        </instancedMesh>
      )}
      {field.strips.length > 0 && (
        <instancedMesh args={[undefined, undefined, field.strips.length]} ref={(n) => set(n, field.strips)}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#241a10" emissive="#ffb46a" emissiveIntensity={1.6} />
        </instancedMesh>
      )}
    </group>
  );
}

// ─── Assembled world ───────────────────────────────────────────────

export function LabWorld({ options, curve, effortAmount }: { options: { world: LabWorld; study: LabStudy }; curve: CatmullRomCurve3; effortAmount: number }) {
  const neon = options.world === "neon";
  // Small, bounded effort response: edge lines brighten a little with effort.
  // Never geometry density, never speed — just a material gain.
  const edgeGlow = 0.4 + 0.8 * effortAmount;
  return (
    <group>
      <fog attach="fog" args={[neon ? NEON_FOG : CLOUD_FOG, 80, 330]} />
      <hemisphereLight
        args={neon ? ["#182a4a", "#05070f", 1.1] : ["#e6f3ff", "#b0a3c3", 1.6]}
      />
      <directionalLight
        position={neon ? [40, 60, 60] : [-60, 100, -100]}
        intensity={neon ? 1 : 2.2}
        color={neon ? "#9fb0ff" : "#fff1da"}
      />
      <LabSky world={options.world} />
      <LabRoad world={options.world} curve={curve} edgeGlow={edgeGlow} />
      {neon ? <NeonWorld study={options.study} curve={curve} /> : <CloudWorld study={options.study} curve={curve} />}
    </group>
  );
}
