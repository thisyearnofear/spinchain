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
    
    return new Response(audioBuffer, {
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
