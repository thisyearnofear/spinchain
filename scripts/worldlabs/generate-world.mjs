#!/usr/bin/env node
/**
 * World Labs (Marble) world pipeline — generates a themed 3D environment and
 * lands it as static assets the app ships locally:
 *
 *   1. POST /marble/v1/worlds:generate   (text prompt)
 *   2. Download the panorama             → public/worlds/<slug>/pano.jpg
 *   3. POST /worlds/{id}:export          (HQ textured mesh, GLB)
 *   4. Download the mesh                 → public/worlds/<slug>/world.glb
 *   5. Register the world                → app/lib/generated-worlds.json
 *
 * The pano is the mobile-safe tier (one equirect texture, rendered as the
 * scene skybox). The GLB mesh is the high-tier option. Gaussian splats
 * (spz_urls, 100k/500k/full_res) are available in the manifest for a future
 * splat renderer — don't ship splats to the iOS shell without benchmarking.
 *
 * Usage:
 *   node scripts/worldlabs/generate-world.mjs                  Dry run. Prints the plan.
 *   node scripts/worldlabs/generate-world.mjs --yes            Runs the PAID generation.
 *   node scripts/worldlabs/generate-world.mjs --resume <opId>  Resume polling an operation.
 *
 * Options: --slug <id> --prompt <text> --theme <neon|alpine|mars|anime|rainbow>
 *          --plus (use marble-1.1-plus for large outdoor worlds)
 *
 * Requires WLT_API_KEY in the environment (create at
 * https://platform.worldlabs.ai → API keys; generation consumes Marble
 * credits). The key is never printed or committed.
 */
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const REGISTRY = join(root, "app", "lib", "generated-worlds.json");

const DEFAULT_PROMPT =
  "A neon-lit coastal highway at dusk curving through cliffs, synthwave sky, " +
  "glowing road markings, light haze over the ocean";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

function readConfig(env = process.env) {
  const apiKey = env.WLT_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "WLT_API_KEY is not set. Create a key at https://platform.worldlabs.ai " +
        "(API keys page; requires Marble credits) and set it in the server " +
        "environment. Never paste the key into chat or commit it.",
    );
  }
  return { apiKey, baseUrl: "https://api.worldlabs.ai/marble/v1" };
}

async function wltRequest(pathname, { method = "GET", body, config }) {
  const response = await fetch(`${config.baseUrl}${pathname}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "WLT-Api-Key": config.apiKey,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { detail: text.slice(0, 500) };
    }
  }
  if (!response.ok) {
    const error = new Error(`World Labs API ${response.status}: ${parsed?.detail || parsed?.error || response.statusText}`);
    error.status = response.status;
    error.problem = parsed;
    throw error;
  }
  return parsed;
}

/** Poll an operation: 2s start, ×1.6 backoff, 15s cap, 30 min deadline. */
async function pollOperation(operationId, config) {
  let delayMs = 2_000;
  const startedAt = Date.now();
  while (true) {
    const operation = await wltRequest(`/operations/${operationId}`, { config });
    if (operation.done) {
      if (operation.error) {
        throw new Error(`Operation failed: ${JSON.stringify(operation.error)}`);
      }
      return operation;
    }
    if (Date.now() - startedAt >= 30 * 60 * 1_000) {
      throw new Error(`Timed out waiting for operation ${operationId}.`);
    }
    const status = operation.metadata?.progress?.description || "in progress";
    console.log(`      … ${status}`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(15_000, Math.ceil(delayMs * 1.6));
  }
}

async function download(url, destPath) {
  await mkdir(dirname(destPath), { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url.slice(0, 80)}…`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destPath, buffer);
  return buffer.length;
}

