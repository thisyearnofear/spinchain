/**
 * Minimal Meshy API client for server-side (trusted) use.
 *
 * Reads MESHY_API_KEY from the environment — never logs, prints, or transmits
 * it anywhere other than the Meshy API Authorization header.
 *
 * Contract: https://docs.meshy.ai/en/api (OpenAPI spec published there),
 * base URL https://api.meshy.ai/openapi/v1.
 *
 * Unlike Mint, Meshy has no unified operations endpoint — each task type
 * (rigging, animations, text-to-motion, …) is polled at its own route:
 *   GET /openapi/v1/<type>/<taskId>
 * until status reaches SUCCEEDED / FAILED / CANCELED.
 */

import { createRequire } from "node:module";

const DEFAULT_BASE_URL = "https://api.meshy.ai/openapi/v1";
const TERMINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELED"]);

export function readMeshyApiConfig(env = process.env) {
  // .env.local isn't auto-loaded for plain node scripts; fall back to a
  // dotenv-free read so `node scripts/meshy/*.mjs` works from the repo root.
  let apiKey = env.MESHY_API_KEY?.trim();
  if (!apiKey) {
    apiKey = loadEnvLocalKey("MESHY_API_KEY");
  }
  if (!apiKey) {
    throw new Error(
      "MESHY_API_KEY is not set. Create a key at https://www.meshy.ai/developers/keys " +
        "and set it in .env.local or the environment. Never commit it.",
    );
  }
  const baseUrl = (env.MESHY_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  if (new URL(baseUrl).protocol !== "https:") {
    throw new Error("MESHY_API_BASE_URL must use HTTPS.");
  }
  return { apiKey, baseUrl };
}

function loadEnvLocalKey(name) {
  try {
    const req = createRequire(import.meta.url);
    const { readFileSync } = req("node:fs");
    const { join, dirname } = req("node:path");
    const envPath = join(dirname(new URL(import.meta.url).pathname), "../..", ".env.local");
    const line = readFileSync(envPath, "utf8")
      .split("\n")
      .find((l) => l.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim() || null;
  } catch {
    return null;
  }
}

export async function meshyApiRequest(pathname, options = {}) {
  const config = options.config || readMeshyApiConfig(options.env);
  const response = await fetch(`${config.baseUrl}${pathname}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { detail: text.slice(0, 500) };
    }
  }
  if (!response.ok) {
    const detail = body?.message || body?.detail || body?.error || response.statusText;
    const error = new Error(`Meshy API ${response.status}: ${detail}`);
    error.status = response.status;
    error.retryAfter = response.headers.get("retry-after");
    error.problem = body;
    throw error;
  }
  return { body, response };
}

export function isTerminalTask(task) {
  return TERMINAL_STATUSES.has(task?.status);
}

/**
 * Poll a Meshy task at GET /<taskType>/<taskId> with bounded exponential
 * backoff: start at 2s, ×1.6, capped at 15s, giving up after 30 minutes.
 * taskType is the API route segment, e.g. "rigging", "animations",
 * "text-to-motion".
 */
export async function pollMeshyTask(taskType, taskId, options = {}) {
  if (!taskId) throw new Error("A Meshy task ID is required.");
  const timeoutMs = options.timeoutMs ?? 30 * 60 * 1_000;
  const maxDelayMs = options.maxDelayMs ?? 15_000;
  let delayMs = options.initialDelayMs ?? 2_000;
  const startedAt = Date.now();

  while (true) {
    const { body } = await meshyApiRequest(`/${taskType}/${taskId}`, options);
    if (isTerminalTask(body)) return body;
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(`Timed out waiting for Meshy ${taskType} task ${taskId}.`);
    }
    const progress = body?.progress != null ? ` ${body.progress}%` : "";
    console.log(`      … ${body?.status || "PENDING"}${progress}`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(maxDelayMs, Math.ceil(delayMs * 1.6));
  }
}

/** Download an asset URL (task result fields) to disk. */
export async function meshyDownload(url, destPath) {
  const { mkdirSync } = await import("node:fs");
  const { writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  mkdirSync(dirname(destPath), { recursive: true });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url.slice(0, 80)}…`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destPath, buffer);
  return buffer.length;
}
