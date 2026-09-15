/**
 * Minimal Mint API client for server-side (trusted) use.
 *
 * Reads MINT_API_KEY from the environment — never logs, prints, or transmits
 * it anywhere other than the Mint API Authorization header.
 *
 * Contract: https://api.mint.gg/openapi.json (source of truth),
 * guides: https://docs.mint.gg/developers/quickstart.
 */

const DEFAULT_BASE_URL = "https://api.mint.gg/v1";
const TERMINAL_STATUSES = new Set([
  "preview_ready",
  "succeeded",
  "partially_succeeded",
  "failed",
  "canceled",
]);

export function readMintApiConfig(env = process.env) {
  const apiKey = env.MINT_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "MINT_API_KEY is not set. Create a key at https://platform.mint.gg " +
        "(Developer settings) and set it in the server environment. " +
        "Never paste the key into chat or commit it.",
    );
  }
  const baseUrl = (env.MINT_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  if (new URL(baseUrl).protocol !== "https:") {
    throw new Error("MINT_API_BASE_URL must use HTTPS.");
  }
  return { apiKey, baseUrl };
}

export async function mintApiRequest(pathname, options = {}) {
  const config = options.config || readMintApiConfig(options.env);
  const response = await fetch(`${config.baseUrl}${pathname}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
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
  const requestId = response.headers.get("x-request-id");
  if (!response.ok) {
    const detail = body?.detail || body?.title || response.statusText;
    const error = new Error(`Mint API ${response.status}: ${detail}`);
    error.status = response.status;
    error.retryAfter = response.headers.get("retry-after");
    error.requestId = requestId;
    error.problem = body;
    error.validationErrors = Array.isArray(body?.errors) ? body.errors : [];
    throw error;
  }
  return { body, response, requestId };
}

export function isTerminalOperation(operation) {
  return TERMINAL_STATUSES.has(operation?.status);
}

/**
 * Poll an operation with bounded exponential backoff: start at 2s, ×1.6,
 * capped at 15s, giving up after 30 minutes (per Mint's quickstart).
 * `billing_required` is NOT terminal for our purposes but is returned
 * immediately so the caller can surface billing.actionUrl.
 */
export async function pollMintOperation(operationId, options = {}) {
  if (!operationId || !/^[A-Za-z0-9_-]+$/.test(operationId)) {
    throw new Error("A valid operation ID is required.");
  }
  const timeoutMs = options.timeoutMs ?? 30 * 60 * 1_000;
  const maxDelayMs = options.maxDelayMs ?? 15_000;
  let delayMs = options.initialDelayMs ?? 2_000;
  const startedAt = Date.now();

  while (true) {
    const { body } = await mintApiRequest(`/operations/${operationId}`, options);
    if (isTerminalOperation(body) || body?.status === "billing_required") return body;
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(`Timed out waiting for Mint operation ${operationId}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(maxDelayMs, Math.ceil(delayMs * 1.6));
  }
}

/** Download a file URL (from an asset/manifest) to disk. */
export async function mintDownload(url, destPath) {
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
