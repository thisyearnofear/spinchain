export const dynamic = 'force-dynamic';
/**
 * POST /api/ai/synthesize-workout
 * Autonomous workout plan synthesis using Venice (default) or Gemini (fallback)
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/app/lib/api/response";
import { TtlCache } from "@/app/lib/api/cache";
import { checkRateLimit } from "@/app/lib/api/rate-limiter";
import type { WorkoutPlan } from "@/app/lib/workout-plan";

export const runtime = "edge";

const VENICE_API_KEY = process.env.VENICE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const synthCache = new TtlCache<WorkoutPlan & { _provider?: string }>(120_000);

interface SynthRequest {
  goal: string;
  durationMinutes: number;
  personality: string;
  theme: "neon" | "alpine" | "mars" | "anime" | "rainbow";
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return apiError("Rate limit exceeded. Please try again later.", "RATE_LIMITED", 429);
    }

    const body = (await req.json()) as SynthRequest;
    const { goal, durationMinutes, personality, theme } = body;

    if (!goal || goal.trim().length < 3) {
      return apiError("goal is required (min 3 characters)", "VALIDATION_FAILED", 400);
    }
    if (!durationMinutes || durationMinutes < 5 || durationMinutes > 120) {
      return apiError("durationMinutes must be between 5 and 120", "VALIDATION_FAILED", 400);
    }

    if (!VENICE_API_KEY && !GEMINI_API_KEY) {
      return apiError("No AI provider configured. Set VENICE_API_KEY or GEMINI_API_KEY.", "NOT_CONFIGURED", 503);
    }

    const cacheKey = `${goal}:${durationMinutes}:${personality}:${theme}`;
    const cached = synthCache.get(cacheKey);
    if (cached) {
      return NextResponse.json({
        ...cached,
        _meta: { generatedAt: new Date().toISOString(), duration: 0, provider: cached._provider, cached: true },
      });
    }

    const startTime = Date.now();
    let plan: WorkoutPlan;
    let providerUsed = "venice";

    if (VENICE_API_KEY) {
      console.log(`[Venice] Synthesizing workout: "${goal}" (${durationMinutes}min, ${personality}, ${theme})`);
      try {
        plan = await synthWithVenice(body);
      } catch (veniceErr) {
        console.warn("[Venice] Synthesis failed, falling back to Gemini:", veniceErr);
        if (!GEMINI_API_KEY) throw veniceErr;
        plan = await synthWithGemini(body);
        providerUsed = "gemini";
      }
    } else {
      console.log(`[Gemini] Synthesizing workout: "${goal}" (${durationMinutes}min, ${personality}, ${theme})`);
      plan = await synthWithGemini(body);
      providerUsed = "gemini";
    }

    const duration_ms = Date.now() - startTime;
    console.log(`[${providerUsed}] Workout synthesized in ${duration_ms}ms`);

    synthCache.set(cacheKey, { ...plan, _provider: providerUsed });

    return NextResponse.json({
      ...plan,
      _meta: {
        generatedAt: new Date().toISOString(),
        duration: duration_ms,
        provider: providerUsed,
        model: providerUsed === "venice" ? "llama-3.3-70b" : "gemini-3.0-flash-preview",
      },
    });
  } catch (error) {
    console.error("[Synthesis] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return apiError("Failed to synthesize workout plan.", "INTERNAL_ERROR", 500, errorMessage);
  }
}

export async function GET() {
  const hasApiKey = !!VENICE_API_KEY || !!GEMINI_API_KEY;
  return NextResponse.json({
    status: hasApiKey ? "ready" : "not_configured",
    provider: VENICE_API_KEY ? "venice" : "gemini",
    features: ["workout_synthesis", "interval_generation", "coach_cues", "music_energy"],
    version: "1.0.0",
  });
}

// ─── Venice AI Synthesis ─────────────────────────────────────────

async function synthWithVenice(req: SynthRequest): Promise<WorkoutPlan> {
  const VENICE_API_URL = "https://api.venice.ai/api/v1";
  const DEFAULT_MODEL = "llama-3.3-70b";

  const systemPrompt = `You are an expert spin class designer. Generate a structured workout plan as JSON.

Output ONLY valid JSON matching this structure:
{
  "name": "Creative class name",
  "description": "Short engaging description",
  "difficulty": "easy" | "moderate" | "hard",
  "intervals": [
    {
      "phase": "warmup" | "endurance" | "interval" | "sprint" | "recovery" | "cooldown",
      "durationSeconds": number,
      "targetRpm": [min, max],
      "coachCue": "A motivational cue matching the instructor personality",
      "musicEnergy": 0.0 to 1.0
    }
  ],
  "tags": ["tag1", "tag2"]
}

Constraints:
- Intervals must sum exactly to ${req.durationMinutes * 60} seconds.
- Match the "${req.personality}" coaching style in all coachCues.
- Ensure logical flow: warmup → work phases → cooldown.
- Include 5-10 intervals.`;

  const userPrompt = `Goal: ${req.goal}
Duration: ${req.durationMinutes} minutes
Instructor Personality: ${req.personality}
Visual Theme: ${req.theme}`;

  const response = await fetch(`${VENICE_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${VENICE_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Venice AI synthesis failed: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from Venice AI");

  return parseWorkoutPlan(content, req);
}

// ─── Gemini Synthesis ────────────────────────────────────────────

async function synthWithGemini(req: SynthRequest): Promise<WorkoutPlan> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.0-flash-preview",
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2000,
      responseMimeType: "application/json",
    },
  });

  const prompt = `You are an expert spin class designer. Generate a structured workout plan.

Goal: ${req.goal}
Duration: ${req.durationMinutes} minutes
Instructor Personality: ${req.personality}
Visual Theme: ${req.theme}

Output JSON:
{
  "name": "Creative class name",
  "description": "Short engaging description",
  "difficulty": "easy" | "moderate" | "hard",
  "intervals": [
    {
      "phase": "warmup" | "endurance" | "interval" | "sprint" | "recovery" | "cooldown",
      "durationSeconds": number,
      "targetRpm": [min, max],
      "coachCue": "A motivational cue matching the ${req.personality} personality",
      "musicEnergy": 0.0 to 1.0
    }
  ],
  "tags": ["tag1", "tag2"]
}

Constraints:
- Intervals must sum exactly to ${req.durationMinutes * 60} seconds.
- Match the "${req.personality}" coaching style in all coachCues.
- Ensure logical flow: warmup → work phases → cooldown.
- Include 5-10 intervals.`;

  const result = await model.generateContent(prompt);
  const content = result.response.text();
  return parseWorkoutPlan(content, req);
}

// ─── Shared Parser ───────────────────────────────────────────────

function parseWorkoutPlan(content: string, req: SynthRequest): WorkoutPlan {
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                      content.match(/```\s*([\s\S]*?)\s*```/) ||
                      content.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    const parsed = JSON.parse(jsonText);

    if (!parsed.intervals || !Array.isArray(parsed.intervals) || parsed.intervals.length === 0) {
      throw new Error("Invalid plan: no intervals");
    }

    const totalSeconds = parsed.intervals.reduce(
      (sum: number, i: { durationSeconds?: number }) => sum + (i.durationSeconds || 0),
      0,
    );

    return {
      id: `synth-${Date.now()}`,
      name: parsed.name || `${req.theme} Session`,
      description: parsed.description || `AI-curated session: ${req.goal}`,
      difficulty: parsed.difficulty || (req.durationMinutes > 30 ? "hard" : "moderate"),
      totalDuration: totalSeconds || req.durationMinutes * 60,
      tags: parsed.tags || ["ai-curated", req.theme, req.personality],
      intervals: parsed.intervals.map((i: any, _idx: number) => ({
        phase: i.phase || "endurance",
        durationSeconds: i.durationSeconds || 300,
        targetRpm: Array.isArray(i.targetRpm) ? i.targetRpm : [80, 100],
        coachCue: i.coachCue || "Keep pushing!",
        musicEnergy: typeof i.musicEnergy === "number" ? i.musicEnergy : 0.5,
      })),
    };
  } catch {
    console.error("[Synthesis] Failed to parse plan:", content.substring(0, 200));
    throw new Error("Failed to parse workout plan from AI response");
  }
}
