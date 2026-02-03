/**
 * Next.js API Route for AI Chat
 * General purpose chat endpoint for AI interactions
 */

import { NextRequest, NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatRequest = {
  messages: ChatMessage[];
  provider: "gemini" | "openai";
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequest;
    const { messages } = body;

    // TODO: Replace with actual Gemini API integration
    const response = generateMockResponse(messages);

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { message: "Chat failed", error: String(error) },
      { status: 500 }
    );
  }
}

function generateMockResponse(messages: ChatMessage[]): string {
  const lastMessage = messages[messages.length - 1];
  
  if (!lastMessage || lastMessage.role !== "user") {
    return "How can I help you with your route planning today?";
  }

  const content = lastMessage.content.toLowerCase();

  // Simple pattern matching for demo
  if (content.includes("route") || content.includes("ride")) {
    return "I can help you create an amazing route! Tell me what kind of experience you're looking for - coastal, mountain, urban? How long should the ride be?";
  }

  if (content.includes("climb") || content.includes("hill")) {
    return "Great choice! Climbs are excellent for building strength and creating dramatic ride experiences. Would you like a gradual ascent or something more intense?";
  }

  if (content.includes("beginner") || content.includes("easy")) {
    return "For beginners, I recommend starting with 30-40 minute routes with gentle rolling terrain. Focus on building endurance before tackling big climbs.";
  }

  return "That sounds interesting! Could you tell me more about what you have in mind for this route?";
}
