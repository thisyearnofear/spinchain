/**
 * NVIDIA AI Client
 * NVIDIA NIM API — OpenAI-compatible chat completions
 *
 * Used as middle fallback between Venice AI and Gemini 3
 * Model: minimaxai/minimax-m3
 */

import type { RouteRequest, RouteResponse, CoachingContext, CoachingResponse, AgentDecision } from "./ai-types";

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "minimaxai/minimax-m3";

function getNvidiaApiKey(): string {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY environment variable is not set");
  }
  return apiKey;
}

function extractJson(content: string): unknown {
  const jsonMatch =
    content.match(/```json\s*([\s\S]*?)\s*```/) ||
    content.match(/```\s*([\s\S]*?)\s*```/) ||
    content.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
  return JSON.parse(jsonText);
}

async function nvidiaChat(
  messages: Array<{ role: string; content: string }>,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const apiKey = getNvidiaApiKey();
  const { maxTokens = 500, temperature = 0.7 } = opts;

  const response = await fetch(NVIDIA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NVIDIA AI error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from NVIDIA AI");
  }
  return content;
}

/**
 * Generate route using NVIDIA AI
 */
export async function generateRouteWithNvidia(
  request: RouteRequest
): Promise<RouteResponse> {
  const systemPrompt = `You are an expert cycling route designer. Generate realistic spin class routes.

Create a route with:
- 80-120 coordinate points with elevation
- 4-6 story beats (climb, sprint, drop, rest, scenery, push)
- Realistic elevation gain/loss
- Exercise zones (warmup, endurance, tempo, threshold, recovery)
- Distance appropriate for duration at 25-35 km/h

Respond ONLY with valid JSON matching this structure:
{
  "name": "Route title",
  "description": "Route description",
  "coordinates": [{"lat": 34.05, "lng": -118.24, "ele": 100}],
  "estimatedDistance": 30.5,
  "estimatedDuration": 45,
  "elevationGain": 450,
  "elevationLoss": 200,
  "maxElevation": 600,
  "minElevation": 100,
  "avgGrade": 3.5,
  "maxGrade": 8.0,
  "storyBeats": [{"progress": 0.25, "label": "Hill Climb", "type": "climb", "description": "", "intensity": 7}],
  "terrainTags": ["rolling", "scenic"],
  "difficultyScore": 65,
  "estimatedCalories": 400,
  "zones": [{"name": "Warmup", "startProgress": 0, "endProgress": 0.15, "type": "warmup", "description": ""}]
}`;

  const userPrompt = `Create a ${request.difficulty} cycling route:
Description: ${request.prompt}
Duration: ${request.duration} minutes
${request.fitnessLevel ? `Fitness Level: ${request.fitnessLevel}` : ""}
${request.theme ? `Theme: ${request.theme}` : ""}
${request.preferences ? `Preferences: ${request.preferences}` : ""}`;

  const content = await nvidiaChat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { maxTokens: 4000, temperature: 0.7 }
  );

  try {
    const route = extractJson(content) as RouteResponse;
    if (!route.coordinates || route.coordinates.length < 10) {
      throw new Error("Invalid route: insufficient coordinates");
    }
    return route;
  } catch {
    console.error("Failed to parse NVIDIA route response:", content);
    throw new Error("Failed to parse route from NVIDIA AI");
  }
}

/**
 * Generate narrative using NVIDIA AI
 */
export async function generateNarrativeWithNvidia(
  elevationProfile: number[],
  theme: string,
  duration: number,
  routeName?: string
): Promise<{ narrative: string; atmosphere: string; intensity: string }> {
  const minEle = Math.min(...elevationProfile);
  const maxEle = Math.max(...elevationProfile);
  const elevationGain = maxEle - minEle;

  const prompt = `Write an immersive cycling route description.

Route: ${routeName || "Custom Route"}
Theme: ${theme}
Duration: ${duration} minutes
Elevation Gain: ${Math.round(elevationGain)}m

Create:
1. Narrative (2-3 sentences): Vivid description
2. Atmosphere (5-8 words): Mood descriptor
3. Intensity (5-8 words): Effort descriptor

Respond with JSON:
{
  "narrative": "...",
  "atmosphere": "...",
  "intensity": "..."
}`;

  const content = await nvidiaChat(
    [{ role: "user", content: prompt }],
    { maxTokens: 500, temperature: 0.8 }
  );

  try {
    return extractJson(content) as { narrative: string; atmosphere: string; intensity: string };
  } catch {
    return {
      narrative: content.trim().slice(0, 300),
      atmosphere: `${theme} ride`,
      intensity: elevationGain > 200 ? "Challenging" : "Moderate",
    };
  }
}

/**
 * Chat with NVIDIA AI
 */
