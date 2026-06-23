import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/app/lib/api/response";
import { getServerClient } from "@/app/lib/supabase/client";
import { verifySession } from "@/app/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Post-Ride AI Analysis API
 *
 * POST /api/ai/ride-analysis
 *
 * Sends current ride + recent ride history to LLM for comparative analysis.
 * Returns insights: what improved, what to work on, personalized tips.
 */

const VENICE_API_URL = "https://api.venice.ai/api/v1";
const VENICE_MODEL = "llama-3.3-70b";

interface RideRow {
  class_name: string | null;
  instructor: string | null;
  completed_at: string;
  elapsed_time: number;
  avg_effort: number;
  avg_heart_rate: number | null;
  avg_power: number | null;
  effort_tier: string | null;
}

async function getAuthPayload(request: NextRequest) {
  const token = request.cookies.get("spinchain-session")?.value
    || request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifySession(token);
}

function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.VENICE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No AI provider configured");

  if (process.env.VENICE_API_KEY) {
    return fetch(`${VENICE_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VENICE_API_KEY}`,
      },
      body: JSON.stringify({
        model: VENICE_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 800,
      }),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Venice error: ${await res.text()}`);
      const data = await res.json();
      return data.choices[0]?.message?.content || "";
    });
  }

  // Gemini fallback
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
  return fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
      ],
      generationConfig: { temperature: 0.6, maxOutputTokens: 800 },
    }),
  }).then(async (res) => {
    if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  });
}

export async function POST(request: NextRequest) {
  const payload = await getAuthPayload(request);
  if (!payload) {
    return apiError("Unauthorized", "FORBIDDEN", 401);
  }

  let body: { rideId?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_FORMAT", 400);
  }

  const client = getServerClient();
  if (!client) {
    return apiError("Database not configured", "NOT_CONFIGURED", 503);
  }

  // Fetch the current ride + recent rides for comparison
  const { data: rides, error } = await client
    .from("ride_summaries")
    .select("class_name, instructor, completed_at, elapsed_time, avg_effort, avg_heart_rate, avg_power, effort_tier")
    .eq("rider_address", payload.address)
    .order("completed_at", { ascending: false })
    .limit(20);

  if (error) {
    return apiError("Failed to fetch rides", "INTERNAL_ERROR", 500, error.message);
  }

  if (!rides || rides.length === 0) {
    return apiError("No rides found for analysis", "MISSING_FIELD", 404);
  }

  const currentRide = body.rideId
    ? rides.find((r) => (r as RideRow & { id: string }).id === body.rideId)
    : rides[0];

  if (!currentRide) {
    return apiError("Ride not found", "FORBIDDEN", 404);
  }

  const previousRides = rides.slice(1);

  const systemPrompt = `You are an expert cycling coach analyzing a rider's performance. Compare their latest ride to recent history and provide actionable insights.

Respond ONLY with valid JSON:
{
  "summary": "2-3 sentence overview of this ride",
  "improvements": ["what improved vs previous rides"],
  "focusAreas": ["what to work on next"],
  "tips": ["1-2 actionable training tips"],
  "comparison": {
    "effortTrend": "improving|declining|stable",
    "powerTrend": "improving|declining|stable|insufficient_data",
    "heartRateTrend": "improving|declining|stable|insufficient_data"
  },
  "encouragement": "1 sentence motivational note"
}`;

  const currentStr = `Latest ride: ${JSON.stringify(currentRide)}`;
  const previousStr = previousRides.length > 0
    ? `Previous ${previousRides.length} rides: ${JSON.stringify(previousRides)}`
    : "No previous rides available — this is the rider's first ride.";

  try {
    const content = await callLLM(systemPrompt, `${currentStr}\n\n${previousStr}`);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: content, improvements: [], focusAreas: [], tips: [], comparison: {}, encouragement: "" };

    return apiOk(analysis);
  } catch (err) {
    return apiError("AI analysis failed", "PROVIDER_ERROR", 503, err instanceof Error ? err.message : String(err));
  }
}
