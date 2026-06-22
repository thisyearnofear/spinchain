/**
 * Fetches a coach system prompt from Walrus by blob ID.
 *
 * The system_prompt_cid stored on-chain (Sui Coach struct) is a Walrus
 * blob ID. This utility retrieves the actual prompt JSON from the Walrus
 * aggregator so the AI clients can use it instead of hardcoded defaults.
 */

const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";

interface CoachSystemPrompt {
  name: string;
  personality: string;
  systemPrompt: string;
  coachingPhilosophy?: string;
  toneGuidelines?: string;
  actionGuidelines?: string;
}

const promptCache = new Map<string, CoachSystemPrompt>();

/**
 * Fetch a coach system prompt from Walrus.
 * @param blobId - Walrus blob ID (can be `walrus://{id}` or raw `{id}`)
 * @returns The parsed prompt, or null if fetch fails
 */
export async function fetchCoachPromptFromWalrus(
  blobId: string,
): Promise<CoachSystemPrompt | null> {
  const cleanId = blobId.replace(/^walrus:\/\//, "").replace(/^ipfs:\/\//, "");

  if (promptCache.has(cleanId)) {
    return promptCache.get(cleanId)!;
  }

  try {
    const response = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${cleanId}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.warn(`[CoachPrompt] Walrus fetch failed (${response.status}) for ${cleanId}`);
      return null;
    }

    const data = (await response.json()) as CoachSystemPrompt;

    if (!data.systemPrompt) {
      console.warn("[CoachPrompt] No systemPrompt field in Walrus blob");
      return null;
    }

    promptCache.set(cleanId, data);
    return data;
  } catch (err) {
    console.warn("[CoachPrompt] Failed to fetch from Walrus:", err);
    return null;
  }
}

/**
 * Build a full system prompt string from a Walrus-fetched coach prompt,
 * falling back to a default if the fetch fails.
 */
export async function resolveSystemPrompt(
  systemPromptCid: string | undefined,
  fallback: string,
): Promise<string> {
  if (!systemPromptCid) return fallback;

  const prompt = await fetchCoachPromptFromWalrus(systemPromptCid);
  if (!prompt) return fallback;

  let full = prompt.systemPrompt;
  if (prompt.coachingPhilosophy) {
    full += `\n\n**Coaching Philosophy**:\n${prompt.coachingPhilosophy}`;
  }
  if (prompt.toneGuidelines) {
    full += `\n\n**Tone Guidelines**:\n${prompt.toneGuidelines}`;
  }
  if (prompt.actionGuidelines) {
    full += `\n\n**Action Guidelines**:\n${prompt.actionGuidelines}`;
  }

  return full;
}
