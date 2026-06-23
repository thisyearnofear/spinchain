import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/app/lib/api/response";
import { getServerClient } from "@/app/lib/supabase/client";
import { verifySession } from "@/app/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * AI Homework Recommendations API
 *
 * POST /api/ai/homework-recommendations
 *
 * Analyzes a rider's recent rides + profile and generates a recommended
 * practice workout config that an instructor can assign as homework.
 */

const VENICE_API_URL = "https://api.venice.ai/api/v1";
const VENICE_MODEL = "llama-3.3-70b";

async function getAuthPayload(request: NextRequest) {
  const token = request.cookies.get("spinchain-session")?.value
    || request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifySession(token);
}

function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
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
        temperature: 0.7,
        max_tokens: 1000,
      }),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Venice error: ${await res.text()}`);
      const data = await res.json();
      return data.choices[0]?.message?.content || "";
    });
  }

  if (process.env.GEMINI_API_KEY) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
      }),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    });
  }

  throw new Error("No AI provider configured");
}

export async function POST(request: NextRequest) {
  const payload = await getAuthPayload(request);
  if (!payload) {
    return apiError("Unauthorized", "FORBIDDEN", 401);
  }

  let body: { riderAddress?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_FORMAT", 400);
  }

  const riderAddress = body.riderAddress || payload.address;

  const client = getServerClient();
  if (!client) {
    return apiError("Database not configured", "NOT_CONFIGURED", 503);
  }

  // Fetch rider's recent rides
  const { data: rides, error: ridesError } = await client
    .from("ride_summaries")
    .select("class_name, instructor, completed_at, elapsed_time, avg_effort, avg_heart_rate, avg_power, effort_tier")
    .eq("rider_address", riderAddress)
    .order("completed_at", { ascending: false })
    .limit(10);

  if (ridesError) {
    return apiError("Failed to fetch rides", "INTERNAL_ERROR", 500, ridesError.message);
  }

  // Fetch rider profile
  const { data: profile } = await client
    .from("rider_profiles")
    .select("goal, experience, frequency, ftp, max_hr, weight_kg, injuries, training_zones")
    .eq("address", riderAddress)
    .single();

  if (!rides || rides.length === 0) {
    return apiError("No rides found for recommendation", "MISSING_FIELD", 404);
  }

  const systemPrompt = `You are an expert cycling coach. Based on a rider's recent ride data and profile, recommend a practice workout they should do as homework.

Respond ONLY with valid JSON:
{
  "name": "Workout name (e.g. 'Endurance Intervals')",
  "description": "2-3 sentence description of the workout",
  "duration": 20,
  "intensity": "easy|moderate|hard",
  "focus": "What this workout targets (e.g. 'VO2 max', 'Endurance base')",
  "structure": ["Step 1: warmup 5min", "Step 2: ...", "Step 3: cooldown"],
  "rationale": "Why this workout is recommended based on their data"
}`;

  const ridesStr = JSON.stringify(rides);
  const profileStr = profile ? JSON.stringify(profile) : "No profile data available";

  try {
    const content = await callLLM(systemPrompt, `Rider profile: ${profileStr}\n\nRecent rides: ${ridesStr}`);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const recommendation = jsonMatch ? JSON.parse(jsonMatch[0]) : { name: "Practice Ride", description: content, duration: 20, intensity: "moderate", focus: "General fitness", structure: [], rationale: "" };

    return apiOk(recommendation);
  } catch (err) {
    return apiError("AI recommendation failed", "PROVIDER_ERROR", 503, err instanceof Error ? err.message : String(err));
  }
}
