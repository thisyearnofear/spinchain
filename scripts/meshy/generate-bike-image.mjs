#!/usr/bin/env node
/**
 * Generate a road-bike GLB via Meshy Image-to-3D from a rendered side view of
 * the procedural bike (scripts/meshy/reference/bike-side.png, produced by
 * /test-harness/model-viewer?url=procedural-bike&view=side&bg=%23ffffff).
 *
 * Single-step task: POST /openapi/v1/image-to-3d with a base64 data URI.
 * smart-topology/meshy-t2 at ~8k faces + meshy-6-lite 2K texture ≈ 15 credits.
 *
 * Usage:
 *   node scripts/meshy/generate-bike-image.mjs           # dry run
 *   node scripts/meshy/generate-bike-image.mjs --yes     # generate + download
 *   node scripts/meshy/generate-bike-image.mjs --yes --resume
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { meshyApiRequest, pollMeshyTask, meshyDownload, readMeshyApiConfig } from "./api-client.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = join(ROOT, "public/characters");
const REF_IMAGE = join(ROOT, "scripts/meshy/reference/bike-side.png");
const MANIFEST = join(OUT_DIR, "bike.meshy.json");
const STATE_FILE = join(ROOT, "scripts/meshy/.bike-i2d-state.json");
const OUT_GLB = "bike-meshy-i2d.glb";

const args = new Set(process.argv.slice(2));
const yes = args.has("--yes");
const resume = args.has("--resume");

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const imageDataUri = `data:image/png;base64,${readFileSync(REF_IMAGE).toString("base64")}`;
  console.log(`Reference image: ${REF_IMAGE}`);
  console.log(
    `Plan: image-to-3d (smart-topology/meshy-t2, 8000 faces, meshy-6-lite 2K texture, ~15cr) → ${OUT_GLB}`,
  );
  if (!yes) {
    console.log("\nDry run — pass --yes to spend ~15 Meshy credits.");
    return;
  }

  let taskId;
  if (resume && existsSync(STATE_FILE)) {
    taskId = JSON.parse(readFileSync(STATE_FILE, "utf8")).taskId;
    console.log(`Resuming task ${taskId}`);
  } else {
    const { body } = await meshyApiRequest("/image-to-3d", {
      method: "POST",
      body: {
        image_url: imageDataUri,
        model_type: "smart-topology",
        ai_model: "meshy-t2",
        target_polycount: 8000,
        topology: "triangle",
        should_texture: true,
        texture_model: "meshy-6-lite",
        texture_resolution: "2k",
        target_formats: ["glb"],
      },
    });
    taskId = body.result;
    writeFileSync(STATE_FILE, JSON.stringify({ taskId }, null, 2));
    console.log(`Task ${taskId}`);
  }

  const task = await pollMeshyTask("image-to-3d", taskId);
  if (task.status !== "SUCCEEDED") {
    console.error(`Task ${task.status}:`, task.task_error ?? task);
    process.exit(1);
  }
  const glbUrl = task.model_urls?.glb;
  if (!glbUrl) {
    console.error("No GLB URL in result:", JSON.stringify(task.model_urls));
    process.exit(1);
  }
  console.log(`✓ downloading ${glbUrl.slice(0, 80)}…`);
  const dest = join(OUT_DIR, OUT_GLB);
  const bytes = await meshyDownload(glbUrl, dest);
  console.log(`${OUT_GLB} ✓ (${(bytes / 1e6).toFixed(2)} MB)`);

  writeFileSync(
    MANIFEST,
    JSON.stringify(
      {
        provider: "meshy",
        kind: "image-to-3d",
        referenceImage: "scripts/meshy/reference/bike-side.png",
        taskId,
        model: "meshy-t2 + meshy-6-lite",
        file: OUT_GLB,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Manifest → ${MANIFEST}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
