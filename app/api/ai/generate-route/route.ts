/**
 * Next.js API Route for AI Route Generation
 * Server-side only - protects API keys
 */

import { NextRequest, NextResponse } from "next/server";

type RouteGenerationRequest = {
  prompt: string;
  preferences?: string;
  duration?: number;
  difficulty?: "easy" | "moderate" | "hard";
  provider: "gemini" | "openai";
};

// Mock implementation - replace with actual Gemini API calls
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RouteGenerationRequest;
    const { prompt, preferences, duration, difficulty } = body;

    // TODO: Replace with actual Gemini API integration
    // const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    // if (!GEMINI_API_KEY) {
    //   return NextResponse.json(
    //     { message: "Gemini API key not configured" },
    //     { status: 500 }
    //   );
    // }

    // For now, return a mock route based on the prompt
    const mockRoute = generateMockRoute(prompt, duration || 45, difficulty || "moderate");

    return NextResponse.json(mockRoute);
  } catch (error) {
    console.error("Route generation error:", error);
    return NextResponse.json(
      { message: "Failed to generate route", error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Generate a mock route for testing
 * TODO: Replace with actual Gemini API call
 */
function generateMockRoute(
  prompt: string,
  duration: number,
  difficulty: "easy" | "moderate" | "hard"
) {
  // Parse location hints from prompt
  const isCoastal = /coast|beach|ocean|sea/i.test(prompt);
  const isMountain = /mountain|climb|alpine|hill/i.test(prompt);
  const isUrban = /city|urban|downtown|street/i.test(prompt);

  // Base coordinates (Santa Monica as default)
  const baseLat = 34.0195;
  const baseLng = -118.4912;

  // Generate route points
  const numPoints = 100;
  const coordinates = [];
  let elevationGain = 0;

  for (let i = 0; i < numPoints; i++) {
    const progress = i / (numPoints - 1);
    
    // Vary the route based on prompt type
    let latOffset = 0;
    let lngOffset = 0;
    let elevation = 50;

    if (isCoastal) {
      // Follow coastline
      latOffset = Math.sin(progress * Math.PI * 2) * 0.01;
      lngOffset = progress * 0.02;
      elevation = 20 + Math.sin(progress * Math.PI * 4) * 30;
    } else if (isMountain) {
      // Climbing route
      latOffset = progress * 0.015;
      lngOffset = Math.sin(progress * Math.PI) * 0.01;
      elevation = 100 + progress * 400 + Math.sin(progress * Math.PI * 6) * 50;
    } else {
      // Default winding route
      latOffset = Math.sin(progress * Math.PI * 3) * 0.01;
      lngOffset = Math.cos(progress * Math.PI * 3) * 0.01;
      elevation = 100 + Math.sin(progress * Math.PI * 5) * 80;
    }

    coordinates.push({
      lat: baseLat + latOffset,
      lng: baseLng + lngOffset,
      ele: elevation,
    });

    if (i > 0) {
      elevationGain += Math.max(0, elevation - coordinates[i - 1].ele!);
    }
  }

  // Generate story beats based on elevation changes
  const storyBeats = [];
  for (let i = 10; i < numPoints - 10; i += 20) {
    const elevationChange =
      coordinates[i + 5].ele! - coordinates[i - 5].ele!;
    if (elevationChange > 30) {
      storyBeats.push({
        progress: i / numPoints,
        label: "Steep Climb",
        type: "climb" as const,
      });
    } else if (elevationChange < -30) {
      storyBeats.push({
        progress: i / numPoints,
        label: "Fast Descent",
        type: "drop" as const,
      });
    }
  }

  // Limit to 4 story beats
  const selectedBeats = storyBeats
    .filter((_, i) => i % 2 === 0)
    .slice(0, 4);

  return {
    name: extractRouteName(prompt),
    description: prompt,
    coordinates,
    estimatedDistance: calculateDistance(coordinates),
    estimatedDuration: duration,
    elevationGain: Math.round(elevationGain),
    storyBeats: selectedBeats,
  };
}

function extractRouteName(prompt: string): string {
  // Simple name extraction - can be enhanced
  const words = prompt.split(" ").slice(0, 4);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function calculateDistance(
  coordinates: Array<{ lat: number; lng: number }>
): number {
  let distance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const lat1 = coordinates[i - 1].lat;
    const lng1 = coordinates[i - 1].lng;
    const lat2 = coordinates[i].lat;
    const lng2 = coordinates[i].lng;

    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    distance += R * c;
  }
  return Math.round(distance * 10) / 10;
}
