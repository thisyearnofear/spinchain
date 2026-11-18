#!/usr/bin/env node
/**
 * Normalize bike-fuser.glb (Tripo image-to-3D via Fuser) into SpinChain rig
 * space → bike-fuser-rig.glb. Same contract as normalize-bike.mjs:
 *
 *   - length already along Z (no rotation needed; front verified in rig
 *     studio — flip ROT_Y_180 below if the model ships facing −Z)
 *   - uniform scale 2.66 → wheelbase ≈ 1.52 (matches the procedural rig)
 *   - translation (0, 0.601, 0.154) → wheel bottoms at y≈0 (road deck),
 *     axles at the RIG rear/front axle z's (−0.617 / +0.903)
 *
 * Keypoints measured from the GLB itself (lowest 12% of verts cluster at
 * z ≈ −0.290 / +0.281, wheel bottoms y = −0.226).
 *
 * Usage: node scripts/meshy/normalize-bike-fuser.mjs
 */

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = join(ROOT, "assets/fuser/bike-fuser.glb");
const DEST = join(ROOT, "public/characters/bike-fuser-rig.glb");

const SCALE = 2.66;
const TRANSLATION = [0, 0.601, 0.154];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SRC);
const node = doc.getRoot().listNodes().find((n) => n.getMesh());
if (!node) throw new Error("No node with a mesh found in the GLB.");
node.setScale([SCALE, SCALE, SCALE]);
node.setTranslation(TRANSLATION);
await io.write(DEST, doc);
console.log(`wrote ${DEST}`);
