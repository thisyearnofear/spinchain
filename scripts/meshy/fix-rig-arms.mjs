#!/usr/bin/env node
/**
 * fix-rig-arms.mjs — repair an auto-rig that collapsed each arm chain onto
 * a single joint inside the torso (Fuser Meshy Rigging / Meshy API on the
 * Tripo Ember rider: left-arm verts bound to LeftArm at x≈0.04m bind, right
 * to RightHand; shoulder/forearm verts scattered across unrelated joints).
 *
 * Everything happens in MESH space (meters, authored T-pose): the arm is a
 * horizontal tube running ±X at shoulder height. For each arm we:
 *   1. find the arm axis from far verts (x·side ∈ [0.35, 0.75]) and take the
 *      tube = verts within ARM_RADIUS of it and x·side > 0.10,
 *   2. place Arm/ForeArm/Hand joints at band centroids along the axis —
 *      joint world positions are exactly 100× mesh-space positions in this
 *      rig (armature in cm, mesh in m),
 *   3. re-weight tube verts by x-band (100% band joint, 50/50 blends at the
 *      boundaries, 50/50 band/original-dominant in the armpit entry zone),
 *   4. re-home verts dominated by arm joints but outside the tube to their
 *      nearest torso joint (they're chest/back geometry the rigger
 *      mis-bound),
 *   5. rewrite IBMs as inv(J_new)·J_old·IBM_old so the bind pose is
 *      preserved exactly.
 *
 * Usage: node scripts/meshy/fix-rig-arms.mjs <in.glb> <out.glb>
 */

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { Matrix4, Vector3 } from "three";

const [SRC, DEST] = process.argv.slice(2);
if (!SRC || !DEST) {
  console.error("usage: node fix-rig-arms.mjs <in.glb> <out.glb>");
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SRC);
const root = doc.getRoot();
const skin = root.listSkins()[0];
if (!skin) throw new Error("no skin");

const joints = skin.listJoints();
const byName = new Map(joints.map((j, i) => [j.getName(), i]));

function localMat(node) {
  const a = node.getMatrix();
  return new Matrix4().set(
    a[0], a[4], a[8], a[12],
    a[1], a[5], a[9], a[13],
    a[2], a[6], a[10], a[14],
    a[3], a[7], a[11], a[15],
  );
}

// Chain matrix in armature space (all ancestor node transforms included).
function chainMat(node) {
  const chain = [];
  let cur = node;
  while (cur && cur.getParentNode()) { chain.unshift(cur); cur = cur.getParentNode(); }
  const m = new Matrix4();
  for (const n of chain) m.multiply(localMat(n));
  return m;
}

const ibm = skin.getInverseBindMatrices();
const ibmMats = joints.map((_, i) => {
  const a = ibm.getElement(i, []);
  return new Matrix4().set(
    a[0], a[4], a[8], a[12],
    a[1], a[5], a[9], a[13],
    a[2], a[6], a[10], a[14],
    a[3], a[7], a[11], a[15],
  );
});
const Jold = joints.map((j) => chainMat(j));
// Joint bind positions in mesh space = translation of inv(IBM).
const bindPos = ibmMats.map((m) => m.clone().invert());

const ARM_RE = /^(Left|Right)(Arm|ForeArm|Hand)/;
const TORSO_RE = /Spine|Chest|Neck|Hips|Shoulder/;
const ARMS = [
  { side: +1, prefix: "Left", chain: ["LeftArm", "LeftForeArm", "LeftHand"] },
  { side: -1, prefix: "Right", chain: ["RightArm", "RightForeArm", "RightHand"] },
];
// Joint world = ARMATURE_SCALE × mesh-space position in this rig.
const ARMATURE_SCALE = 100;

