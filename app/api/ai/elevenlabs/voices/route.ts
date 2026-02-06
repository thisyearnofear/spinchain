/**
 * ElevenLabs Voices API Route
 * Server-side only - keeps API key secure
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

export async function GET(req: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: "ElevenLabs not configured", message: "ELEVENLABS_API_KEY not set" },
        { status: 503 }
      );
    }

    const response = await fetch(
      `${ELEVENLABS_BASE_URL}/voices`,
      {
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("ElevenLabs voices error:", error);
      return NextResponse.json(
        { error: "Failed to fetch voices", message: error },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("ElevenLabs voices error:", error);
    return NextResponse.json(
      { error: "Failed to fetch voices", message: String(error) },
      { status: 500 }
    );
  }
}
