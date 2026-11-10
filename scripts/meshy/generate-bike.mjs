#!/usr/bin/env node
/**
 * Generate a road-bike GLB via Meshy's Text-to-3D v2 pipeline and vendor it
 * into public/characters/.
 *
 * Two-step workflow (https://docs.meshy.ai/en/api/text-to-3d):
 *   1. preview — smart-topology mesh only (meshy-t2, ~6k faces, natively
 *      separated parts so wheels/cranks can be identified later)
 *   2. refine  — texture the preview (meshy-6-lite, 2K base color)
 *
 * Cost: ~5 credits preview + ~10 credits refine = ~15 credits.
 *
 * Usage:
 *   node scripts/meshy/generate-bike.mjs            # dry run — prints plan
 *   node scripts/meshy/generate-bike.mjs --yes      # generate + download
 *   node scripts/meshy/generate-bike.mjs --yes --resume   # reuse preview task
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { meshyApiRequest, pollMeshyTask, meshyDownload, readMeshyApiConfig } from "./api-client.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = join(ROOT, "public/characters");
const MANIFEST = join(OUT_DIR, "bike.meshy.json");
const STATE_FILE = join(ROOT, "scripts/meshy/.bike-t2d-state.json");

const PROMPT =
  "a sleek road bicycle, side profile, drop handlebars, thin racing frame, " +
  "two spoked wheels, no rider, no stand";
const TEXTURE_PROMPT =
  "matte black carbon frame, dark grey rims, black tires, subtle red accent on " +
  "the frame logo, studio product photography look, no text";

const args = new Set(process.argv.slice(2));
const yes = args.has("--yes");
const resume = args.has("--resume");

async function createTask(body) {
  const config = { ...readMeshyApiConfig(), baseUrl: "https://api.meshy.ai/openapi" };
  const { body: result } = await meshyApiRequest("/v2/text-to-3d", {
    method: "POST",
    body,
    config,
  });
  return result.result;
}

async function pollV2(taskId) {
  const config = { ...readMeshyApiConfig(), baseUrl: "https://api.meshy.ai/openapi" };
  // pollMeshyTask builds /<taskType>/<id>; v2 task route is /v2/text-to-3d/<id>
  return pollMeshyTask("v2/text-to-3d", taskId, { config });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Prompt: ${PROMPT}`);
  console.log(`Plan: preview (smart-topology/meshy-t2, 6000 faces, ~5cr) → refine (meshy-6-lite 2K, ~10cr)`);
  if (!yes) {
    console.log("\nDry run — pass --yes to spend ~15 Meshy credits.");
    return;
  }

  // 1. Preview (geometry only)
  let previewId;
  if (resume && existsSync(STATE_FILE)) {
    previewId = JSON.parse(readFileSync(STATE_FILE, "utf8")).previewTaskId;
    console.log(`Resuming preview task ${previewId}`);
  } else {
    previewId = await createTask({
      mode: "preview",
      prompt: PROMPT,
      model_type: "smart-topology",
      ai_model: "meshy-t2",
      target_polycount: 6000,
      topology: "triangle",
      target_formats: ["glb"],
    });
    writeFileSync(STATE_FILE, JSON.stringify({ previewTaskId: previewId }, null, 2));
    console.log(`Preview task ${previewId}`);
  }

  let preview = await pollV2(previewId);
  if (preview.status !== "SUCCEEDED") {
    console.error(`Preview ${preview.status}:`, preview.task_error ?? preview);
    process.exit(1);
  }
  const previewGlb = preview.model_urls?.glb;
  console.log(`Preview ✓ (${preview.progress ?? 100}%)`);

  // 2. Refine (texture)
  let refineId;
  if (resume && existsSync(STATE_FILE)) {
    refineId = JSON.parse(readFileSync(STATE_FILE, "utf8")).refineTaskId;
  }
  if (!refineId) {
    refineId = await createTask({
      mode: "refine",
      preview_task_id: previewId,
      ai_model: "meshy-6-lite",
      texture_prompt: TEXTURE_PROMPT,
      texture_resolution: "2k",
      enable_pbr: false,
      target_formats: ["glb"],
    });
    writeFileSync(
      STATE_FILE,
      JSON.stringify({ previewTaskId: previewId, refineTaskId: refineId }, null, 2),
    );
    console.log(`Refine task ${refineId}`);
  }

  const refined = await pollV2(refineId);
  if (refined.status !== "SUCCEEDED") {
    console.error(`Refine ${refined.status}:`, refined.task_error ?? refined);
    process.exit(1);
  }
  const glbUrl = refined.model_urls?.glb ?? previewGlb;
  console.log(`Refine ✓ — downloading ${glbUrl.slice(0, 80)}…`);

  const dest = join(OUT_DIR, "bike-meshy.glb");
  const bytes = await meshyDownload(glbUrl, dest);
  console.log(`bike-meshy.glb ✓ (${(bytes / 1e6).toFixed(2)} MB)`);

  writeFileSync(
    MANIFEST,
    JSON.stringify(
      {
        provider: "meshy",
        kind: "text-to-3d",
        prompt: PROMPT,
        texturePrompt: TEXTURE_PROMPT,
        previewTaskId: previewId,
        refineTaskId: refineId,
        model: "meshy-t2 + meshy-6-lite",
        file: "bike-meshy.glb",
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Manifest → ${MANIFEST}`);
  console.log("Next: run `node scripts/optimize-characters.mjs` to compress, then wire into route-visualizer.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
