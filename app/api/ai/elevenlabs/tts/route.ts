export const dynamic = 'force-dynamic';
/**
 * ElevenLabs Text-to-Speech API Route
 * Server-side only - keeps API key secure
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/app/lib/api/response";

export const runtime = "edge";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

/**
 * In-memory TTS response cache (LRU, per server isolate).
 * Scripted cues (interval transitions, milestones, countdowns) are repeated
 * verbatim across rides — this makes them near-zero-cost after the first
 * synthesis and removes the 1-2s ElevenLabs round-trip from the audio path.
 */
const TTS_CACHE_MAX_ENTRIES = 100;
const ttsCache = new Map<string, ArrayBuffer>();

function getCacheKey(body: TTSRequest): string {
  return JSON.stringify([body.text, body.voice_id, body.model_id, body.voice_settings, body.optimize_streaming_latency]);
}

function cacheGet(key: string): ArrayBuffer | null {
  const cached = ttsCache.get(key);
  if (!cached) return null;
  // Refresh LRU recency
  ttsCache.delete(key);
  ttsCache.set(key, cached);
  // Response bodies are single-consumption; hand out a copy
  return cached.slice(0);
}

function cachePut(key: string, buffer: ArrayBuffer): void {
  ttsCache.set(key, buffer);
  if (ttsCache.size > TTS_CACHE_MAX_ENTRIES) {
    const oldest = ttsCache.keys().next().value;
    if (oldest !== undefined) ttsCache.delete(oldest);
  }
}

type TTSRequest = {
  text: string;
  voice_id: string;
  model_id?: string;
  voice_settings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
  };
  optimize_streaming_latency?: number;
};

export async function POST(req: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return apiError("ELEVENLABS_API_KEY not set", "NOT_CONFIGURED", 503);
    }

    const body = (await req.json()) as TTSRequest;
    const { text, voice_id, model_id, voice_settings, optimize_streaming_latency } = body;

    if (!text || !voice_id) {
      return apiError("text and voice_id are required", "MISSING_FIELD", 400);
    }

    // Serve from the in-memory LRU when we've synthesized this exact
    // (text, voice, settings) combo before
    const key = getCacheKey({ text, voice_id, model_id, voice_settings, optimize_streaming_latency });
    const cached = cacheGet(key);
    if (cached) {
      return new Response(cached, {
        headers: {
          "Content-Type": "audio/mpeg",
          "X-TTS-Cache": "hit",
        },
      });
    }

    const response = await fetch(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${voice_id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: model_id || "eleven_turbo_v2",
          voice_settings,
          optimize_streaming_latency: optimize_streaming_latency ?? 3,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("ElevenLabs TTS error:", error);
      return apiError(error, "PROVIDER_ERROR", response.status);
    }

    // Return audio as arraybuffer
    const audioBuffer = await response.arrayBuffer();
    cachePut(key, audioBuffer);

    return new Response(audioBuffer.slice(0), {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });

  } catch (error) {
    console.error("ElevenLabs TTS error:", error);
    return apiError("TTS generation failed", "INTERNAL_ERROR", 500, error);
  }
}

export async function GET() {
  const configured = !!ELEVENLABS_API_KEY;
  return NextResponse.json({
    status: configured ? "ready" : "not_configured",
    features: ["text-to-speech"],
  });
}
