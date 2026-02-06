/**
 * ElevenLabs Text-to-Speech API Route
 * Server-side only - keeps API key secure
 */

import { NextRequest, NextResponse } from "next/server";

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
      return NextResponse.json(
        { error: "ElevenLabs not configured", message: "ELEVENLABS_API_KEY not set" },
        { status: 503 }
      );
    }

    const body = (await req.json()) as TTSRequest;
    const { text, voice_id, model_id, voice_settings, optimize_streaming_latency } = body;

    if (!text || !voice_id) {
      return NextResponse.json(
        { error: "Invalid request", message: "text and voice_id are required" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "TTS generation failed", message: error },
        { status: response.status }
      );
    }

    // Return audio as arraybuffer
    const audioBuffer = await response.arrayBuffer();
    
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });

  } catch (error) {
    console.error("ElevenLabs TTS error:", error);
    return NextResponse.json(
      { error: "TTS generation failed", message: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const configured = !!ELEVENLABS_API_KEY;
  return NextResponse.json({
    status: configured ? "ready" : "not_configured",
    features: ["text-to-speech"],
  });
}
