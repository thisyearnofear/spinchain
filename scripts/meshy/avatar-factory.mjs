#!/usr/bin/env node
/**
 * Avatar factory — repeatable rider production line:
 *
 *   1. image-to-3d     : source still → textured T-pose humanoid GLB
 *                        (smart-topology meshy-t2.5 + meshy-n1 texture, ~15cr)
 *   2. geometry gate   : FREE local check — arm tubes present & contiguous
 *                        (catches the Tripo "flat fan" failure before the
 *                        paid rig step — see assets/fuser/STATUS.md)
 *   3. rigging         : Mixamo-named skeleton the IK pass expects (~5cr)
 *   4. register        : generated-avatars.json, experimental until the
 *                        rig-studio visual pass confirms it
 *
 * Usage:
 *   node scripts/meshy/avatar-factory.mjs --image <file.png|url> --slug <fileSlug> \
 *     --name "Display Name" [--avatar-id <id>] [--height 1.75] [--polycount 30000] \
 *     [--thumbnail /characters/x.webp] [--resume <i2dTaskId>] [--skip-rig] [--yes]
 *
 * Ember's re-run:  --image assets/fuser/rider-ember-ref.png --slug ember-mk2 \
 *                  --avatar-id ember --name Ember
 * (updates the existing `ember` registry entry in place)
 *
 * Requires MESHY_API_KEY (see scripts/meshy/api-client.mjs).
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  readMeshyApiConfig,
  meshyApiRequest,
  pollMeshyTask,
  meshyDownload,
} from "./api-client.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CHARACTERS_DIR = join(root, "public", "characters");
const AVATAR_REGISTRY = join(root, "app", "lib", "generated-avatars.json");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

async function imageDataUri(file) {
  const abs = join(root, file);
  const mime = MIME[extname(abs).toLowerCase()];
  if (!mime) throw new Error(`Unsupported image type: ${abs}`);
  const bytes = await readFile(abs);
  if (bytes.length > 20 * 1024 * 1024) throw new Error("Image over 20MB — pass a public URL instead.");
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

/** Vertex-level humanoid sanity check. Returns { ok, report[] } — the gate
 *  that would have rejected Tripo's flat-fan "arms" before rigging. */
async function gateHumanoid(glbPath) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(glbPath);
  const positions = [];
  for (const node of doc.getRoot().listNodes().filter((n) => n.getMesh())) {
    for (const prim of node.getMesh().listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      const p = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, p);
        positions.push([p[0], p[1], p[2]]);
      }
    }
  }
  const report = [];
  if (positions.length < 500) {
    return { ok: false, report: [`only ${positions.length} verts — degenerate mesh`] };
  }
  const [xmin, xmax] = [Math.min(...positions.map((p) => p[0])), Math.max(...positions.map((p) => p[0]))];
  const [ymin, ymax] = [Math.min(...positions.map((p) => p[1])), Math.max(...positions.map((p) => p[1]))];
  const H = ymax - ymin;
  const HW = Math.max(Math.abs(xmin), Math.abs(xmax));
  report.push(`${positions.length} verts, height ${H.toFixed(3)}, half-span ${HW.toFixed(3)}`);
  if (H <= 0 || HW <= 0) return { ok: false, report: [...report, "degenerate bounds"] };
  // T-pose sanity: arm span should be a large fraction of height.
  if ((2 * HW) / H < 0.6) {
    report.push(`arm span ${(2 * HW).toFixed(2)} is only ${(((2 * HW) / H) * 100).toFixed(0)}% of height — not a T/A-pose humanoid`);
  }

  let ok = true;
  for (const side of [1, -1]) {
    const label = side > 0 ? "L(+x)" : "R(-x)";
    // Arm region: verts beyond 15% of half-span at any height. In a T-pose
    // those are all arm; in A-pose they still clear the hips.
    const arm = positions.filter(([x]) => x * side > 0.15 * HW);
    if (arm.length < 50) {
      ok = false;
      report.push(`${label}: only ${arm.length} verts beyond shoulder — arm missing`);
      continue;
    }
    const armMax = Math.max(...arm.map(([x]) => x * side));
    // Slice the arm along x; every slice between shoulder and 90% out must
    // have verts (Tripo left a literal gap x≈0.10→0.60), and each slice's
    // thinner cross-section axis must exceed 1% of height (a flat fan is
    // one vertex thick → fails).
    const SLICES = 12, gaps = [], thin = [];
    for (let s = 0; s < SLICES; s++) {
      const lo = 0.15 * HW + ((armMax - 0.15 * HW) * s) / SLICES;
      const hi = lo + (armMax - 0.15 * HW) / SLICES;
      const slice = arm.filter(([x]) => x * side >= lo && x * side < hi);
      if (s < SLICES * 0.9 && slice.length === 0) gaps.push(lo.toFixed(2));
      if (slice.length > 2) {
        const ys = slice.map((p) => p[1]), zs = slice.map((p) => p[2]);
        const thinAxis = Math.min(
          Math.max(...ys) - Math.min(...ys),
          Math.max(...zs) - Math.min(...zs),
        );
        if (s < SLICES * 0.7 && thinAxis < 0.01 * H) thin.push(`${lo.toFixed(2)}:${thinAxis.toFixed(4)}`);
      }
    }
    if (gaps.length) {
      ok = false;
      report.push(`${label}: vertex gap(s) at |x|≈${gaps.join(", ")} — arm not continuous`);
    }
    if (thin.length) {
      ok = false;
      report.push(`${label}: flat cross-section at |x|≈${thin.join(", ")} — fan/sheet, not a tube`);
    }
    if (!gaps.length && !thin.length) report.push(`${label}: arm ok (${arm.length} verts, span ${armMax.toFixed(2)})`);
  }
  // Legs: verts on each side below 55% of height.
  for (const side of [1, -1]) {
    const legs = positions.filter(([x, y]) => x * side > 0.005 * HW && y < ymin + 0.55 * H);
    if (legs.length < 100) {
      ok = false;
      report.push(`${side > 0 ? "L" : "R"}: only ${legs.length} leg verts`);
    }
  }
  return { ok, report };
}

