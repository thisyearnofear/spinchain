// Second-pass scan for the recentered public ember GLB (feet y≈−0.92,
// wing sheet somewhere mid-torso). Finds arm tube + wing in mesh space.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const file = process.argv[2] ?? "public/characters/rider-ember.glb";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(file);
const skin = doc.getRoot().listSkins()[0];
const joints = skin.listJoints();

const verts = [];
for (const n of doc.getRoot().listNodes().filter((n) => n.getMesh() && n.getSkin()))
  for (const prim of n.getMesh().listPrimitives()) {
    const pos = prim.getAttribute("POSITION"), ji = prim.getAttribute("JOINTS_0"), wt = prim.getAttribute("WEIGHTS_0");
    const p = [0, 0, 0], w = [0, 0, 0, 0], jj = [0, 0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, p); ji.getElement(i, jj); wt.getElement(i, w);
      let best = 0; for (let k = 1; k < 4; k++) if (w[k] > w[best]) best = k;
      verts.push({ x: p[0], y: p[1], z: p[2], dom: joints[jj[best]]?.getName() });
    }
  }

// fine y histogram around the spike
const yh = new Map();
for (const v of verts) { const k = Math.round(v.y * 50) / 50; yh.set(k, (yh.get(k) ?? 0) + 1); }
console.log("y histogram (top bins):");
[...yh.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  .forEach(([y, c]) => console.log(`  y=${y.toFixed(2)}  ${c}`));

// What does the y≈0.5 sheet look like in x/z?
const sheet = verts.filter((v) => Math.abs(v.y - 0.51) < 0.04);
console.log(`\nsheet y≈0.51: ${sheet.length} verts`);
const xs = sheet.map((v) => v.x).sort((a, b) => a - b), zs = sheet.map((v) => v.z).sort((a, b) => a - b);
console.log(`  x∈[${xs[0].toFixed(2)},${xs[xs.length - 1].toFixed(2)}] z∈[${zs[0].toFixed(2)},${zs[zs.length - 1].toFixed(2)}]`);
const dh = new Map();
for (const v of sheet) dh.set(v.dom, (dh.get(v.dom) ?? 0) + 1);
console.log("  dom:", [...dh.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => `${n}:${c}`).join(" "));

// Per side: verts with |x|>0.15 — where are they? (arms, in this mesh)
for (const side of [1, -1]) {
  const sv = verts.filter((v) => v.x * side > 0.15);
  console.log(`\nside ${side > 0 ? "L" : "R"}: ${sv.length} verts |x|>0.15`);
  // scatter: x bins → ȳ z̄
  const bins = new Map();
  for (const v of sv) {
    const k = Math.round(v.x * side * 10) / 10;
    if (!bins.has(k)) bins.set(k, { n: 0, ys: 0, zs: 0, yMin: 9, yMax: -9, zMin: 9, zMax: -9 });
    const b = bins.get(k); b.n++; b.ys += v.y; b.zs += v.z;
    b.yMin = Math.min(b.yMin, v.y); b.yMax = Math.max(b.yMax, v.y);
    b.zMin = Math.min(b.zMin, v.z); b.zMax = Math.max(b.zMax, v.z);
  }
  [...bins.entries()].sort((a, b) => a[0] - b[0]).forEach(([x, b]) =>
    console.log(`  x=${(x * side).toFixed(2)} n=${String(b.n).padStart(5)} ȳ=${(b.ys / b.n).toFixed(2)} y∈[${b.yMin.toFixed(2)},${b.yMax.toFixed(2)}] z̄=${(b.zs / b.n).toFixed(2)} z∈[${b.zMin.toFixed(2)},${b.zMax.toFixed(2)}]`));
  // dominant joints on this side's far verts
  const far = sv.filter((v) => v.x * side > 0.4);
  const fh = new Map();
  for (const v of far) fh.set(v.dom, (fh.get(v.dom) ?? 0) + 1);
  console.log(`  far(|x|>0.4)=${far.length} dom:`, [...fh.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, c]) => `${n}:${c}`).join(" "));
}
