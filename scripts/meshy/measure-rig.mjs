// Print bind-pose joint positions + segment lengths for a rigged GLB.
// Usage: node scripts/meshy/measure-rig.mjs public/characters/rider-meshy.glb [scale]
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const [, , file = "public/characters/rider-meshy.glb", scaleArg = "1"] = process.argv;
const scale = Number(scaleArg);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(file);

function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function pos(m) { return [m[12] * scale, m[13] * scale, m[14] * scale]; }
const world = new Map();
function walk(node, parent) {
  const m = parent ? mul(parent, node.getMatrix()) : node.getMatrix();
  world.set(node.getName(), pos(m));
  for (const c of node.listChildren()) walk(c, m);
}
for (const scene of doc.getRoot().listScenes()) for (const n of scene.listChildren()) walk(n, null);

const want = ["Hips", "Spine", "Spine01", "Spine02", "neck", "Head", "head_end", "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase", "RightUpLeg", "RightLeg", "RightFoot"];
for (const n of want) {
  const p = world.get(n);
  if (p) console.log(n.padEnd(14), p.map((v) => v.toFixed(3)).join(", "));
}
const d = (a, b) => { const pa = world.get(a), pb = world.get(b); return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]); };
console.log("\nsegments (×scale):");
console.log("femur   ", d("LeftUpLeg", "LeftLeg").toFixed(3));
console.log("tibia   ", d("LeftLeg", "LeftFoot").toFixed(3));
console.log("foot    ", d("LeftFoot", "LeftToeBase").toFixed(3));
console.log("upperarm", d("LeftArm", "LeftForeArm").toFixed(3));
console.log("forearm ", d("LeftForeArm", "LeftHand").toFixed(3));
console.log("torso   ", d("Hips", "neck").toFixed(3), "(hips→neck)");
console.log("hip→shoulder", d("Hips", "LeftArm").toFixed(3));
console.log("hip width", (Math.abs(world.get("LeftUpLeg")[0] - world.get("RightUpLeg")[0])).toFixed(3));
console.log("shoulder width", (Math.abs(world.get("LeftArm")[0] - world.get("RightArm")[0] )).toFixed(3));

// Mesh bounds
let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
  const acc = prim.getAttribute("POSITION");
  const el = [];
  for (let i = 0; i < acc.getCount(); i++) { acc.getElement(i, el); for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], el[k] * scale); max[k] = Math.max(max[k], el[k] * scale); } }
}
console.log("\nmesh bounds min", min.map((v) => v.toFixed(3)), "max", max.map((v) => v.toFixed(3)));