async function main() {
  const image = opt("--image");
  const slug = opt("--slug");
  const name = opt("--name") || slug;
  const avatarId = opt("--avatar-id") || slug;
  const height = Number(opt("--height") || 1.75);
  const polycount = Number(opt("--polycount") || 30000);
  const resumeId = opt("--resume");
  const skipRig = flag("--skip-rig");

  if (!slug || (!image && !resumeId)) {
    console.error("Required: --slug <fileSlug> and --image <file|url> (or --resume <i2dTaskId>)");
    process.exit(1);
  }

  const baseGlb = join(CHARACTERS_DIR, `${slug}.glb`);
  const riggedGlb = join(CHARACTERS_DIR, `${slug}-meshy.glb`);

  if (!flag("--yes")) {
    console.log(`Avatar factory — DRY RUN (no paid work)

  Image   : ${image || "(resume)"}   Slug: ${slug}   Name: ${name}   Id: ${avatarId}
  Poly    : ${polycount} tris        Rig height: ${height} m

  Steps & cost:
    1. image-to-3d   smart-topology/meshy-t2.5, t-pose, texture meshy-n1  ~15cr
    2. geometry gate local arm-tube verification                          free
    3. rigging       Mixamo skeleton + baked walk/run                      ~5cr
    4. register      generated-avatars.json (experimental until visual pass)

  Output:  public/characters/${slug}.glb + ${slug}-meshy{,-walk,-run}.glb
  Resume:  --resume <i2dTaskId> (skips step 1)
  Total ≈ 20 credits. Re-run with --yes to start.`);
    return;
  }

  const config = readMeshyApiConfig();

  // ─── 1. Image → 3D ──────────────────────────────────────────────
  let i2dTask;
  if (resumeId) {
    i2dTask = await pollMeshyTask("image-to-3d", resumeId, { config });
  } else {
    const imageUrl = image.startsWith("http") ? image : await imageDataUri(image);
    console.log(`[1/4] image-to-3d (t2.5 smart-topology, t-pose, ${polycount} tris)…`);
    const { body: created } = await meshyApiRequest("/image-to-3d", {
      config,
      method: "POST",
      body: {
        image_url: imageUrl,
        model_type: "smart-topology",
        ai_model: "meshy-t2.5",
        topology: "triangle",
        target_polycount: polycount,
        should_texture: true,
        texture_model: "meshy-n1",
        pose_mode: "t-pose",
        target_formats: ["glb"],
      },
    });
    console.log(`      task ${created.result} (resume with --resume ${created.result})`);
    i2dTask = await pollMeshyTask("image-to-3d", created.result, { config });
  }
  if (i2dTask.status !== "SUCCEEDED") {
    throw new Error(`image-to-3d ${i2dTask.status}: ${JSON.stringify(i2dTask.task_error)}`);
  }
  // i2d tasks expose model_urls at the task top level (rigging uses result.*)
  const glbUrl = i2dTask.model_urls?.glb ?? i2dTask.result?.model_urls?.glb;
  if (!glbUrl) {
    throw new Error(`No GLB in i2d task payload: ${JSON.stringify(i2dTask).slice(0, 400)}`);
  }
  const bytes = await meshyDownload(glbUrl, baseGlb);
  console.log(`      generated ✓ ${(bytes / 1024).toFixed(0)} KB → public/characters/${slug}.glb (${i2dTask.consumed_credits ?? "?"}cr)`);

  // ─── 2. Geometry gate (free) ────────────────────────────────────
  console.log("[2/4] geometry gate — arm tubes contiguous + volumetric…");
  const gate = await gateHumanoid(baseGlb);
  for (const line of gate.report) console.log(`      ${line}`);
  if (!gate.ok) {
    console.error(`\nGate FAILED — mesh is malformed. Not rigging, not registering.
Fix the source image or generator and re-run. Raw mesh kept at ${baseGlb}.`);
    process.exit(2);
  }
  console.log("      gate PASS ✓");

  if (skipRig) {
    console.log("      --skip-rig: stopping after generation.");
    return;
  }

  // ─── 3. Rigging ─────────────────────────────────────────────────
  console.log(`[3/4] rigging (Mixamo skeleton, ${height} m)…`);
  const glbBytes = await readFile(baseGlb);
  const modelUri = `data:model/gltf-binary;base64,${glbBytes.toString("base64")}`;
  const { body: rigCreated } = await meshyApiRequest("/rigging", {
    config,
    method: "POST",
    body: { model_url: modelUri, height_meters: height },
  });
  console.log(`      task ${rigCreated.result}`);
  const rigTask = await pollMeshyTask("rigging", rigCreated.result, { config });
  if (rigTask.status !== "SUCCEEDED") {
    throw new Error(`Rigging ${rigTask.status}: ${JSON.stringify(rigTask.task_error)}`);
  }
  const rr = rigTask.result || {};
  for (const [field, file] of [
    ["rigged_character_glb_url", `${slug}-meshy.glb`],
    ["basic_animations.walking_glb_url", `${slug}-meshy-walk.glb`],
    ["basic_animations.running_glb_url", `${slug}-meshy-run.glb`],
  ]) {
    const url = field.split(".").reduce((o, k) => o?.[k], rr);
    if (!url) continue;
    await meshyDownload(url, join(CHARACTERS_DIR, file));
    console.log(`      ${file} ✓`);
  }
  if (!existsSync(riggedGlb)) throw new Error("rigged GLB missing from task result");

  // ─── 4. Register (experimental until the visual pass) ───────────
  console.log("[4/4] registering…");
  const registry = JSON.parse(await readFile(AVATAR_REGISTRY, "utf8"));
  const entry = {
    id: avatarId,
    name,
    type: "humanoid",
    modelUrl: `/characters/${slug}-meshy.glb`,
    thumbnail: opt("--thumbnail"),
    description:
      "Avatar-factory rider: Meshy image-to-3D (t2.5 smart topology, t-pose) + " +
      "Meshy rigging. EXPERIMENTAL: pending rig-studio visual pass " +
      "(side/front/bars/head/pedal).",
    generated: true,
    experimental: true,
  };
  if (!entry.thumbnail) delete entry.thumbnail;
  const idx = registry.avatars.findIndex((a) => a.id === avatarId);
  if (idx >= 0) {
    registry.avatars[idx] = { ...registry.avatars[idx], ...entry };
    console.log(`      updated existing '${avatarId}'`);
  } else {
    registry.avatars.push(entry);
    console.log(`      added '${avatarId}'`);
  }
  await writeFile(AVATAR_REGISTRY, JSON.stringify(registry, null, 2) + "\n");

  console.log(`
Done — '${avatarId}' registered as EXPERIMENTAL.
Verify before unflagging:
  node scripts/meshy/measure-rig.mjs public/characters/${slug}-meshy.glb ${height}
  /test-harness/rig-studio?avatar=${avatarId}&view=side|front|bars|head|pedal&markers=1&debug=1
Optional pedal clip (state-driven animation):
  node scripts/meshy/generate-clip.mjs --rig ${rigCreated.result} --slug ${slug} \\
    --name pedal --prompt "person pedaling a stationary bicycle, seated" --yes`);
}

export { gateHumanoid };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