export async function chatWithNvidia(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const systemPrompt =
    "You are an expert cycling instructor and route designer. Keep responses concise (2-3 sentences) and actionable.";

  const content = await nvidiaChat(
    [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    { maxTokens: 500, temperature: 0.7 }
  );

  return content;
}

/**
 * Coaching with NVIDIA AI
 */
export async function getCoachingWithNvidia(
  context: CoachingContext,
  conversationHistory: Array<{ role: "rider" | "coach"; message: string }> = []
): Promise<CoachingResponse> {
  const historyText = conversationHistory.length > 0
    ? "\nRecent conversation:\n" + conversationHistory.map((h) =>
        `${h.role === "rider" ? "Rider" : "Coach"}: ${h.message}`
      ).join("\n")
    : "";

  const personalityStyle = context.personality === "drill-sergeant"
    ? " You are a DRILL SERGEANT: no excuses, direct, commanding, intense. Push them beyond comfort."
    : context.personality === "zen"
      ? " You are a ZEN MASTER: calm, mindful, present. Focus on breath, form, and the journey."
      : context.personality === "data"
        ? " You are a DATA ANALYST: metrics-driven, precise, analytical. Reference numbers and zones."
        : "";

  const prompt = context.customSystemPrompt
    ? `${context.customSystemPrompt}\n\nCurrent rider state:\n- Heart Rate: ${context.riderHeartRate} BPM (target: ${context.targetHeartRate})\n- Resistance: ${context.currentResistance}%\n- Cadence: ${context.currentCadence} RPM\n- Progress: ${Math.round(context.workoutProgress * 100)}%\n- Performance: ${context.recentPerformance}\n- Fatigue: ${context.fatigueLevel}\n${historyText}\n\nRespond with JSON only:\n{\n  "message": "1-2 sentence coaching advice",\n  "tone": "encouraging|challenging|calm|energetic|tactical",\n  "action": { "type": "increase_resistance|decrease_resistance|maintain|sprint|recover", "value": number },\n  "motivation": "One-line encouragement"\n}`
    : `You are a cycling coach.${personalityStyle} Current rider state:
- Heart Rate: ${context.riderHeartRate} BPM (target: ${context.targetHeartRate})
- Resistance: ${context.currentResistance}%
- Cadence: ${context.currentCadence} RPM
- Progress: ${Math.round(context.workoutProgress * 100)}%
- Performance: ${context.recentPerformance}
- Fatigue: ${context.fatigueLevel}
${historyText}

Respond with JSON only:
{
  "message": "1-2 sentence coaching advice",
  "tone": "encouraging|challenging|calm|energetic|tactical",
  "action": { "type": "increase_resistance|decrease_resistance|maintain|sprint|recover", "value": number },
  "motivation": "One-line encouragement"
}`;

  const content = await nvidiaChat(
    [{ role: "user", content: prompt }],
    { maxTokens: 500, temperature: 0.7 }
  );

  try {
    return extractJson(content) as CoachingResponse;
  } catch {
    return {
      message: content.trim().slice(0, 200),
      tone: "encouraging",
      motivation: "Keep pushing!",
    };
  }
}

/**
 * Agent reasoning with NVIDIA AI
 */
export async function agentReasoningWithNvidia(
  agentName: string,
  personality: string,
  context: {
    telemetry: { avgBpm: number; resistance: number; duration: number };
    market: { ticketsSold: number; revenue: number; capacity: number };
    recentDecisions: string[];
  },
  customSystemPrompt?: string,
): Promise<AgentDecision> {
  const prompt = customSystemPrompt
    ? `${customSystemPrompt}\n\nContext:\n- Heart Rate: ${context.telemetry.avgBpm} BPM\n- Resistance: ${context.telemetry.resistance}%\n- Duration: ${context.telemetry.duration} mins\n- Tickets: ${context.market.ticketsSold}/${context.market.capacity}\n- Revenue: ${context.market.revenue}\n- Recent actions: ${context.recentDecisions.slice(-3).join(", ") || "None"}\n\nAvailable actions: increase_resistance, decrease_resistance, maintain, surge_price, discount_price, wait\n\nRespond with JSON only:\n{\n  "thoughtProcess": "Your reasoning",\n  "action": "action_name",\n  "parameters": {},\n  "confidence": 0.85,\n  "reasoning": "Why this action",\n  "expectedOutcome": "What will happen"\n}`
    : `You are ${agentName}, an AI instructor with ${personality} personality.

Context:
- Heart Rate: ${context.telemetry.avgBpm} BPM
- Resistance: ${context.telemetry.resistance}%
- Duration: ${context.telemetry.duration} mins
- Tickets: ${context.market.ticketsSold}/${context.market.capacity}
- Revenue: ${context.market.revenue}
- Recent actions: ${context.recentDecisions.slice(-3).join(", ") || "None"}

Available actions: increase_resistance, decrease_resistance, maintain, surge_price, discount_price, wait

Respond with JSON only:
{
  "thoughtProcess": "Your reasoning",
  "action": "action_name",
  "parameters": {},
  "confidence": 0.85,
  "reasoning": "Why this action",
  "expectedOutcome": "What will happen"
}`;

  const content = await nvidiaChat(
    [{ role: "user", content: prompt }],
    { maxTokens: 800, temperature: 0.7 }
  );

  try {
    const decision = extractJson(content) as AgentDecision;
    decision.confidence = Math.max(0, Math.min(1, decision.confidence || 0.5));
    return decision;
  } catch {
    throw new Error("Failed to parse agent reasoning from NVIDIA AI");
  }
}