// Collect every skinned vert once: mesh-space position + dominant joint.
// verts[i] = {prim, i, x, y, z, dom}
const verts = [];
const primSets = new Map(); // prim -> verts[] index list
for (const n of root.listNodes().filter((n) => n.getMesh() && n.getSkin())) {
  for (const prim of n.getMesh().listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    const ji = prim.getAttribute("JOINTS_0");
    const wt = prim.getAttribute("WEIGHTS_0");
    if (!pos || !ji || !wt) continue;
    const p = [0, 0, 0], w = [0, 0, 0, 0], jj = [0, 0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, p); ji.getElement(i, jj); wt.getElement(i, w);
      let best = 0;
      for (let k = 1; k < 4; k++) if (w[k] > w[best]) best = k;
      const rec = { prim, i, x: p[0], y: p[1], z: p[2], dom: jj[best] };
      verts.push(rec);
      if (!primSets.has(prim)) primSets.set(prim, []);
      primSets.get(prim).push(rec);
    }
  }
}

const Jnew = new Map(Jold.map((m, i) => [joints[i], m.clone()]));

function setJointWorldPos(joint, meshPos) {
  const target = new Vector3(
    meshPos[0] * ARMATURE_SCALE,
    meshPos[1] * ARMATURE_SCALE,
    meshPos[2] * ARMATURE_SCALE,
  );
  const parent = joint.getParentNode();
  const parentChain = Jnew.get(parent) ?? chainMat(parent);
  const local = target.applyMatrix4(parentChain.clone().invert());
  joint.setTranslation([local.x, local.y, local.z]);
  Jnew.set(joint, parentChain.clone().multiply(localMat(joint)));
}

function writeWeights(prim, rec, pairs) {
  // pairs: [[jointIndex, weight], ...] — normalized in place, padded to 4.
  const ji = prim.getAttribute("JOINTS_0");
  const wt = prim.getAttribute("WEIGHTS_0");
  const jj = [0, 0, 0, 0], w = [0, 0, 0, 0];
  const sum = pairs.reduce((s, p) => s + p[1], 0);
  for (let k = 0; k < 4; k++) {
    jj[k] = pairs[k] ? pairs[k][0] : 0;
    w[k] = pairs[k] ? pairs[k][1] / sum : 0;
  }
  ji.setElement(rec.i, jj);
  wt.setElement(rec.i, w);
}

function nearestTorsoJoint(rec) {
  const e = new Vector3();
  let bestIdx = 0, bestD = Infinity;
  joints.forEach((j, idx) => {
    const nm = j.getName();
    if (!TORSO_RE.test(nm) || ARM_RE.test(nm)) return;
    const m = bindPos[idx];
    e.set(rec.x - m.elements[12], rec.y - m.elements[13], rec.z - m.elements[14]);
    const d = e.lengthSq();
    if (d < bestD) { bestD = d; bestIdx = idx; }
  });
  return bestIdx;
}

