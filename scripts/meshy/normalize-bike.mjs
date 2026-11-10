#!/usr/bin/env node
/**
 * Normalize bike-meshy-i2d.glb into SpinChain rig space → bike-meshy-rig.glb.
 *
 * The Meshy image-to-3D output is a single mesh, ~1 unit long, wheels in the
 * X-Y plane, front toward +X. This bakes a similarity transform so the result
 * drops into the route rig unchanged:
 *
 *   - GLB +X (bike length, front)  → rig +Z (route forward)
 *   - uniform scale 2.61           → wheelbase ≈ 1.52, wheel radius ≈ 0.51
 *   - translation (0, 0.503, 0.143)→ wheel bottoms at y≈0 (road deck),
 *                                   axles at the RIG rear/front axle z's
 *
 * Keypoints were measured from the GLB itself (RANSAC circle fits on the two
 * wheels): centres (±0.291, ~0.003), r ≈ 0.196. Re-run this after regenerating
 * the source GLB — if Meshy's proportions change, re-measure first.
 *
 * Usage: node scripts/meshy/normalize-bike.mjs
 */

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = join(ROOT, "public/characters/bike-meshy-i2d.glb");
const DEST = join(ROOT, "public/characters/bike-meshy-rig.glb");

const SCALE = 2.61;
const ROT_Y_MINUS_90 = [0, -Math.SQRT1_2, 0, Math.SQRT1_2];
const TRANSLATION = [0, 0.503, 0.143];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SRC);
// The source is a single merged mesh, but pick the node that actually has a
// mesh rather than trusting document order — extra nodes (cameras, empties)
// would silently bake the transform onto the wrong object otherwise.
const node = doc.getRoot().listNodes().find((n) => n.getMesh());
if (!node) throw new Error("No node with a mesh found in the GLB.");
node.setScale([SCALE, SCALE, SCALE]);
node.setRotation(ROT_Y_MINUS_90);
node.setTranslation(TRANSLATION);
await io.write(DEST, doc);
console.log(`wrote ${DEST}`);
