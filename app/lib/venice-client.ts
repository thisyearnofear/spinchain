/**
 * Venice AI Client
 * Privacy-first inference provider
 * 
 * Used as default provider when Gemini 3 credits are unavailable
 */

import { RouteRequest, RouteResponse, CoachingContext, CoachingResponse, AgentDecision } from "./gemini-client";

const VENICE_API_URL = "https://api.venice.ai/api/v1";
const DEFAULT_MODEL = "llama-3.3-70b";

function getVeniceApiKey(): string {
  const apiKey = process.env.VENICE_API_KEY;
  if (!apiKey) {
    throw new Error("VENICE_API_KEY environment variable is not set");
  }
  return apiKey;
}

/**
 * Generate route using Venice AI
 */
export async function generateRouteWithVenice(
  request: RouteRequest
): Promise<RouteResponse> {
  const apiKey = getVeniceApiKey();

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

  const response = await fetch(`${VENICE_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Venice AI error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from Venice AI");
  }

  // Parse JSON response
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                      content.match(/```\s*([\s\S]*?)\s*```/) ||
                      content.match(/\{[\s\S]*\}/);
    
    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    const route = JSON.parse(jsonText) as RouteResponse;
    
    // Validate and fill defaults
    if (!route.coordinates || route.coordinates.length < 10) {
      throw new Error("Invalid route: insufficient coordinates");
    }

    return route;
  } catch (parseError) {
    console.error("Failed to parse Venice response:", content);
    throw new Error("Failed to parse route from Venice AI");
  }
}

/**
 * Generate narrative using Venice AI
 */
export async function generateNarrativeWithVenice(
  elevationProfile: number[],
  theme: string,
  duration: number,
  routeName?: string
): Promise<{ narrative: string; atmosphere: string; intensity: string }> {
  const apiKey = getVeniceApiKey();

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

  const response = await fetch(`${VENICE_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error("Venice AI narrative generation failed");
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch {
    return {
      narrative: content.trim().slice(0, 300),
      atmosphere: `${theme} ride`,
      intensity: elevationGain > 200 ? "Challenging" : "Moderate",
    };
  }
}

/**
 * Chat with Venice AI
 */
export async function chatWithVenice(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const apiKey = getVeniceApiKey();

  const systemPrompt = "You are an expert cycling instructor and route designer. Keep responses concise (2-3 sentences) and actionable.";

  const response = await fetch(`${VENICE_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error("Venice AI chat failed");
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "I'm here to help with your cycling questions!";
}

/**
 * Coaching with Venice AI
 */
export async function getCoachingWithVenice(
  context: CoachingContext,
  conversationHistory: Array<{ role: "rider" | "coach"; message: string }> = []
): Promise<CoachingResponse> {
  const apiKey = getVeniceApiKey();

  const historyText = conversationHistory.length > 0
    ? "\nRecent conversation:\n" + conversationHistory.map(h => 
        `${h.role === "rider" ? "Rider" : "Coach"}: ${h.message}`
      ).join("\n")
    : "";

  const prompt = `You are a cycling coach. Current rider state:
- Heart Rate: ${context.riderHeartRate} BPM (target: ${context.targetHeartRate})
- Resistance: ${context.currentResistance}%
- Cadence: ${context.currentCadence} RPM
- Progress: ${Math.round(context.workoutProgress * 100)}%
- Performance: ${context.recentPerformance}
- Fatigue: ${context.fatigueLevel}
${historyText}

Respond with JSON:
{
  "message": "1-2 sentence coaching advice",
  "tone": "encouraging|challenging|calm|energetic|tactical",
  "action": { "type": "increase_resistance|decrease_resistance|maintain|sprint|recover", "value": number },
  "motivation": "One-line encouragement"
}`;

  const response = await fetch(`${VENICE_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error("Venice AI coaching failed");
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch {
    return {
      message: content.trim().slice(0, 200),
      tone: "encouraging",
      motivation: "Keep pushing!",
    };
  }
}

/**
 * Agent reasoning with Venice AI
 */
export async function agentReasoningWithVenice(
  agentName: string,
  personality: string,
  context: {
    telemetry: { avgBpm: number; resistance: number; duration: number };
    market: { ticketsSold: number; revenue: number; capacity: number };
    recentDecisions: string[];
  }
): Promise<AgentDecision> {
  const apiKey = getVeniceApiKey();

  const prompt = `You are ${agentName}, an AI instructor with ${personality} personality.

Context:
- Heart Rate: ${context.telemetry.avgBpm} BPM
- Resistance: ${context.telemetry.resistance}%
- Duration: ${context.telemetry.duration} mins
- Tickets: ${context.market.ticketsSold}/${context.market.capacity}
- Revenue: ${context.market.revenue}
- Recent actions: ${context.recentDecisions.slice(-3).join(", ") || "None"}

Available actions: increase_resistance, decrease_resistance, maintain, surge_price, discount_price, wait

Respond with JSON:
{
  "thoughtProcess": "Your reasoning",
  "action": "action_name",
  "parameters": {},
  "confidence": 0.85,
  "reasoning": "Why this action",
  "expectedOutcome": "What will happen"
}`;

  const response = await fetch(`${VENICE_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    throw new Error("Venice AI agent reasoning failed");
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const decision = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    decision.confidence = Math.max(0, Math.min(1, decision.confidence || 0.5));
    return decision;
  } catch {
    throw new Error("Failed to parse agent reasoning from Venice AI");
  }
}
