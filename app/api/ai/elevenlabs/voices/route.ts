export const dynamic = 'force-dynamic';
/**
 * ElevenLabs Voices API Route
 * Server-side only - keeps API key secure
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/app/lib/api/response";

export const runtime = "edge";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

export async function GET(req: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return apiError("ELEVENLABS_API_KEY not set", "NOT_CONFIGURED", 503);
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
      return apiError(error, "PROVIDER_ERROR", response.status);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("ElevenLabs voices error:", error);
    return apiError(String(error), "INTERNAL_ERROR", 500);
  }
}
