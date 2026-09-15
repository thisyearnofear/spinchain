#!/usr/bin/env node
/**
 * Mint rider pipeline — generates a rigged, animated 3D rider character and
 * lands it as static assets the app ships locally (offline-friendly, no
 * runtime API cost):
 *
 *   1. POST /v1/models:generate        (riggingPose: t_pose)
 *   2. POST /v1/models/{id}:optimize   (moderate) → optimized GLB for mobile
 *   3. Download optimized GLB          → public/characters/rider.glb
 *   4. POST /v1/models/{id}:animate    (cycling motion prompt)
 *   5. Download animation GLB          → public/characters/rider-animated.glb
 *   6. Register the avatar             → app/lib/generated-avatars.json
 *
 * Usage:
 *   node scripts/mint/generate-rider.mjs --usage          Free. Show account + Credits.
 *   node scripts/mint/generate-rider.mjs                  Dry run. Prints the plan, starts nothing.
 *   node scripts/mint/generate-rider.mjs --yes            Runs the PAID pipeline (consumes Credits).
 *   node scripts/mint/generate-rider.mjs --resume <opId>  Resume polling an in-flight operation.
 *   node scripts/mint/generate-rider.mjs --animation <id> Free. Download + register an already-
 *                                                         completed animation resource (no new paid work).
 *   node scripts/mint/generate-rider.mjs --yes --skip-animation
 *                                                         Paid. Static avatar only (no clips) —
 *                                                         the archetype/progression flow.
 *
 * Identity flags (defaults generate the original "Nova" rider):
 *   --id <avatarId>     Registry id            (default "mint-rider")
 *   --name <label>      Display name           (default "Nova")
 *   --slug <fileSlug>   Asset filename prefix  (default "rider")
 *
 * Requires MINT_API_KEY in the environment (create at https://platform.mint.gg
 * → Developer settings). The key is never printed or committed.
 */
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readMintApiConfig,
  mintApiRequest,
  pollMintOperation,
  mintDownload,
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

/** Avatar identity — defaults produce the original "Nova" rider. */
const identity = {
  id: opt("--id") || "mint-rider",
  name: opt("--name") || "Nova",
  slug: opt("--slug") || "rider",
  type: opt("--type") || "humanoid",
};
if (!["humanoid", "creature", "robot"].includes(identity.type)) {
  throw new Error(`--type must be humanoid|creature|robot, got "${identity.type}"`);
}
const manifestPath = () => join(CHARACTERS_DIR, `${identity.slug}.mint.json`);

const DEFAULT_PROMPT =
  "Athletic cyclist character in a sleek amber and slate cycling kit with a " +
  "modern aero helmet, stylized but believable proportions, full body";

const DEFAULT_MOTION =
  "Seated road cycling pedaling motion, steady endurance cadence, hands on " +
  "drop handlebars, slight upper body bob";

function printPlan(config) {
  console.log(`Mint rider pipeline — DRY RUN (no paid work started)

  Endpoint : ${config.baseUrl}
  Avatar   : ${identity.name} (${identity.id}), asset slug "${identity.slug}"
  Prompt   : ${opt("--prompt") || DEFAULT_PROMPT}
  Preset   : ${opt("--preset") || "standard"}  (fast | standard | production)
  Motion   : ${opt("--motion") || DEFAULT_MOTION}

  Steps: generate (t_pose) → optimize (moderate) → download GLB
       → animate (cycling) → download animation GLB → register avatar.

  Outputs:
    public/characters/${identity.slug}.glb
    public/characters/${identity.slug}-animated.glb (unless --skip-animation)
    public/characters/${identity.slug}.webp (preview thumbnail)
    app/lib/generated-avatars.json

  This consumes Mint Credits. Re-run with --yes to start paid work,
  or --usage to check your balance first (free).`);
}