for (const arm of ARMS) {
  const chainIdx = arm.chain.map((nm) => byName.get(nm));
  if (chainIdx.some((i) => i === undefined)) { console.warn(`skip ${arm.prefix}: chain missing`); continue; }

  // Hand tip H: centroid of the outermost verts on this side. Works whether
  // the arm is straight along ±X or bent forward at the elbow — the arm
  // parametrizes by distance-to-hand instead of x.
  const far = verts.filter((u) => u.x * arm.side > 0.55);
  if (!far.length) { console.warn(`skip ${arm.prefix}: no far verts`); continue; }
  const fx = far.map((u) => u.x * arm.side).sort((a, b) => a - b);
  const tip = fx[Math.floor(fx.length * 0.9)];
  const handVerts = far.filter((u) => u.x * arm.side > Math.min(0.68, tip - 0.06));
  const H = handVerts.reduce((s, u) => s.add(new Vector3(u.x, u.y, u.z)), new Vector3()).multiplyScalar(1 / handVerts.length);

  // Shoulder anchor S: centroid of the deltoid shell — verts whose distance
  // to the hand ≈ the full arm length. The rigger's Shoulder bind position
  // sits near the spine midline, so it can't be trusted.
  const armCandidate = (u) => u.x * arm.side > 0.08;
  const roughL = H.distanceTo(new Vector3(0.15 * arm.side, H.y, H.z * 0.3));
  const deltoid = verts.filter(
    (u) => armCandidate(u) && Math.abs(new Vector3(u.x, u.y, u.z).distanceTo(H) / roughL - 1) < 0.12,
  );
  const S = deltoid.length
    ? deltoid.reduce((s, u) => s.add(new Vector3(u.x, u.y, u.z)), new Vector3()).multiplyScalar(1 / deltoid.length)
    : new Vector3(0.15 * arm.side, H.y, H.z * 0.3);
  const L = H.distanceTo(S);
  if (L < 0.3) { console.warn(`skip ${arm.prefix}: arm length ${L.toFixed(2)}m implausible`); continue; }

  // Parametrize verts on this side by distance-to-hand, normalized by arm
  // length: d≈0 at the hand, d≈1 at the shoulder.
  const dOf = (u) => new Vector3(u.x, u.y, u.z).distanceTo(H) / L;
  const inArm = (u) => u.x * arm.side > 0.08 && dOf(u) < 1.08;

  // Band boundaries (distance-to-hand, normalized) and blend half-width.
  const B_HAND = 0.30, B_WRIST = 0.68, BLEND = 0.05;
  const bandOf = (d) => (d < B_HAND ? 2 : d < B_WRIST ? 1 : 0);

  // Joint targets: wrist = centroid of the d≈0.30 shell, elbow = d≈0.68
  // shell, shoulder = S nudged along the chain direction.
  const shell = (dC, halfW) => {
    const near = verts.filter((u) => inArm(u) && Math.abs(dOf(u) - dC) < halfW);
    if (!near.length) return null;
    return near.reduce((s, u) => s.add(new Vector3(u.x, u.y, u.z)), new Vector3()).multiplyScalar(1 / near.length);
  };
  const wrist = shell(B_HAND, 0.10) ?? H.clone();
  const elbow = shell(B_WRIST, 0.10) ?? S.clone().lerp(H, B_WRIST);
  const targets = [S, elbow, wrist];
  arm.chain.forEach((name, k) => setJointWorldPos(joints[byName.get(name)], targets[k].toArray()));

  // Re-weight: every vert on this side gets band weights by d; verts bound
  // to this arm's joints but outside the arm region go to the nearest torso
  // joint (chest/back geometry the rigger mis-bound).
  const armNameRe = new RegExp(`^${arm.prefix}(Arm|ForeArm|Hand)`);
  const armJointSet = new Set(
    joints.map((j, i) => [j.getName(), i]).filter(([nm]) => armNameRe.test(nm)).map(([, i]) => i),
  );
  let rew = 0, rehomed = 0;
  for (const u of verts) {
    const domIsArm = armJointSet.has(u.dom);
    if (inArm(u)) {
      const d = dOf(u);
      let pairs;
      const blendAt = (b, jA, jB) => {
        const t = (d - (b - BLEND)) / (2 * BLEND);
        return [[chainIdx[jA], 1 - t], [chainIdx[jB], t]];
      };
      if (Math.abs(d - B_HAND) < BLEND) pairs = blendAt(B_HAND, 1, 2);
      else if (Math.abs(d - B_WRIST) < BLEND) pairs = blendAt(B_WRIST, 0, 1);
      else pairs = [[chainIdx[bandOf(d)], 1]];
      // Shoulder band: keep half of a non-arm dominant binding so the
      // deltoid blends into the chest instead of tearing a seam.
      if (bandOf(d) === 0 && !domIsArm) pairs.push([u.dom, 1]);
      writeWeights(u.prim, u, pairs);
      rew++;
    } else if (domIsArm) {
      writeWeights(u.prim, u, [[nearestTorsoJoint(u), 1]]);
      rehomed++;
    }
  }
  console.log(
    `${arm.prefix}: L=${L.toFixed(2)}m, rewrote ${rew}, rehomed ${rehomed}, ` +
    `S=${S.toArray().map((x) => x.toFixed(2))} E=${elbow.toArray().map((x) => x.toFixed(2))} W=${wrist.toArray().map((x) => x.toFixed(2))}`,
  );
}

// Preserve the bind pose: IBM_new = inv(J_new) · J_old · IBM_old.
const arr = ibm.getArray().slice();
joints.forEach((j, i) => {
  const m = Jnew.get(j).clone().invert().multiply(Jold[i]).multiply(ibmMats[i]);
  arr.set(m.elements, i * 16);
});
ibm.setArray(arr);

await io.write(DEST, doc);
console.log(`wrote ${DEST}`);
