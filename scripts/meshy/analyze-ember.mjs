// Analyze the Ember Tripo mesh: vertex distribution, the y≈1.55 wing
// sheet, arm-region geometry per side. Read-only.
// Usage: node scripts/meshy/analyze-ember.mjs public/characters/rider-ember.glb
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const file = process.argv[2] ?? "public/characters/rider-ember.glb";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(file);
const skin = doc.getRoot().listSkins()[0];
const joints = skin.listJoints();

const verts = [];
for (const n of doc.getRoot().listNodes().filter((n) => n.getMesh() && n.getSkin())) {
  for (const prim of n.getMesh().listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    const ji = prim.getAttribute("JOINTS_0");
    const wt = prim.getAttribute("WEIGHTS_0");
    const p = [0, 0, 0], w = [0, 0, 0, 0], jj = [0, 0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, p); ji.getElement(i, jj); wt.getElement(i, w);
      let best = 0;
      for (let k = 1; k < 4; k++) if (w[k] > w[best]) best = k;
      verts.push({ x: p[0], y: p[1], z: p[2], dom: jj[best], domName: joints[jj[best]]?.getName() });
    }
  }
}
console.log(`verts: ${verts.length}, joints: ${joints.length}`);

// Dominant-joint histogram
const hist = new Map();
for (const v of verts) hist.set(v.domName, (hist.get(v.domName) ?? 0) + 1);
console.log("\ntop dominant joints:");
[...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)
  .forEach(([n, c]) => console.log(`  ${n.padEnd(18)} ${c}`));

// y histogram (0.1m bins)
const yh = new Map();
for (const v of verts) { const k = Math.round(v.y * 10) / 10; yh.set(k, (yh.get(k) ?? 0) + 1); }
console.log("\ny distribution:");
[...yh.entries()].sort((a, b) => a[0] - b[0])
  .forEach(([y, c]) => console.log(`  y=${y.toFixed(1)}  ${"#".repeat(Math.min(80, c / 400))} ${c}`));

// The y≈1.55 sheet
const wing = verts.filter((v) => v.y > 1.45 && v.y < 1.65);
console.log(`\nwing band y∈(1.45,1.65): ${wing.length} verts`);
if (wing.length) {
  const xs = wing.map((v) => v.x).sort((a, b) => a - b);
  const zs = wing.map((v) => v.z).sort((a, b) => a - b);
  console.log(`  x∈[${xs[0].toFixed(2)}, ${xs[xs.length - 1].toFixed(2)}] z∈[${zs[0].toFixed(2)}, ${zs[zs.length - 1].toFixed(2)}]`);
  const wh = new Map();
  for (const v of wing) wh.set(v.domName, (wh.get(v.domName) ?? 0) + 1);
  [...wh.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .forEach(([n, c]) => console.log(`  dom ${n}: ${c}`));
}

// Per-side arm region (excluding the wing band): xz scatter
for (const side of [1, -1]) {
  const sv = verts.filter((v) => v.x * side > 0.05 && v.y > 0.9 && v.y < 1.7 && !(v.y > 1.45 && v.y < 1.65));
  console.log(`\nside ${side > 0 ? "L" : "R"} candidates: ${sv.length}`);
  // coarse x bins → count + z mean
  const bins = new Map();
  for (const v of sv) {
    const k = Math.round(v.x * side * 20) / 20;
    if (!bins.has(k)) bins.set(k, { n: 0, ys: 0, zs: 0 });
    const b = bins.get(k); b.n++; b.ys += v.y; b.zs += v.z;
  }
  [...bins.entries()].sort((a, b) => a[0] - b[0]).forEach(([x, b]) =>
    console.log(`  x=${(x * side).toFixed(2)}  n=${String(b.n).padStart(5)}  ȳ=${(b.ys / b.n).toFixed(2)}  z̄=${(b.zs / b.n).toFixed(2)}`));
}
