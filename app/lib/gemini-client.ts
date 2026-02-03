/**
 * Gemini API Client
 * Server-side only - handles actual Gemini API interactions
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

type RouteRequest = {
  prompt: string;
  duration: number;
  difficulty: "easy" | "moderate" | "hard";
  preferences?: string;
};

type RouteResponse = {
  name: string;
  description: string;
  coordinates: Array<{ lat: number; lng: number; ele?: number }>;
  estimatedDistance: number;
  estimatedDuration: number;
  elevationGain: number;
  storyBeats: Array<{
    progress: number;
    label: string;
    type: "climb" | "sprint" | "drop" | "rest";
  }>;
};

/**
 * Initialize Gemini client
 */
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Enhanced system prompt for route generation
 */
const ROUTE_GENERATION_PROMPT = `You are an expert cycling route designer and fitness coach specializing in indoor spin classes with immersive virtual route experiences.

Your task is to generate realistic, engaging cycling routes based on user descriptions. Each route should:
1. Match the requested theme, location, and intensity
2. Include realistic elevation changes that create dramatic fitness experiences
3. Identify key "story beats" - moments of high intensity, climbs, descents, or recovery
4. Balance difficulty with achievable fitness goals

When generating coordinates:
- Create 80-120 points for smooth route visualization
- Make elevation changes realistic (climbs 3-15% grade, descents 2-10% grade)
- Ensure total distance matches duration at typical spin class speeds (25-35 km/h avg)
- Place story beats at natural high points, steep sections, or dramatic moments

Route difficulty guidelines:
- Easy: Mostly flat, gentle rolling hills, avg 1-2% grade
- Moderate: Mixed terrain, 2-4 climbs, avg 3-5% grade on climbs
- Hard: Sustained climbs, multiple steep sections, avg 6-12% grade on climbs

Respond ONLY with valid JSON in this exact format:
{
  "name": "Route name (3-5 words, evocative)",
  "description": "Engaging 1-2 sentence description emphasizing atmosphere and challenge",
  "coordinates": [
    {"lat": 34.0522, "lng": -118.2437, "ele": 50},
    ...more points
  ],
  "estimatedDistance": 42.5,
  "estimatedDuration": 45,
  "elevationGain": 650,
  "storyBeats": [
    {"progress": 0.25, "label": "Coastal Ascent", "type": "climb"},
    {"progress": 0.65, "label": "Canyon Sprint", "type": "sprint"}
  ]
}`;

/**
 * Generate route using Gemini AI
 */
export async function generateRouteWithGemini(
  request: RouteRequest
): Promise<RouteResponse> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const userPrompt = `Generate a cycling route with these specifications:

Description: ${request.prompt}
Duration: ${request.duration} minutes
Difficulty: ${request.difficulty}
${request.preferences ? `Additional preferences: ${request.preferences}` : ""}

Requirements:
- Create a route that matches the description's theme and location
- Total distance should be appropriate for ${request.duration} minutes at spin class pace (25-35 km/h average)
- Elevation profile should match "${request.difficulty}" difficulty
- Include 2-4 story beats at dramatic moments
- Ensure coordinates follow a logical geographic path

Remember: Respond ONLY with the JSON object, no markdown formatting or extra text.`;

  try {
    const result = await model.generateContent([
      { text: ROUTE_GENERATION_PROMPT },
      { text: userPrompt },
    ]);

    const response = result.response;
    const text = response.text();

    // Parse JSON response (handle potential markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON response from Gemini");
    }

    const route = JSON.parse(jsonMatch[0]) as RouteResponse;

    // Validate response structure
    if (!route.name || !route.coordinates || !Array.isArray(route.coordinates)) {
      throw new Error("Invalid route structure from Gemini");
    }

    // Ensure all coordinates have valid lat/lng
    route.coordinates = route.coordinates.map((coord) => ({
      lat: Number(coord.lat),
      lng: Number(coord.lng),
      ele: coord.ele !== undefined ? Number(coord.ele) : undefined,
    }));

    // Ensure story beats have valid types
    if (route.storyBeats) {
      route.storyBeats = route.storyBeats.filter(
        (beat) =>
          beat.type === "climb" ||
          beat.type === "sprint" ||
          beat.type === "drop" ||
          beat.type === "rest"
      );
    }

    return route;
  } catch (error) {
    console.error("Gemini route generation error:", error);
    throw new Error(
      `Failed to generate route: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Generate narrative description using Gemini
 */
export async function generateNarrativeWithGemini(
  elevationProfile: number[],
  theme: string,
  duration: number
): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const minEle = Math.min(...elevationProfile);
  const maxEle = Math.max(...elevationProfile);
  const elevationGain = maxEle - minEle;
  const hasSignificantClimb = elevationGain > 100;

  const prompt = `You are a creative cycling instructor writing an immersive route description.

Theme: ${theme}
Duration: ${duration} minutes
Elevation change: ${elevationGain}m (${hasSignificantClimb ? "significant climbing" : "mostly flat"})

Write a compelling 2-3 sentence description that:
1. Captures the atmosphere and visual theme (${theme})
2. Hints at the physical challenge level
3. Creates excitement and anticipation
4. Uses vivid, sensory language

Examples of good descriptions:
- "A 45-minute cyberpunk odyssey through neon-lit cityscapes, ascending through data streams to skyline peaks where digital rain falls in cascades of light."
- "Experience the serenity of mountain valleys with gentle climbs and flowing descents that mirror the natural rhythm of the alpine landscape."

Write ONLY the description, no extra text or labels:`;

  try {
    const result = await model.generateContent(prompt);
    const narrative = result.response.text().trim();
    
    // Remove quotes if present
    return narrative.replace(/^["']|["']$/g, "");
  } catch (error) {
    console.error("Gemini narrative generation error:", error);
    throw new Error(
      `Failed to generate narrative: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Chat with Gemini for general route planning questions
 */
export async function chatWithGemini(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const systemPrompt = `You are an expert cycling instructor and route designer for SpinChain, a Web3 fitness protocol. 

Your role:
- Help users plan amazing spin class routes
- Suggest route ideas based on fitness goals
- Explain route difficulty and training benefits
- Provide encouragement and expertise

Keep responses concise (2-3 sentences) and actionable.`;

  const conversationHistory = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n");

  try {
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: conversationHistory },
    ]);

    return result.response.text().trim();
  } catch (error) {
    console.error("Gemini chat error:", error);
    throw new Error(
      `Chat failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
