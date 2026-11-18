// Separate the arm tube (z≈0) from the flat wing sheet (z>0) in the
// public ember GLB, per side.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const file = process.argv[2] ?? "public/characters/rider-ember.glb";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(file);
const skin = doc.getRoot().listSkins()[0];
const joints = skin.listJoints();
const jname = (i) => joints[i]?.getName();

const verts = [];
for (const n of doc.getRoot().listNodes().filter((n) => n.getMesh() && n.getSkin()))
  for (const prim of n.getMesh().listPrimitives()) {
    const pos = prim.getAttribute("POSITION"), ji = prim.getAttribute("JOINTS_0"), wt = prim.getAttribute("WEIGHTS_0");
    const p = [0, 0, 0], w = [0, 0, 0, 0], jj = [0, 0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, p); ji.getElement(i, jj); wt.getElement(i, w);
      let best = 0; for (let k = 1; k < 4; k++) if (w[k] > w[best]) best = k;
      verts.push({ x: p[0], y: p[1], z: p[2], dom: jname(jj[best]) });
    }
  }

for (const side of [1, -1]) {
  const sv = verts.filter((v) => v.x * side > 0.10 && v.y > 0.35 && v.y < 0.7);
  console.log(`\n=== side ${side > 0 ? "L" : "R"} (${sv.length} verts in arm slab) ===`);
  // 2D grid: x bins × z bins
  const grid = new Map();
  for (const v of sv) {
    const k = `${Math.round(v.x * side * 10) / 10}|${Math.round(v.z * 10) / 10}`;
    grid.set(k, (grid.get(k) ?? 0) + 1);
  }
  const xs = [...new Set([...grid.keys()].map((k) => +k.split("|")[0]))].sort((a, b) => a - b);
  const zs = [...new Set([...grid.keys()].map((k) => +k.split("|")[1]))].sort((a, b) => a - b);
  process.stdout.write("x\\z   ");
  for (const z of zs) process.stdout.write(String(z).padStart(6));
  console.log();
  for (const x of xs) {
    process.stdout.write(String(x).padEnd(6));
    for (const z of zs) process.stdout.write(String(grid.get(`${x}|${z}`) ?? "").padStart(6));
    console.log();
  }
  // arm tube candidates: |z| < 0.12
  const tube = sv.filter((v) => Math.abs(v.z) < 0.12);
  console.log(`tube(|z|<0.12): ${tube.length} verts`);
  const th = new Map();
  for (const v of tube) { const k = Math.round(v.x * side * 20) / 20; th.set(k, (th.get(k) ?? 0) + 1); }
  console.log("  x histogram:", [...th.entries()].sort((a, b) => a[0] - b[0]).map(([x, c]) => `${x.toFixed(2)}:${c}`).join(" "));
  // dominant joints in tube vs sheet
  const dh = (set) => { const m = new Map(); for (const v of set) m.set(v.dom, (m.get(v.dom) ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, c]) => `${n}:${c}`).join(" "); };
  console.log("  tube dom:", dh(tube));
  console.log("  sheet dom:", dh(sv.filter((v) => Math.abs(v.z) >= 0.12)));
}
