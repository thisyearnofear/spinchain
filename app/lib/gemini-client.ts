/**
 * Gemini API Client
 * Server-side only - handles actual Gemini API interactions
 * 
 * HACKATHON ENHANCEMENTS:
 * - Streaming support for real-time generation
 * - Enhanced multimodal capabilities
 * - Robust error handling with retries
 * - Structured output with validation
 * - Gemini 3.0 Flash Preview optimization
 */

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

// Types
export type RouteDifficulty = "easy" | "moderate" | "hard" | "extreme";

export type RouteTheme = 
  | "coastal" 
  | "mountain" 
  | "urban" 
  | "forest" 
  | "desert" 
  | "alpine" 
  | "neon" 
  | "mars" 
  | "custom";

export type StoryBeatType = "climb" | "sprint" | "drop" | "rest" | "scenery" | "push";

export type StreamStatus = { stage: string; message: string };

export interface RouteRequest {
  prompt: string;
  duration: number;
  difficulty: RouteDifficulty;
  preferences?: string;
  theme?: RouteTheme;
  fitnessLevel?: "beginner" | "intermediate" | "advanced" | "elite";
}

export interface RouteResponse {
  name: string;
  description: string;
  coordinates: Array<{ lat: number; lng: number; ele?: number }>;
  estimatedDistance: number;
  estimatedDuration: number;
  elevationGain: number;
  elevationLoss: number;
  maxElevation: number;
  minElevation: number;
  avgGrade: number;
  maxGrade: number;
  storyBeats: Array<{
    progress: number;
    label: string;
    type: StoryBeatType;
    description?: string;
    intensity: number; // 1-10
  }>;
  weatherContext?: string;
  terrainTags: string[];
  difficultyScore: number; // 1-100
  estimatedCalories: number;
  zones: Array<{
    name: string;
    startProgress: number;
    endProgress: number;
    type: "warmup" | "endurance" | "tempo" | "threshold" | "vo2max" | "recovery";
    description: string;
  }>;
}

export interface CoachingContext {
  riderHeartRate: number;
  targetHeartRate: number;
  currentResistance: number;
  currentCadence: number;
  workoutProgress: number; // 0-1
  routeStoryBeat?: string;
  recentPerformance: "below" | "on" | "above" | "crushing";
  fatigueLevel: "low" | "moderate" | "high";
}

export interface CoachingResponse {
  message: string;
  tone: "encouraging" | "challenging" | "calm" | "energetic" | "tactical";
  action?: {
    type: "increase_resistance" | "decrease_resistance" | "maintain" | "sprint" | "recover";
    value?: number;
    duration?: number;
  };
  motivation: string;
  technique?: string;
}

export interface AgentDecision {
  thoughtProcess: string;
  action: string;
  parameters: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  expectedOutcome: string;
}

// Constants
const GEMINI_3_MODEL = "gemini-3.0-flash-preview";
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * Initialize Gemini client with optimization for Gemini 3
 */
function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Get optimized model configuration for Gemini 3
 */
function getOptimizedModel(jsonMode = false): GenerativeModel {
  const genAI = getGeminiClient();

  const config: Record<string, unknown> = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 8192,
  };

  if (jsonMode) {
    config.responseMimeType = "application/json";
  }

  return genAI.getGenerativeModel({
    model: GEMINI_3_MODEL,
    generationConfig: config,
  });
}

/**
 * Retry wrapper for async operations
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Attempt ${i + 1} failed:`, lastError.message);
      
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
      }
    }
  }

  throw lastError || new Error("Operation failed after retries");
}

/**
 * Chat with Gemini for general conversations
 */
export async function chatWithGemini(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>
): Promise<string> {
  return withRetry(async () => {
    const model = getOptimizedModel(false);
    
    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));
    
    const lastMessage = messages[messages.length - 1];
    
    const chat = model.startChat({
      history: history as Array<{ role: string; parts: Array<{ text: string }> }>,
    });
    
    const result = await chat.sendMessage(lastMessage.content);
    return result.response.text();
  });
}

/**
 * Enhanced route generation system prompt optimized for Gemini 3 reasoning
 */
