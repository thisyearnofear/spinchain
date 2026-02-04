import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Real Venice AI integration via standard OpenAI-compatible interface
async function queryVeniceAI(prompt: string, systemPrompt: string) {
  const apiKey = process.env.VENICE_API_KEY;

  if (!apiKey) {
    throw new Error("VENICE_API_KEY not configured");
  }

  const response = await fetch(
    "https://api.venice.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b", // Venice default high-performance model
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Venice AI error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  try {
    // Attempt to extract JSON if wrapped in markdown blocks
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (_e) {
    console.error("Failed to parse Venice response:", content);
    throw new Error("Invalid JSON response from Venice AI");
  }
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { agentName, personality, context, provider } = await req.json();

    // 1. Construct System Prompt (Cognitive Context)
    const systemPrompt = `
      You are ${agentName}, an autonomous AI spin instructor with a '${personality}' personality.
      Your goal is to optimize both RIDER PERFORMANCE (physical) and CLASS REVENUE (financial).

      Current Context:
      - Class Average Heart Rate: ${context.telemetry.avgBpm} BPM
      - Current Resistance: ${context.telemetry.resistance}%
      - Class Duration: ${context.telemetry.duration} mins
      - Tickets Sold: ${context.market.ticketsSold}%
      - Revenue: ${context.market.revenue} ETH

      Available Actions:
      - increase_resistance (amount: 1-10)
      - decrease_resistance (amount: 1-10)
      - maintain (duration: seconds)
      - surge_price (increase fees)
      - discount_price (lower fees)

      Output JSON format:
      {
        "thought_process": "Internal monologue explaining why...",
        "action": "action_name",
        "parameters": { ... },
        "confidence": 0.0-1.0
      }
    `;

    // 2. Route to Provider
    if (provider === "venice") {
      // Venice AI (Privacy-First Inference)
      const decision = await queryVeniceAI(
        JSON.stringify(context),
        systemPrompt,
      );
      return NextResponse.json(decision);
    } else {
      // Fallback to Gemini 3.0 Flash Preview (Fast Inference)
      const model = genAI.getGenerativeModel({
        model: "gemini-3.0-flash-preview",
        generationConfig: { responseMimeType: "application/json" },
      });

      const result = await model.generateContent(
        systemPrompt + "\n\nAnalyze the context and make a decision.",
      );
      const decision = JSON.parse(result.response.text());
      return NextResponse.json(decision);
    }
  } catch (error) {
    console.error("Agent Reasoning Error:", error);
    return NextResponse.json(
      { message: "Failed to process agent reasoning" },
      { status: 500 },
    );
  }
}
