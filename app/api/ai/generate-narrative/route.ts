/**
 * Next.js API Route for AI Narrative Generation
 * Generates story descriptions for routes based on elevation and theme
 */

import { NextRequest, NextResponse } from "next/server";
import { generateNarrativeWithGemini } from "@/app/lib/gemini-client";

type NarrativeRequest = {
  elevationProfile: number[];
  theme: string;
  duration: number;
  provider: "gemini" | "openai";
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NarrativeRequest;
    const { elevationProfile, theme, duration } = body;

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY not configured, using mock data");
      const narrative = generateMockNarrative(elevationProfile, theme, duration);
      return NextResponse.json({ narrative });
    }

    try {
      const narrative = await generateNarrativeWithGemini(elevationProfile, theme, duration);
      return NextResponse.json({ narrative });
    } catch (geminiError) {
      console.error("Gemini API error, falling back to mock:", geminiError);
      const narrative = generateMockNarrative(elevationProfile, theme, duration);
      return NextResponse.json({ narrative });
    }
  } catch (error) {
    console.error("Narrative generation error:", error);
    return NextResponse.json(
      { message: "Failed to generate narrative", error: String(error) },
      { status: 500 }
    );
  }
}

function generateMockNarrative(
  elevationProfile: number[],
  theme: string,
  duration: number
): string {
  const hasClimb = Math.max(...elevationProfile) - Math.min(...elevationProfile) > 100;
  
  const narratives = {
    neon: hasClimb
      ? `A ${duration}-minute cyberpunk odyssey through neon-lit cityscapes. The route begins in the electric depths of the grid, ascending through data streams to the skyline peaks where digital rain falls in cascades of light.`
      : `A high-energy ${duration}-minute sprint through the neon underbelly. Pulse-pounding intervals sync with the city's electric heartbeat as you navigate the glowing corridors of the cyber-metropolis.`,
    alpine: hasClimb
      ? `A ${duration}-minute ascent through pristine mountain wilderness. Starting in misty valleys, you'll climb through alpine meadows to breathtaking summit views, where eagles soar and the air is crisp with possibility.`
      : `A scenic ${duration}-minute journey through rolling alpine terrain. Experience the serenity of mountain valleys, with gentle climbs and flowing descents that mirror the natural rhythm of the landscape.`,
    mars: hasClimb
      ? `A ${duration}-minute expedition across the red planet's dramatic terrain. Climb from the rusty valleys through ancient impact craters to the towering volcanic peaks, where the horizon glows with otherworldly beauty.`
      : `A ${duration}-minute traverse of Mars' mysterious plains. Navigate the crimson landscape with its rolling dunes and scattered rock formations, feeling the isolation and wonder of an alien world.`,
  };

  return narratives[theme as keyof typeof narratives] || narratives.neon;
}
