#!/usr/bin/env node
/**
 * Meshy clip pipeline — generates a motion from a text prompt, retargets it
 * onto an already-rigged Meshy character, downloads the skinned clip GLB,
 * and registers it on the avatar in app/lib/generated-avatars.json.
 *
 *   POST /openapi/v1/text-to-motion   (prompt → motion clip, 3cr swift / 10cr prime)
 *   POST /openapi/v1/animations       (rig_task_id + motion_task_id → skinned GLB, ~3cr)
 *
 * Usage:
 *   node scripts/meshy/generate-clip.mjs --rig <rigTaskId> --slug rider-meshy \
 *     --name pedal --prompt "…" [--duration 4] [--mode prime|swift] [--yes]
 *   node scripts/meshy/generate-clip.mjs --motion <motionTaskId> --rig <rigTaskId> \
 *     --slug rider-meshy --name pedal [--yes]   # skip text-to-motion, reuse clip
 *
 * The clip is registered as clips[] entry { name, url } — names should match
 * the ride-state vocabulary in app/lib/character-state.ts (idle, pedal,
 * recovery, celebrate, …). Existing entries with the same name are replaced.
 *
 * Requires MESHY_API_KEY (see scripts/meshy/api-client.mjs).
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

async function main() {
  const config = readMeshyApiConfig();
  const rigTaskId = opt("--rig");
  const slug = opt("--slug");
  const name = opt("--name");
  const prompt = opt("--prompt");
  const duration = Number(opt("--duration") || 4);
  const mode = opt("--mode") || "prime";
  const existingMotion = opt("--motion");

  if (!rigTaskId || !slug || !name) {
    console.error("Required: --rig <rigTaskId> --slug <assetSlug> --name <clipName>");
    process.exit(1);
  }
  if (!existingMotion && (!prompt || prompt.length > 400)) {
    console.error("Provide --prompt (≤400 chars) or --motion <taskId> to reuse a clip.");
    process.exit(1);
  }
  if (!["prime", "swift"].includes(mode)) {
    throw new Error(`--mode must be prime|swift, got "${mode}"`);
  }

  if (!flag("--yes")) {
    console.log(`Meshy clip pipeline — DRY RUN (no paid work started)

  Rig    : ${rigTaskId}
  Clip   : ${name} (${mode}, ${duration}s)
  Prompt : ${prompt || `(reuse motion ${existingMotion})`}

  Steps: text-to-motion → animations retarget → public/characters/${slug}-${name}.glb
         → register clips[] entry "${name}" on avatar slug "${slug}".

  Costs ~${mode === "prime" ? 13 : 6} credits. Re-run with --yes.`);
    return;
  }

  // ─── 1. Motion clip (skip with --motion to reuse) ────────────────
  let motionTaskId = existingMotion;
  if (!motionTaskId) {
    console.log(`[1/4] Text-to-motion (${mode}, ${duration}s)…`);
    const { body: create } = await meshyApiRequest("/text-to-motion", {
      config,
      method: "POST",
      body: { prompt, mode, duration },
    });
    motionTaskId = create.result;
    console.log(`      motion task ${motionTaskId}`);
    const motion = await pollMeshyTask("text-to-motion", motionTaskId, { config });
    if (motion.status !== "SUCCEEDED") {
      throw new Error(`Text-to-motion ${motion.status}: ${JSON.stringify(motion.task_error)}`);
    }
    console.log(`      motion ✓ (${motion.consumed_credits} credits, ${motion.result?.motion_format})`);
  } else {
    console.log(`[1/4] Reusing motion task ${motionTaskId}`);
  }

  // ─── 2. Retarget onto the rigged character ───────────────────────
  console.log("[2/4] Retargeting onto rig…");
  const { body: animCreate } = await meshyApiRequest("/animations", {
    config,
    method: "POST",
    body: { rig_task_id: rigTaskId, motion_task_id: motionTaskId },
  });
  const animTaskId = animCreate.result;
  console.log(`      animation task ${animTaskId}`);
  const anim = await pollMeshyTask("animations", animTaskId, { config });
  if (anim.status !== "SUCCEEDED") {
    throw new Error(`Animation ${anim.status}: ${JSON.stringify(anim.task_error)}`);
  }
  console.log(`      retargeted ✓ (${anim.consumed_credits} credits)`);

  // ─── 3. Download clip GLB ────────────────────────────────────────
  const glbUrl = anim.result?.animation_glb_url;
  if (!glbUrl) throw new Error("Animation result has no animation_glb_url.");
  const fileName = `${slug}-${name}.glb`;
  const bytes = await meshyDownload(glbUrl, join(CHARACTERS_DIR, fileName));
  console.log(`[3/4] ${fileName} ✓ (${(bytes / 1024 / 1024).toFixed(2)} MB)`);

  // ─── 4. Register clip on the avatar ───────────────────────────────
  const registry = JSON.parse(await readFile(AVATAR_REGISTRY, "utf8"));
  // Avatar id is derived from slug: "rider-meshy" assets belong to the
  // avatar whose modelUrl basename matches the slug prefix before "-meshy".
  // Simpler: --avatar <id> overrides; default searches modelUrl match.
  const avatarId = opt("--avatar");
  const avatar = avatarId
    ? registry.avatars.find((a) => a.id === avatarId)
    : registry.avatars.find((a) => a.modelUrl?.includes(`/${slug.replace(/-meshy$/, "")}`));
  if (!avatar) {
    console.log(`[4/4] No avatar matched slug "${slug}" — clip saved but not registered.
      Re-run registration later or pass --avatar <id>.`);
    return;
  }
  avatar.clips = avatar.clips || [];
  avatar.clips = avatar.clips.filter((c) => c.name !== name);
  avatar.clips.push({ name, url: `/characters/${fileName}` });
  await writeFile(AVATAR_REGISTRY, JSON.stringify(registry, null, 2) + "\n");
  console.log(`[4/4] Registered clip "${name}" on avatar "${avatar.id}" (${avatar.name}) ✓`);
}

main().catch((error) => {
  console.error(error.message);
  if (error.problem) console.error(JSON.stringify(error.problem, null, 2));
  process.exit(1);
});