const ROUTE_GENERATION_SYSTEM_PROMPT = `You are an elite cycling route architect and exercise physiologist specializing in indoor spin class experiences.

Your expertise combines:
1. **Geographic Realism**: Routes that feel authentic to their location
2. **Exercise Science**: Properly structured workouts with warmup, work intervals, and cooldown
3. **Storytelling**: Narrative arcs that keep riders engaged
4. **Gamification**: Strategic "story beats" that motivate effort

## Route Generation Principles

**Coordinates (80-120 points):**
- Create smooth, realistic paths following actual geography
- Elevation changes must be physically plausible
- Climbs: 3-15% grade (max 20% for extreme)
- Descents: 2-10% grade
- Rolling terrain: 1-5% variation

**Exercise Zones (Critical):**
Structure the workout into physiological zones:
- Warmup: 10-15% of duration, gradual ramp
- Endurance: 30-40%, sustainable effort
- Tempo: 20-25%, challenging but controlled
- Threshold/VO2max: 10-15%, peak effort intervals
- Recovery: 5-10%, between hard efforts
- Cooldown: 5-10%, gradual decrease

**Story Beats (4-6 moments):**
Each beat needs:
- Precise timing (progress 0.0-1.0)
- Compelling label (3-4 words)
- Type classification
- Intensity rating (1-10)
- Brief description

Types: climb, sprint, drop, rest, scenery, push

**Difficulty Calibration:**
- Easy: Flatter profile, longer recovery, avg grade 1-3%
- Moderate: Mixed terrain, balanced work/rest, avg grade 3-5%
- Hard: Sustained efforts, shorter recovery, avg grade 5-8%
- Extreme: Maximum challenge, minimal recovery, avg grade 8-15%

Respond with ONLY valid JSON matching the RouteResponse schema.`;

/**
 * Generate sophisticated route using Gemini 3 with enhanced capabilities
 */
export async function generateRouteWithGemini(
  request: RouteRequest
): Promise<RouteResponse> {
  return withRetry(async () => {
    const model = getOptimizedModel(true);

    const userPrompt = `Create a ${request.difficulty} cycling route with these specifications:

**Route Description**: ${request.prompt}
**Duration**: ${request.duration} minutes
**Fitness Level**: ${request.fitnessLevel || "intermediate"}
${request.theme ? `**Visual Theme**: ${request.theme}` : ""}
${request.preferences ? `**Special Preferences**: ${request.preferences}` : ""}

**Requirements:**
1. Design 80-120 coordinate points forming a realistic geographic path
2. Calculate precise elevation data (gain, loss, min, max, grades)
3. Structure into 5-6 exercise zones matching the workout arc
4. Identify 4-6 dramatic story beats with intensity ratings
5. Estimate distance based on spin class speeds (25-40 km/h avg)
6. Calculate estimated calorie burn
7. Tag with relevant terrain descriptors

**Output Format:**
{
  "name": "Evocative 3-5 word title",
  "description": "Compelling 2-3 sentence narrative",
  "coordinates": [{"lat": 34.0522, "lng": -118.2437, "ele": 50}, ...],
  "estimatedDistance": 42.5,
  "estimatedDuration": 45,
  "elevationGain": 650,
  "elevationLoss": 320,
  "maxElevation": 850,
  "minElevation": 50,
  "avgGrade": 4.2,
  "maxGrade": 12.5,
  "storyBeats": [
    {"progress": 0.15, "label": "Sunrise Climb", "type": "climb", "description": "Gradual ascent with warming legs", "intensity": 6}
  ],
  "terrainTags": ["coastal", "rolling", "scenic"],
  "difficultyScore": 65,
  "estimatedCalories": 450,
  "zones": [
    {"name": "Coastal Warmup", "startProgress": 0.0, "endProgress": 0.12, "type": "warmup", "description": "Easy spinning along the shore"}
  ]
}

Generate this route now:`;

    const result = await model.generateContent([
      { text: ROUTE_GENERATION_SYSTEM_PROMPT },
      { text: userPrompt },
    ]);

    const response = result.response;
    const text = response.text();

    // Parse and validate
    let route: RouteResponse;
    try {
      // Handle potential markdown code blocks
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                        text.match(/```\s*([\s\S]*?)\s*```/) ||
                        text.match(/\{[\s\S]*\}/);
      
      const jsonText = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
      route = JSON.parse(jsonText) as RouteResponse;
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw response:", text);
      throw new Error("Failed to parse route JSON from Gemini 3");
    }

    // Validate required fields
    if (!route.name || !Array.isArray(route.coordinates) || route.coordinates.length < 10) {
      throw new Error("Invalid route structure: missing required fields");
    }

    // Ensure numeric validation
    route.coordinates = route.coordinates.map((coord, idx) => ({
      lat: Number(coord.lat) || 34.0522,
      lng: Number(coord.lng) || -118.2437,
      ele: Number(coord.ele) || 50 + (idx * 2),
    }));

    // Calculate derived metrics if missing
    if (!route.elevationGain && route.coordinates.length > 1) {
      route.elevationGain = calculateElevationGain(route.coordinates);
    }

    if (!route.estimatedDistance && route.coordinates.length > 1) {
      route.estimatedDistance = calculateDistance(route.coordinates);
    }

    return route;
  });
}

