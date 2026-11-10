#!/usr/bin/env node
/**
 * Meshy rigging pipeline — rigs an existing textured humanoid GLB and lands
 * the results as static assets (same vendor-once pattern as scripts/mint):
 *
 *   POST /openapi/v1/rigging  (model_url = data URI or https URL)
 *   → rigged_character_glb_url  → public/characters/<slug>-meshy.glb
 *   → basic_animations.walking/running GLBs (baked free with rigging)
 *
 * Usage:
 *   node scripts/meshy/rig-character.mjs --file public/characters/rider.glb
 *   node scripts/meshy/rig-character.mjs --url https://…/model.glb
 *   node scripts/meshy/rig-character.mjs --resume <taskId>
 *
 * Options: --slug <id> --height <meters> --yes (required for paid work)
 *
 * Requires MESHY_API_KEY (see scripts/meshy/api-client.mjs).
 */
import { readFile } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readMeshyApiConfig,
  meshyApiRequest,
  pollMeshyTask,
  meshyDownload,
} from "./api-client.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CHARACTERS_DIR = join(root, "public", "characters");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const config = readMeshyApiConfig();
  const slug = opt("--slug") || basename(opt("--file") || "model", ".glb").replace(/\.glb$/, "");
  const height = Number(opt("--height") || 1.75);

  const resumeId = opt("--resume");
  if (resumeId) {
    const task = await pollMeshyTask("rigging", resumeId, { config });
    console.log(JSON.stringify(task, null, 2));
    return;
  }

  const file = opt("--file");
  const url = opt("--url");
  if (!file && !url) {
    console.error("Provide --file <path-to.glb> or --url <https-url>.");
    process.exit(1);
  }

  let modelUrl;
  if (file) {
    const abs = join(root, file);
    const bytes = await readFile(abs);
    if (bytes.length > 100 * 1024 * 1024) {
      throw new Error("GLB over 100MB — host it at an https URL and pass --url instead.");
    }
    modelUrl = `data:model/gltf-binary;base64,${bytes.toString("base64")}`;
    console.log(`Read ${file} (${(bytes.length / 1024).toFixed(0)} KB) → data URI`);
  } else {
    modelUrl = url;
  }

  if (!flag("--yes")) {
    console.log(`Meshy rigging — DRY RUN (no paid work started)

  Model   : ${file || url}
  Slug    : ${slug}
  Height  : ${height} m

  Steps: POST /rigging → poll → download rigged GLB + walk/run clip GLBs
         → public/characters/${slug}-meshy*.glb

  Costs 5 credits (includes baked walking + running animations).
  Re-run with --yes to start.`);
    return;
  }

  console.log(`[1/3] Rigging ${slug} (height ${height}m)…`);
  const { body: create } = await meshyApiRequest("/rigging", {
    config,
    method: "POST",
    body: { model_url: modelUrl, height_meters: height },
  });
  const taskId = create.result;
  console.log(`      task ${taskId}`);

  const task = await pollMeshyTask("rigging", taskId, { config });
  if (task.status !== "SUCCEEDED") {
    throw new Error(`Rigging ${task.status}: ${JSON.stringify(task.task_error)}`);
  }
  console.log(`      rigged ✓ (${task.consumed_credits} credits)`);

  const result = task.result || {};
  console.log("      result keys:", Object.keys(result).join(", "));

  // ─── 2-3. Download rigged GLB + baked animation GLBs ─────────────
  const downloads = [
    ["rigged_character_glb_url", `${slug}-meshy.glb`],
    ["basic_animations.walking_glb_url", `${slug}-meshy-walk.glb`],
    ["basic_animations.running_glb_url", `${slug}-meshy-run.glb`],
  ];
  for (const [field, name] of downloads) {
    const url = field.includes(".")
      ? field.split(".").reduce((o, k) => o?.[k], result)
      : result[field];
    if (!url) {
      console.log(`      ${name}: no URL in result (${field})`);
      continue;
    }
    const bytes = await meshyDownload(url, join(CHARACTERS_DIR, name));
    console.log(`      ${name} ✓ (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
  }

  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(
      join(CHARACTERS_DIR, `${slug}.meshy.json`),
      JSON.stringify(
        {
          rigTaskId: taskId,
          heightMeters: height,
          source: file || url,
          result,
          consumedCredits: task.consumed_credits,
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
    ),
  );
  console.log(`Manifest: public/characters/${slug}.meshy.json`);
}

main().catch((error) => {
  console.error(error.message);
  if (error.problem) console.error(JSON.stringify(error.problem, null, 2));
  process.exit(1);
});
