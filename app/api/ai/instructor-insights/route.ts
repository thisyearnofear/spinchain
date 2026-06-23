import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/app/lib/api/response";
import { getServerClient } from "@/app/lib/supabase/client";
import { verifySession } from "@/app/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Instructor AI Insights API
 *
 * POST /api/ai/instructor-insights
 *
 * Analyzes an instructor's roster and generates actionable insights:
 * - Which riders haven't practiced recently
 * - Who improved / declined
 * - Recommendations for engagement
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
        temperature: 0.6,
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
        generationConfig: { temperature: 0.6, maxOutputTokens: 1000 },
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

  const client = getServerClient();
  if (!client) {
    return apiError("Database not configured", "NOT_CONFIGURED", 503);
  }

  // Fetch all rides for this instructor's classes
  const { data: rides, error } = await client
    .from("ride_summaries")
    .select("rider_address, class_name, completed_at, elapsed_time, avg_effort, avg_heart_rate, avg_power, effort_tier")
    .eq("instructor", payload.address)
    .order("completed_at", { ascending: false })
    .limit(200);

  if (error) {
    return apiError("Failed to fetch roster data", "INTERNAL_ERROR", 500, error.message);
  }

  if (!rides || rides.length === 0) {
    return apiError("No rides found for insights", "MISSING_FIELD", 404);
  }

  // Aggregate per rider
  const riderMap = new Map<string, {
    ride_count: number;
    last_ride: string;
    avg_effort: number;
    avg_power: number;
    rides: typeof rides;
  }>();

  for (const ride of rides) {
    if (!ride.rider_address) continue;
    const existing = riderMap.get(ride.rider_address);
    if (existing) {
      existing.ride_count++;
      existing.rides.push(ride);
    } else {
      riderMap.set(ride.rider_address, {
        ride_count: 1,
        last_ride: ride.completed_at,
        avg_effort: ride.avg_effort || 0,
        avg_power: ride.avg_power || 0,
        rides: [ride],
      });
    }
  }

  const rosterSummary = Array.from(riderMap.entries()).map(([addr, data]) => ({
    rider: `${addr.slice(0, 6)}...${addr.slice(-4)}`,
    ride_count: data.ride_count,
    last_ride: data.last_ride,
    avg_effort: data.avg_effort,
    avg_power: data.avg_power,
  }));

  const systemPrompt = `You are an expert cycling coach mentor. Analyze an instructor's roster data and provide actionable insights about their riders.

Respond ONLY with valid JSON:
{
  "summary": "2-3 sentence overview of the instructor's roster",
  "insights": [
    {
      "type": "engagement|improvement|concern|opportunity",
      "rider": "rider address (shortened)",
      "message": "Specific insight about this rider",
      "action": "Recommended action for the instructor"
    }
  ],
  "rosterHealth": "healthy|needs_attention|at_risk",
  "recommendations": ["1-2 general recommendations for the instructor"]
}`;

  const userPrompt = `Instructor roster data (${rosterSummary.length} riders):\n${JSON.stringify(rosterSummary)}`;

  try {
    const content = await callLLM(systemPrompt, userPrompt);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const insights = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: content, insights: [], rosterHealth: "healthy", recommendations: [] };

    return apiOk(insights);
  } catch (err) {
    return apiError("AI insights failed", "PROVIDER_ERROR", 503, err instanceof Error ? err.message : String(err));
  }
}
