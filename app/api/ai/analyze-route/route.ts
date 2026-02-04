/**
 * Route Analysis API
 * Analyzes a route and suggests optimal class configuration
 * Following Core Principles: Single responsibility, type-safe
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export type RouteAnalysisRequest = {
  routeName: string;
  routeDescription?: string;
  distance: number; // km
  duration: number; // minutes
  elevationGain: number; // meters
  storyBeats: Array<{
    progress: number;
    label: string;
    type: string;
  }>;
};

export type RouteAnalysisResponse = {
  suggestedName: string;
  suggestedDescription: string;
  difficulty: "easy" | "moderate" | "hard" | "extreme";
  pricingCurve: "linear" | "exponential";
  basePrice: number;
  maxPrice: number;
  aiPersonality: "zen" | "drill-sergeant" | "data";
  rewardThreshold: number;
  rewardAmount: number;
  storyBeatGuidance: Array<{
    progress: number;
    coachingStyle: string;
    intensity: "low" | "medium" | "high";
  }>;
  estimatedEffort: number;
};

export async function POST(req: NextRequest) {
  try {
    const body: RouteAnalysisRequest = await req.json();
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analyze this cycling route and suggest optimal class configuration:

Route: ${body.routeName}
Description: ${body.routeDescription || "N/A"}
Distance: ${body.distance}km
Duration: ${body.duration} minutes
Elevation Gain: ${body.elevationGain}m
Story Beats: ${body.storyBeats.length} (${body.storyBeats.map(b => b.type).join(", ")})

Provide a JSON response with these fields:
- suggestedName: Creative class name based on route characteristics
- suggestedDescription: Engaging 1-2 sentence description
- difficulty: "easy", "moderate", "hard", or "extreme" based on elevation gain per km
- pricingCurve: "linear" for steady rides, "exponential" for challenging/rare routes
- basePrice: Suggested starting price in ETH (0.01-0.05 range)
- maxPrice: Suggested max price in ETH (0.05-0.15 range)
- aiPersonality: "zen" for scenic/easy, "drill-sergeant" for hard/extreme, "data" for tech-focused
- rewardThreshold: Effort score threshold (100-250 range based on difficulty)
- rewardAmount: SPIN tokens for completion (10-50 range)
- storyBeatGuidance: Array of coaching tips for each story beat progress point
- estimatedEffort: Estimated average effort score for this route

Return ONLY valid JSON, no markdown.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse the JSON response
    let analysis: RouteAnalysisResponse;
    try {
      // Remove any markdown code blocks if present
      const jsonText = text.replace(/```json\n?|\n?```/g, "").trim();
      analysis = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("Failed to parse AI response:", text);
      // Fallback to default values
      analysis = getDefaultAnalysis(body);
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Route analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze route" },
      { status: 500 }
    );
  }
}

function getDefaultAnalysis(route: RouteAnalysisRequest): RouteAnalysisResponse {
  // Calculate difficulty based on elevation gain per km
  const elevationPerKm = route.elevationGain / route.distance;
  let difficulty: RouteAnalysisResponse["difficulty"] = "moderate";
  if (elevationPerKm < 20) difficulty = "easy";
  else if (elevationPerKm > 60) difficulty = "extreme";
  else if (elevationPerKm > 40) difficulty = "hard";

  // Pricing based on difficulty
  const basePrice = difficulty === "easy" ? 0.015 : difficulty === "moderate" ? 0.025 : 0.04;
  const maxPrice = difficulty === "easy" ? 0.05 : difficulty === "moderate" ? 0.08 : 0.12;

  // Personality based on difficulty
  const aiPersonality = difficulty === "easy" ? "zen" : difficulty === "extreme" ? "drill-sergeant" : "data";

  return {
    suggestedName: route.routeName,
    suggestedDescription: `A ${difficulty} ${route.duration}-minute ride with ${route.elevationGain}m of elevation gain.`,
    difficulty,
    pricingCurve: difficulty === "hard" || difficulty === "extreme" ? "exponential" : "linear",
    basePrice,
    maxPrice,
    aiPersonality,
    rewardThreshold: difficulty === "easy" ? 120 : difficulty === "moderate" ? 150 : difficulty === "hard" ? 180 : 220,
    rewardAmount: difficulty === "easy" ? 15 : difficulty === "moderate" ? 25 : difficulty === "hard" ? 35 : 45,
    storyBeatGuidance: route.storyBeats.map(beat => ({
      progress: beat.progress,
      coachingStyle: beat.type === "climb" ? "Encourage steady power" : beat.type === "sprint" ? "Push hard!" : "Recover and breathe",
      intensity: beat.type === "sprint" ? "high" : beat.type === "climb" ? "medium" : "low",
    })),
    estimatedEffort: difficulty === "easy" ? 130 : difficulty === "moderate" ? 160 : difficulty === "hard" ? 190 : 230,
  };
}