async function main() {
  const slug = opt("--slug", "neon-coast");
  const prompt = opt("--prompt", DEFAULT_PROMPT);
  const theme = opt("--theme", "neon");
  const model = flag("--plus") ? "marble-1.1-plus" : "marble-1.1";
  const worldDir = join(root, "public", "worlds", slug);
  const config = readConfig();

  const resumeId = opt("--resume");
  if (resumeId) {
    console.log(JSON.stringify(await pollOperation(resumeId, config), null, 2));
    return;
  }

  if (!flag("--yes")) {
    console.log(`World Labs pipeline — DRY RUN (no paid work started)

  Slug   : ${slug}
  Theme  : ${theme}
  Model  : ${model}
  Prompt : ${prompt}

  Steps: generate world (~5 min) → download pano → export HQ mesh (GLB)
       → download mesh → register world.

  Outputs:
    public/worlds/${slug}/pano.jpg
    public/worlds/${slug}/world.glb
    app/lib/generated-worlds.json

  This consumes Marble credits. Re-run with --yes to start paid work.`);
    return;
  }

  // ─── 1. Generate ─────────────────────────────────────────────────
  console.log(`[1/5] Generating world "${slug}" (${model})…`);
  const operation = await wltRequest("/worlds:generate", {
    config,
    method: "POST",
    body: {
      display_name: slug,
      model,
      world_prompt: { type: "text", text_prompt: prompt },
    },
  });
  const operationId = operation.operation_id;
  console.log(`      operation ${operationId}`);
  const done = await pollOperation(operationId, config);
  const worldId = done.response?.id || done.metadata?.world_id;
  if (!worldId) throw new Error("Operation finished without a world id.");

  // Fetch the complete world for asset URLs.
  const { world } = await wltRequest(`/worlds/${worldId}`, { config });
  const assets = world.assets || {};
  console.log(`[2/5] World ${worldId} ✓ (${world.world_marble_url})`);

  // ─── 2. Pano (mobile-safe tier) ──────────────────────────────────
  if (!assets.imagery?.pano_url) throw new Error("World has no panorama URL.");
  const panoBytes = await download(assets.imagery.pano_url, join(worldDir, "pano.jpg"));
  console.log(`[3/5] pano.jpg ✓ (${(panoBytes / 1024 / 1024).toFixed(2)} MB)`);

  // ─── 3-4. HQ mesh export (high tier) ─────────────────────────────
  let meshUrl = assets.mesh?.hq_mesh_url || null;
  if (!meshUrl) {
    console.log("[4/5] Starting HQ mesh export (GLB)…");
    const exportOp = await wltRequest(`/worlds/${worldId}:export`, {
      config,
      method: "POST",
      body: { asset_type: "mesh", format: "glb" },
    });
    if (exportOp?.operation_id) {
      await pollOperation(exportOp.operation_id, config);
      const refreshed = await wltRequest(`/worlds/${worldId}`, { config });
      meshUrl = refreshed.world?.assets?.mesh?.hq_mesh_url || null;
    }
  }
  let meshFile = null;
  if (meshUrl) {
    const meshBytes = await download(meshUrl, join(worldDir, "world.glb"));
    meshFile = "world.glb";
    console.log(`      world.glb ✓ (${(meshBytes / 1024 / 1024).toFixed(2)} MB)`);
  } else {
    console.log("      mesh export unavailable — pano tier only.");
  }

  // ─── 5. Register ─────────────────────────────────────────────────
  const registry = JSON.parse(await readFile(REGISTRY, "utf8"));
  const entry = {
    id: `marble-${slug}`,
    name: slug.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" "),
    theme,
    panoUrl: `/worlds/${slug}/pano.jpg`,
    ...(meshFile ? { meshUrl: `/worlds/${slug}/world.glb` } : {}),
    fogColor: "#0b1020",
    ambientColor: "#8b9dff",
    description: prompt.slice(0, 120),
    generated: true,
  };
  registry.worlds = [...registry.worlds.filter((w) => w.id !== entry.id), entry];
  await writeFile(REGISTRY, JSON.stringify(registry, null, 2) + "\n");
  await writeFile(
    join(worldDir, "world.worldlabs.json"),
    JSON.stringify(
      {
        worldId,
        marbleUrl: world.world_marble_url,
        model,
        prompt,
        splats: assets.splats?.spz_urls ?? null,
        semantics: assets.splats?.semantics_metadata ?? null,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`[5/5] Registered world "${entry.name}" (${entry.id}) ✓

Done. Ride with ?worldId=${entry.id} to use the pano skybox.
Splat URLs (100k/500k/full_res) are recorded in public/worlds/${slug}/world.worldlabs.json
for a future splat renderer — benchmark before shipping to the iOS shell.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