/**
 * Streaming route generation for real-time UX
 */
export async function* generateRouteStream(
  request: RouteRequest
): AsyncGenerator<{ type: "status" | "partial" | "complete"; data: StreamStatus | RouteResponse }> {
  yield { type: "status", data: { stage: "analyzing", message: "Analyzing your route request..." } };

  try {
    yield { type: "status", data: { stage: "generating", message: "Gemini 3 is designing your route..." } };
    
    const route = await generateRouteWithGemini(request);
    
    yield { type: "status", data: { stage: "finalizing", message: "Optimizing elevation profile..." } };
    
    yield { type: "complete", data: route };
  } catch (error) {
    yield { 
      type: "status", 
      data: { 
        stage: "error", 
        message: error instanceof Error ? error.message : "Route generation failed" 
      } 
    };
    throw error;
  }
}

/**
 * Generate immersive narrative with Gemini 3 creative capabilities
 */
export async function generateNarrativeWithGemini(
  elevationProfile: number[],
  theme: string,
  duration: number,
  routeName?: string
): Promise<{ narrative: string; atmosphere: string; intensity: string }> {
  return withRetry(async () => {
    const model = getOptimizedModel(true);

    const minEle = Math.min(...elevationProfile);
    const maxEle = Math.max(...elevationProfile);
    const elevationGain = maxEle - minEle;
    const avgEle = elevationProfile.reduce((a, b) => a + b, 0) / elevationProfile.length;
    
    // Calculate grade changes
    let totalClimbing = 0;
    let totalDescent = 0;
    for (let i = 1; i < elevationProfile.length; i++) {
      const diff = elevationProfile[i] - elevationProfile[i - 1];
      if (diff > 0) totalClimbing += diff;
      else totalDescent += Math.abs(diff);
    }

    const prompt = `Create an immersive cycling route narrative using Gemini 3's creative capabilities.

**Route**: ${routeName || "Custom Route"}
**Theme**: ${theme}
**Duration**: ${duration} minutes
**Elevation**: +${Math.round(totalClimbing)}m / -${Math.round(totalDescent)}m
**Net Gain**: ${Math.round(elevationGain)}m

**Your Task**:
Write THREE distinct elements:

1. **Narrative** (2-3 sentences): Vivid, sensory description that transports the rider
2. **Atmosphere** (5-8 words): The emotional/mood descriptor (e.g., "Serene yet challenging alpine escape")
3. **Intensity** (5-8 words): The effort descriptor (e.g., "Sustained climbing with brief recovery windows")

**Style Guidelines**:
- Use active, present-tense verbs
- Include sensory details (visual, physical)
- Match the ${theme} aesthetic
- Create anticipation and motivation

**Examples**:
- Narrative: "A 45-minute cyberpunk odyssey through neon-lit cityscapes, ascending through data streams to skyline peaks where digital rain falls in cascades of light."
- Atmosphere: "High-tech urban grind with moments of zen"
- Intensity: "Rolling hills building to sustained threshold effort"

Respond with JSON:
{
  "narrative": "...",
  "atmosphere": "...",
  "intensity": "..."
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : text;
      return JSON.parse(jsonText);
    } catch {
      // Fallback to structured response
      return {
        narrative: text.trim().replace(/^["']|["']$/g, ""),
        atmosphere: `${theme} cycling experience`,
        intensity: elevationGain > 200 ? "Challenging climbs throughout" : "Moderate rolling terrain",
      };
    }
  });
}

/**
 * Real-time coaching with Gemini 3 - adaptive and contextual
 */
export async function getCoachingWithGemini(
  context: CoachingContext,
  conversationHistory: Array<{ role: "rider" | "coach"; message: string }> = []
): Promise<CoachingResponse> {
  return withRetry(async () => {
    const model = getOptimizedModel(true);

    const systemPrompt = `You are Coachy, an elite AI cycling coach powered by Gemini 3.

**Your Coaching Philosophy**:
- Read the rider's physical and mental state
- Adapt tone to their current performance
- Give specific, actionable guidance
- Balance challenge with encouragement
- Keep messages punchy (1-2 sentences max)

**Performance States**:
- "below": They need encouragement, reduce pressure
- "on": They're in the zone, maintain course
- "above": They're crushing it, push a bit more
- "crushing": They're flying, celebrate and challenge

**Tone Adaptation**:
- Use "encouraging" when rider is struggling
- Use "challenging" when they need a push
- Use "calm" during recovery
- Use "energetic" during sprints
- Use "tactical" when explaining technique

**Actions**:
- increase_resistance: When they need more challenge
- decrease_resistance: When they're struggling or in recovery
- maintain: When they're in the sweet spot
- sprint: Short high-intensity push (10-30 seconds)
- recover: Active recovery period`;

    const recentContext = conversationHistory.slice(-3);
    const historyText = recentContext.length > 0
      ? "\n**Recent Conversation**:\n" + recentContext.map(h => 
          `${h.role === "rider" ? "Rider" : "Coachy"}: ${h.message}`
        ).join("\n")
      : "";

    const prompt = `**Current Rider State**:
- Heart Rate: ${context.riderHeartRate} BPM (target: ${context.targetHeartRate})
- Resistance: ${context.currentResistance}%
- Cadence: ${context.currentCadence} RPM
- Workout Progress: ${Math.round(context.workoutProgress * 100)}%
- Performance: ${context.recentPerformance}
- Fatigue: ${context.fatigueLevel}
${context.routeStoryBeat ? `- Current Story Beat: ${context.routeStoryBeat}` : ""}

${historyText}

**Provide Coaching Response** (JSON format):
{
  "message": "Your coaching message (1-2 sentences, direct to rider)",
  "tone": "encouraging|challenging|calm|energetic|tactical",
  "action": {
    "type": "increase_resistance|decrease_resistance|maintain|sprint|recover",
    "value": number,
    "duration": number
  },
  "motivation": "One-line psychological boost",
  "technique": "Optional form cue"
}`;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: prompt },
    ]);

    const text = result.response.text();
    
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : text;
      return JSON.parse(jsonText) as CoachingResponse;
    } catch {
      // Fallback response
      return {
        message: text.trim().slice(0, 200),
        tone: "encouraging",
        motivation: "You've got this!",
      };
    }
  });
}

/**
 * Enhanced agent reasoning with Gemini 3 structured output
 */
export async function agentReasoningWithGemini(
  agentName: string,
  personality: string,
  context: {
    telemetry: { avgBpm: number; resistance: number; duration: number };
    market: { ticketsSold: number; revenue: number; capacity: number };
    recentDecisions: string[];
  }
): Promise<AgentDecision> {
  return withRetry(async () => {
    const model = getOptimizedModel(true);

    const systemPrompt = `You are ${agentName}, an autonomous AI spin instructor with a '${personality}' personality, powered by Gemini 3's reasoning capabilities.

**Your Dual Objective**:
1. Maximize rider performance and engagement
2. Optimize class revenue through dynamic pricing

**Available Actions**:
- increase_resistance: Boost workout intensity (amount: 1-10)
- decrease_resistance: Reduce intensity for recovery (amount: 1-10)
- maintain: Keep current settings (duration: seconds)
- surge_price: Increase ticket price for high demand (multiplier: 1.1-2.0)
- discount_price: Lower price to fill seats (multiplier: 0.5-0.9)
- wait: Observe before acting (duration: seconds)

**Decision Framework**:
1. Analyze rider telemetry (HR, resistance, duration)
2. Consider market conditions (tickets, revenue, capacity)
3. Review recent decisions (avoid repetition)
4. Choose optimal action with confidence score
5. Predict expected outcome

**Response Format** (JSON):
{
  "thoughtProcess": "Step-by-step reasoning (2-3 sentences)",
  "action": "action_name",
  "parameters": { "key": "value" },
  "confidence": 0.85,
  "reasoning": "Why this action optimizes both performance and revenue",
  "expectedOutcome": "Predicted result of this decision"
}`;

    const contextPrompt = `**Current Context**:
- Average Heart Rate: ${context.telemetry.avgBpm} BPM
- Current Resistance: ${context.telemetry.resistance}%
- Class Duration: ${context.telemetry.duration} mins
- Tickets Sold: ${context.market.ticketsSold}/${context.market.capacity} (${Math.round(context.market.ticketsSold/context.market.capacity*100)}%)
- Revenue: ${context.market.revenue} ETH
- Recent Actions: ${context.recentDecisions.slice(-3).join(", ") || "None"}

Analyze and make an optimal decision.`;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: contextPrompt },
    ]);

    const text = result.response.text();
    
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : text;
      const decision = JSON.parse(jsonText) as AgentDecision;
      
      // Validate confidence range
      decision.confidence = Math.max(0, Math.min(1, decision.confidence || 0.5));
      
      return decision;
    } catch {
      throw new Error("Failed to parse agent reasoning from Gemini 3");
    }
  });
}

/**
 * Multimodal route analysis - analyze route images
 */
export async function analyzeRouteImage(
  imageBase64: string,
  mimeType: string
): Promise<{
  description: string;
  terrain: string[];
  difficulty: string;
  elevationEstimate: string;
  scenicValue: number;
}> {
  return withRetry(async () => {
    const model = getOptimizedModel();

    const prompt = `Analyze this cycling route image using Gemini 3's multimodal capabilities.

Provide a JSON response with:
{
  "description": "Brief description of what the image shows",
  "terrain": ["terrain_type1", "terrain_type2"],
  "difficulty": "easy|moderate|hard|extreme",
  "elevationEstimate": "flat|rolling|hilly|mountainous",
  "scenicValue": 1-10
}`;

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { data: imageBase64, mimeType } },
    ]);

    const text = result.response.text();
    
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : text;
      return JSON.parse(jsonText);
    } catch {
      return {
        description: "Route image analyzed",
        terrain: ["unknown"],
        difficulty: "moderate",
        elevationEstimate: "rolling",
        scenicValue: 7,
      };
    }
  });
}

// Helper functions
function calculateDistance(coords: Array<{ lat: number; lng: number }>): number {
  let distance = 0;
  for (let i = 1; i < coords.length; i++) {
    const R = 6371;
    const dLat = ((coords[i].lat - coords[i-1].lat) * Math.PI) / 180;
    const dLon = ((coords[i].lng - coords[i-1].lng) * Math.PI) / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos((coords[i-1].lat * Math.PI) / 180) * 
      Math.cos((coords[i].lat * Math.PI) / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    distance += R * c;
  }
  return Math.round(distance * 10) / 10;
}

function calculateElevationGain(coords: Array<{ ele?: number }>): number {
  let gain = 0;
  for (let i = 1; i < coords.length; i++) {
    const diff = (coords[i].ele || 0) - (coords[i-1].ele || 0);
    if (diff > 0) gain += diff;
  }
  return Math.round(gain);
}

// Export all functions
export {
  getGeminiClient,
  getOptimizedModel,
  withRetry,
  calculateDistance,
  calculateElevationGain,
};