async function pollOrSurfaceBilling(operationId, config) {
  const operation = await pollMintOperation(operationId, { config });
  if (operation.status === "billing_required") {
    const action = operation.billing?.actionUrl || "https://platform.mint.gg/billing";
    console.error(`billing_required: resolve at ${action}
Then resume with: node scripts/mint/generate-rider.mjs --resume ${operationId}`);
    process.exit(2);
  }
  if (operation.status === "failed" || operation.status === "canceled") {
    console.error(`Operation ${operation.status}:`, JSON.stringify(operation.error || operation, null, 2));
    process.exit(1);
  }
  return operation;
}

/**
 * Locate a downloadable animation GLB. Operations report the resource type
 * generically ("animation"), but the artifacts API wants the concrete
 * batch/clip type — try both, falling through on 404 and on the API's
 * "targetType" 400. Uses the /artifacts list + per-artifact download-URL
 * routes (the /artifact-manifest route is gated off for animation targets).
 */
async function fetchAnimationGlb(config, resourceId) {
  const candidateTypes = ["model_animation_clip", "model_animation_batch"];
  let lastError = null;
  for (const type of candidateTypes) {
    // Up to 3 attempts per type: Mint can briefly 503 a resource that is
    // still settling after its operation reports success.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { body } = await mintApiRequest(
          `/animations/${type}/${resourceId}/artifacts`,
          { config },
        );
        const artifacts = body.data || body.artifacts || [];
        const glb =
          artifacts.find((a) => a.kind === "animation_clip" && a.format === "glb") ||
          artifacts.find((a) => a.format === "glb" || (a.filename || "").endsWith(".glb"));
        if (!glb) break;
        const { body: record } = await mintApiRequest(
          `/animations/${type}/${resourceId}/artifacts/${encodeURIComponent(glb.id)}`,
          { config },
        );
        const url = record.downloadUrl || record.url;
        if (url) return { url, type, artifact: glb };
        break;
      } catch (error) {
        const wrongType = error.status === 400 && /targetType/i.test(error.message);
        if (error.status === 403 && /downloads are disabled/i.test(error.message)) {
          throw new Error(
            `${error.message}\nEnable downloads for the source model in Mint ` +
              `(open the model at https://mint.gg → settings/downloads), then re-run: ` +
              `node scripts/mint/generate-rider.mjs --animation ${resourceId}`,
          );
        }
        if (wrongType || error.status === 404) {
          lastError = error;
          break; // wrong resource type — try the next candidate
        }
        if (error.status === 503 && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 3_000));
          continue;
        }
        if (error.status === 503) {
          lastError = error;
          break; // exhausted retries for this type — try the next candidate
        }
        throw error;
      }
    }
  }
  throw lastError || new Error("No downloadable animation GLB found.");
}

