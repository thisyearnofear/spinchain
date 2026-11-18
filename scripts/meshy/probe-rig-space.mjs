// Probe a rigged GLB's coordinate spaces: inv(IBM) bind translations vs
// node-chain world translations vs raw POSITION bounds. Read-only.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { Matrix4, Vector3 } from "three";

const file = process.argv[2] ?? "public/characters/rider-ember.glb";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(file);
const skin = doc.getRoot().listSkins()[0];
const joints = skin.listJoints();
const ibm = skin.getInverseBindMatrices();

function localMat(node) {
  const a = node.getMatrix();
  return new Matrix4().set(a[0], a[4], a[8], a[12], a[1], a[5], a[9], a[13], a[2], a[6], a[10], a[14], a[3], a[7], a[11], a[15]);
}
function chainMat(node) {
  const chain = [];
  let cur = node;
  while (cur && cur.getParentNode()) { chain.unshift(cur); cur = cur.getParentNode(); }
  const m = new Matrix4();
  for (const n of chain) m.multiply(localMat(n));
  return m;
}

console.log("name".padEnd(16), "inv(IBM).t".padEnd(30), "chain.t".padEnd(30), "ibmScale", "chainScale");
joints.forEach((j, i) => {
  const a = ibm.getElement(i, []);
  const M = new Matrix4().set(a[0], a[4], a[8], a[12], a[1], a[5], a[9], a[13], a[2], a[6], a[10], a[14], a[3], a[7], a[11], a[15]);
  const inv = M.clone().invert();
  const t = [inv.elements[12], inv.elements[13], inv.elements[14]];
  const s = new Vector3().setFromMatrixColumn(inv, 0).length();
  const c = chainMat(j);
  const cs = new Vector3().setFromMatrixColumn(c, 0).length();
  console.log(
    j.getName().padEnd(16),
    t.map((v) => v.toFixed(3)).join(",").padEnd(30),
    [c.elements[12], c.elements[13], c.elements[14]].map((v) => v.toFixed(3)).join(",").padEnd(30),
    s.toFixed(4), cs.toFixed(4),
  );
});

// POSITION bounds per skinned node + node chain matrix
for (const n of doc.getRoot().listNodes().filter((n) => n.getMesh() && n.getSkin())) {
  const c = chainMat(n);
  let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9], count = 0;
  for (const prim of n.getMesh().listPrimitives()) {
    const acc = prim.getAttribute("POSITION"); const el = [];
    for (let i = 0; i < acc.getCount(); i++) { acc.getElement(i, el); count++; for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], el[k]); max[k] = Math.max(max[k], el[k]); } }
  }
  console.log(`mesh node "${n.getName()}" pos min ${min.map((v) => v.toFixed(2))} max ${max.map((v) => v.toFixed(2))} (${count} verts)`);
  console.log(`  chain.t=[${[c.elements[12], c.elements[13], c.elements[14]].map((v) => v.toFixed(2))}] scale=${new Vector3().setFromMatrixColumn(c, 0).length().toFixed(4)}`);
}
// skeleton root chain
const sk = skin.getSkeleton?.() ?? joints[0];
console.log(`skeleton node: ${sk?.getName()}`);
