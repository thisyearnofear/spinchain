/**
 * ElevenLabs Speech-to-Text API Route
 * Server-side only - keeps API key secure
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

export async function POST(req: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: "ElevenLabs not configured", message: "ELEVENLABS_API_KEY not set" },
        { status: 503 }
      );
    }

    // Get the audio file from the request
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const modelId = (formData.get("model_id") as string) || "scribe_v1";

    if (!audioFile) {
      return NextResponse.json(
        { error: "Invalid request", message: "audio file is required" },
        { status: 400 }
      );
    }

    // Forward to ElevenLabs
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append("file", audioFile);
    elevenLabsFormData.append("model_id", modelId);

    const response = await fetch(
      `${ELEVENLABS_BASE_URL}/speech-to-text`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: elevenLabsFormData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("ElevenLabs STT error:", error);
      return NextResponse.json(
        { error: "Transcription failed", message: error },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error("ElevenLabs STT error:", error);
    return NextResponse.json(
      { error: "Transcription failed", message: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const configured = !!ELEVENLABS_API_KEY;
  return NextResponse.json({
    status: configured ? "ready" : "not_configured",
    features: ["speech-to-text"],
  });
}