/** Steps 5–6: download the animation GLB and register the avatar. */
async function downloadAndRegisterAnimation(config, resourceId, meta) {
  const { url: animUrl, type } = await fetchAnimationGlb(config, resourceId);
  const animBytes = await mintDownload(animUrl, join(CHARACTERS_DIR, `${identity.slug}-animated.glb`));
  console.log(`[5/6] ${identity.slug}-animated.glb ✓ (${(animBytes / 1024 / 1024).toFixed(2)} MB, ${type}/${resourceId})`);

  const registry = JSON.parse(await readFile(AVATAR_REGISTRY, "utf8"));
  const entry = avatarEntry({ animated: true });
  registry.avatars = [...registry.avatars.filter((a) => a.id !== entry.id), entry];
  await writeFile(AVATAR_REGISTRY, JSON.stringify(registry, null, 2) + "\n");
  await writeFile(
    manifestPath(),
    JSON.stringify(
      {
        modelId: meta.modelId,
        animation: { type, id: resourceId },
        preset: meta.preset,
        prompt: meta.prompt,
        motion: meta.motion,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`[6/6] Registered avatar "${identity.name}" (${identity.id}) ✓

Done. Select the "${identity.name}" avatar in the garage, or ride with ?avatarId=${identity.id}.
Manifest: public/characters/${identity.slug}.mint.json`);
}

function avatarEntry({ animated }) {
  return {
    id: identity.id,
    name: identity.name,
    type: identity.type,
    modelUrl: `/characters/${identity.slug}.glb`,
    // AvatarAsset.clips maps ride states → per-clip GLBs. The batch GLB
    // this script downloads carries one clip; richer state mappings (idle /
    // recovery / celebrate) come from downloading each clip's artifact via
    // GET /v1/animations/model_animation_clip/{clipId}/artifacts — see the
    // session notes in app/lib/generated-avatars.json.
    ...(animated
      ? { clips: [{ name: "default", url: `/characters/${identity.slug}-animated.glb` }] }
      : {}),
    thumbnail: `/characters/${identity.slug}.webp`,
    description: animated
      ? "Mint-generated rider — animated clips."
      : `Mint-generated ${identity.type === "humanoid" ? "rider" : `${identity.type} rider`}.`,
    generated: true,
  };
}

async function main() {
  // ─── Free, offline: register the already-downloaded static GLB ────
  if (flag("--register-static")) {
    const registry = JSON.parse(await readFile(AVATAR_REGISTRY, "utf8"));
    const entry = avatarEntry({ animated: false });
    registry.avatars = [...registry.avatars.filter((a) => a.id !== entry.id), entry];
    await writeFile(AVATAR_REGISTRY, JSON.stringify(registry, null, 2) + "\n");
    console.log(`Registered static avatar "${identity.name}" (${identity.id}) — no animation clips yet.`);
    return;
  }

  const config = readMintApiConfig(); // throws with instructions if missing

  // ─── Free: account + Credits ─────────────────────────────────────
  if (flag("--usage")) {
    const [{ body: me }, { body: usage }] = await Promise.all([
      mintApiRequest("/me", { config }),
      mintApiRequest("/usage", { config }),
    ]);
    console.log("Account:", me.owner?.userId, me.owner?.email ?? "");
    console.log("Credits:", JSON.stringify(usage.credits, null, 2));
    console.log("API usage:", JSON.stringify(usage.apiUsage, null, 2));
    return;
  }

  // ─── Resume an in-flight operation ───────────────────────────────
  const resumeId = opt("--resume");
  if (resumeId) {
    const operation = await pollOrSurfaceBilling(resumeId, config);
    console.log(JSON.stringify(operation, null, 2));
    return;
  }

  // ─── Free: fetch + register an existing animation resource ──────
  const existingAnimation = opt("--animation");
  if (existingAnimation) {
    await downloadAndRegisterAnimation(config, existingAnimation, {
      prompt: "(pre-existing animation resource)",
      motion: "(pre-existing animation resource)",
      preset: "n/a",
      modelId: opt("--model") || null,
    });
    return;
  }

  if (!flag("--yes")) {
    printPlan(config);
    return;
  }

  const prompt = opt("--prompt") || DEFAULT_PROMPT;
  const motion = opt("--motion") || DEFAULT_MOTION;
  const preset = opt("--preset") || "standard";
  if (!["fast", "standard", "production"].includes(preset)) {
    throw new Error(`--preset must be fast|standard|production, got "${preset}"`);
  }
  await mkdir(CHARACTERS_DIR, { recursive: true });

  // ─── 1. Generate ─────────────────────────────────────────────────
  console.log(`[1/6] Generating "${identity.name}" model (preset: ${preset}, t_pose)…`);
  const { body: genOp, requestId } = await mintApiRequest("/models:generate", {
    config,
    method: "POST",
    body: { prompt, name: `SpinChain ${identity.name}`, generationPreset: preset, riggingPose: "t_pose" },
  });
  const genOpId = genOp.id || genOp.operationId;
  console.log(`      operation ${genOpId} (request ${requestId})`);
  const genDone = await pollOrSurfaceBilling(genOpId, config);
  const modelId = genDone.resource?.id;
  if (genDone.resource?.type !== "model" || !modelId) {
    throw new Error(`Expected a model resource, got: ${JSON.stringify(genDone.resource)}`);
  }
  console.log(`      model ${modelId} ✓`);

  // ─── 2. Optimize for mobile ──────────────────────────────────────
  console.log("[2/6] Optimizing (moderate)…");
  const { body: optOp } = await mintApiRequest(`/models/${modelId}:optimize`, {
    config,
    method: "POST",
    body: { optimizationLevel: "moderate" },
  });
  await pollOrSurfaceBilling(optOp.id || optOp.operationId, config);
  console.log("      optimized ✓");

  // ─── 3. Download GLB + thumbnail ─────────────────────────────────
  const { body: model } = await mintApiRequest(`/models/${modelId}`, { config });
  const glbUrl = model.assets?.optimizedGlbUrl || model.assets?.glbUrl;
  if (!glbUrl) throw new Error("Model has no GLB URL yet.");
  const glbBytes = await mintDownload(glbUrl, join(CHARACTERS_DIR, `${identity.slug}.glb`));
  console.log(`[3/6] ${identity.slug}.glb ✓ (${(glbBytes / 1024 / 1024).toFixed(2)} MB, ${glbUrl === model.assets?.optimizedGlbUrl ? "optimized" : "canonical"})`);
  const thumbUrl = model.assets?.thumbnailUrl || model.assets?.previewImageUrl;
  if (thumbUrl) {
    await mintDownload(thumbUrl, join(CHARACTERS_DIR, `${identity.slug}.webp`));
    console.log(`      ${identity.slug}.webp ✓`);
  }

  // Static archetype (no clips): register and stop here.
  if (flag("--skip-animation")) {
    const registry = JSON.parse(await readFile(AVATAR_REGISTRY, "utf8"));
    const entry = avatarEntry({ animated: false });
    registry.avatars = [...registry.avatars.filter((a) => a.id !== entry.id), entry];
    await writeFile(AVATAR_REGISTRY, JSON.stringify(registry, null, 2) + "\n");
    await writeFile(
      manifestPath(),
      JSON.stringify(
        { modelId, preset, prompt, animated: false, generatedAt: new Date().toISOString() },
        null,
        2,
      ) + "\n",
    );
    console.log(`[4/6] --skip-animation: registered static avatar "${identity.name}" (${identity.id}) ✓

Done. Select the "${identity.name}" avatar in the garage, or ride with ?avatarId=${identity.id}.
Clips can be added later with: node scripts/mint/generate-rider.mjs --animation <resourceId> --id ${identity.id} --name "${identity.name}" --slug ${identity.slug}`);
    return;
  }

  // ─── 4. Animate (cycling) ────────────────────────────────────────
  console.log("[4/6] Animating (cycling motion)…");
  const { body: animOp } = await mintApiRequest(`/models/${modelId}:animate`, {
    config,
    method: "POST",
    body: { motionPrompt: motion, heightMeters: 1.75 },
  });
  const animDone = await pollOrSurfaceBilling(animOp.id || animOp.operationId, config);
  const animResource = animDone.resource;
  if (!animResource?.id) throw new Error("Animation operation produced no resource.");
  console.log(`      animation ${animResource.type}/${animResource.id} ✓`);

  // ─── 5–6. Download animation GLB + register the avatar ───────────
  await downloadAndRegisterAnimation(config, animResource.id, { prompt, motion, preset, modelId });
}

main().catch((error) => {
  if (error.validationErrors?.length) {
    console.error("Validation errors:", JSON.stringify(error.validationErrors, null, 2));
  }
  console.error(error.message);
  if (error.requestId) console.error(`X-Request-Id: ${error.requestId}`);
  process.exit(1);
});
