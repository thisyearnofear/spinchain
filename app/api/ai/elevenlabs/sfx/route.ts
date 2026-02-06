/**
 * ElevenLabs Sound Effects API Route
 * Server-side only - keeps API key secure
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

type SFXRequest = {
  text: string;
  duration_seconds?: number;
  prompt_influence?: number;
};

export async function POST(req: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: "ElevenLabs not configured", message: "ELEVENLABS_API_KEY not set" },
        { status: 503 }
      );
    }

    const body = (await req.json()) as SFXRequest;
    const { text, duration_seconds, prompt_influence } = body;

    if (!text) {
      return NextResponse.json(
        { error: "Invalid request", message: "text is required" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${ELEVENLABS_BASE_URL}/sound-generation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          duration_seconds: duration_seconds ?? 2,
          prompt_influence: prompt_influence ?? 0.5,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("ElevenLabs SFX error:", error);
      return NextResponse.json(
        { error: "SFX generation failed", message: error },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });

  } catch (error) {
    console.error("ElevenLabs SFX error:", error);
    return NextResponse.json(
      { error: "SFX generation failed", message: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const configured = !!ELEVENLABS_API_KEY;
  return NextResponse.json({
    status: configured ? "ready" : "not_configured",
    features: ["sound-effects"],
  });
}
