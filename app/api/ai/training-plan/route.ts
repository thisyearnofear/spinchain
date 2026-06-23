import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/app/lib/api/response";
import { getServerClient } from "@/app/lib/supabase/client";
import { verifySession } from "@/app/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Personalized Training Plan API
 *
 * POST /api/ai/training-plan
 *
 * Generates a multi-week training plan based on ride history + biometric profile.
 * Returns structured weekly schedule with workout recommendations.
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
        max_tokens: 2000,
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
        generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
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

  let body: { weeks?: number; goal?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const weeks = Math.min(Math.max(body.weeks || 4, 1), 12);

  const client = getServerClient();
  if (!client) {
    return apiError("Database not configured", "NOT_CONFIGURED", 503);
  }

  // Fetch recent rides
  const { data: rides, error: ridesError } = await client
    .from("ride_summaries")
    .select("class_name, completed_at, elapsed_time, avg_effort, avg_heart_rate, avg_power, effort_tier")
    .eq("rider_address", payload.address)
    .order("completed_at", { ascending: false })
    .limit(30);

  if (ridesError) {
    return apiError("Failed to fetch rides", "INTERNAL_ERROR", 500, ridesError.message);
  }

  // Fetch profile
  const { data: profile } = await client
    .from("rider_profiles")
    .select("goal, experience, frequency, ftp, max_hr, resting_hr, weight_kg, height_cm, injuries, training_zones")
    .eq("address", payload.address)
    .single();

  if (!rides || rides.length === 0) {
    return apiError("No rides found — complete a few rides first", "MISSING_FIELD", 404);
  }

  const systemPrompt = `You are an expert cycling coach creating a personalized multi-week training plan. Based on the rider's profile, recent ride history, and biometric data, create a structured plan.

Respond ONLY with valid JSON:
{
  "title": "Plan name (e.g. '4-Week FTP Builder')",
  "goal": "What this plan targets",
  "durationWeeks": ${weeks},
  "currentFitness": "Brief assessment of current fitness level",
  "weeks": [
    {
      "week": 1,
      "focus": "Week focus (e.g. 'Base endurance')",
      "workouts": [
        {
          "day": "Monday",
          "type": "rest|easy|interval|threshold|endurance|recovery",
          "name": "Workout name",
          "duration": 30,
          "description": "What to do",
          "intensity": "easy|moderate|hard"
        }
      ]
    }
  ],
  "progression": "How the plan progresses week over week",
  "tips": ["1-2 tips for success"]
}`;

  const ridesStr = JSON.stringify(rides);
  const profileStr = profile ? JSON.stringify(profile) : "No profile data";
  const goalStr = body.goal ? `Rider's stated goal: ${body.goal}` : "";

  try {
    const content = await callLLM(systemPrompt, `Rider profile: ${profileStr}\n\nRecent rides (${rides.length}): ${ridesStr}\n\n${goalStr}\n\nCreate a ${weeks}-week training plan.`);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const plan = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: "Training Plan", goal: "", durationWeeks: weeks, currentFitness: "", weeks: [], progression: "", tips: [] };

    return apiOk(plan);
  } catch (err) {
    return apiError("AI training plan failed", "PROVIDER_ERROR", 503, err instanceof Error ? err.message : String(err));
  }
}
