# SpinChain: AI Integration

> **🏆 HACKATHON-READY: Powered by Gemini 3.0 Flash Preview**
> 
> This project leverages Google's latest Gemini 3.0 Flash Preview model for all AI capabilities,
> featuring enhanced reasoning, structured outputs, and real-time streaming.

## AI-Powered Fitness Platform

### Gemini 3 Integration Overview

SpinChain is built on **Google Gemini 3.0 Flash Preview**, utilizing its advanced capabilities:

- **Enhanced Reasoning**: Multi-step route generation with exercise science principles
- **Structured Outputs**: Reliable JSON responses with validation
- **Streaming Support**: Real-time generation for instant user feedback
- **Multimodal Capabilities**: Image analysis for route understanding
- **Low Latency**: Sub-second response times for interactive coaching

### AI Features Powered by Gemini 3

#### 1. Natural Language Route Generation
Transform plain English into complete cycling experiences:

**Gemini 3 Capabilities Used:**
- Complex prompt understanding with multi-constraint handling
- Geospatial reasoning for realistic coordinate generation
- Exercise physiology knowledge for proper workout structuring

**Example Prompts:**
- "A 45-minute coastal climb with ocean views starting from Santa Monica"
- "Fast urban sprint through downtown with minimal stops"
- "Beginner-friendly rolling hills for endurance training"
- "Challenging mountain ascent with valley views and steep sections"

**Technical Implementation:**
```typescript
// Model: gemini-3.0-flash-preview
// Features: JSON mode, structured output, retry logic
const route = await generateRouteWithGemini({
  prompt: "coastal sunset climb",
  duration: 45,
  difficulty: "moderate",
  theme: "coastal"
});
```

#### 2. Voice Input (Hands-Free)
Use your voice to describe routes without typing:
- Click the "Voice" button to start listening
- Speak naturally - the system captures your description
- Works in all modern browsers supporting Web Speech API
- Perfect for instructors planning while reviewing other content

#### 3. Route Library
Save and organize your favorite AI-generated routes:
- **Save**: Store routes with custom tags (climbing, long-distance, challenging)
- **Favorite**: Star your best routes for quick access
- **Search**: Find routes by name, description, or tags
- **Export**: Download your entire library as JSON
- **Browse**: Beautiful grid view with stats and previews
- **Auto-tagging**: Routes automatically tagged based on characteristics

#### 4. Enhanced Visualization
Every generated route includes:
- **3D Route Preview**: Real-time elevation visualization with theme support (neon/alpine/mars)
- **Story Beats**: AI-detected moments of high intensity (climbs, sprints, descents)
- **Difficulty Badges**: Visual indicators for easy/moderate/hard routes
- **Stat Cards**: Distance, duration, and elevation gain with icons
- **Progress Bars**: Visual representation of story beat timing

#### 5. Smart AI Integration
Powered by Google Gemini with sophisticated prompting:
- **Contextual Understanding**: AI interprets location hints, intensity levels, and preferences
- **Realistic Terrain**: Elevation profiles match real-world cycling physics
- **Story Beat Detection**: Automatic identification of dramatic route moments
- **Adaptive Difficulty**: Route complexity adjusts based on your settings

---

## AI Route Generation Integration

### Overview

This document describes the AI-powered route generation system integrated into SpinChain, inspired by the [map-agent project](https://github.com/jeantimex/map-agent).

SpinChain now features natural language route creation, allowing instructors to describe routes in plain English and have them automatically generated with elevation profiles, story beats, and GPX export capabilities.

### Architecture

#### Core Principles Applied

- **Enhancement First**: Enhanced existing route builder instead of creating new pages
- **Aggressive Consolidation**: Unified all AI services into a single module
- **DRY**: Single `AIService` class for all AI interactions
- **Clean Separation**: Clear boundaries between API layer, service layer, and UI components
- **Modular**: Independent, testable components with explicit dependencies

#### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Route Builder UI                         │
│  ┌──────────────────┐           ┌──────────────────┐       │
│  │  AI Generate Tab │           │  GPX Upload Tab  │       │
│  │ (NEW)           │           │  (Existing)      │       │
│  └──────────────────┘           └──────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                      ↓                       ↓
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  AIService (app/lib/ai-service.ts)                   │  │
│  │  - generateRoute()                                    │  │
│  │  - generateNarrative()                                │  │
│  │  - chat()                                             │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Route Generation Utils (app/lib/route-generation.ts)│  │
│  │  - convertToGpxSummary()                             │  │
│  │  - exportToGPX()                                      │  │
│  │  - downloadGPX()                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Server-Side)                   │
│  /api/ai/generate-route     - Generate routes from prompts  │
│  /api/ai/generate-narrative - Create route descriptions     │
│  /api/ai/chat               - General AI chat               │
└─────────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                External AI Provider (Gemini)                 │
└─────────────────────────────────────────────────────────────┘
```

### Usage

#### For Instructors

1. Navigate to `/routes/builder`
2. Click the **AI Generate** tab
3. Describe your route in natural language:
   - "45-minute coastal climb with ocean views"
   - "Fast urban sprint through downtown"
   - "Mountain ascent with challenging gradients"
4. Set duration and difficulty
5. Click **Generate Route**
6. Preview the route in 3D with story beats
7. Export as GPX or save to class

#### For Developers

##### Using the AI Service

```typescript
import { getAIService } from "@/app/lib/ai-service";

const aiService = getAIService();

// Generate a route
const route = await aiService.generateRoute({
  prompt: "coastal climb with ocean views",
  duration: 45,
  difficulty: "moderate",
});

// Generate narrative
const narrative = await aiService.generateNarrative(
  elevationProfile,
  "neon",
  45
);
```

##### Using the Hook

```typescript
import { useAIRoute } from "@/app/hooks/use-ai-route";

function MyComponent() {
  const { generateRoute, route, isGenerating, exportGPX } = useAIRoute();

  const handleGenerate = async () => {
    await generateRoute({
      prompt: "mountain climb",
      duration: 45,
      difficulty: "hard",
    });
  };

  return (
    <button onClick={handleGenerate} disabled={isGenerating}>
      {isGenerating ? "Generating..." : "Generate Route"}
    </button>
  );
}
```

### Features

### Gemini 3 Technical Implementation

#### API Endpoints

All AI functionality is exposed through optimized Edge API routes:

| Endpoint | Feature | Gemini 3 Capability |
|----------|---------|---------------------|
| `/api/ai/generate-route` | Route generation | Complex reasoning + JSON mode |
| `/api/ai/generate-narrative` | Narrative creation | Creative writing + context awareness |
| `/api/ai/chat` | Real-time coaching | Adaptive responses + structured output |
| `/api/ai/agent-reasoning` | Autonomous decisions | Multi-objective optimization + confidence scoring |

#### Streaming Support

Route generation supports real-time streaming for instant UX feedback:

```typescript
const stream = generateRouteStream({
  prompt: "mountain sunset",
  duration: 45,
  difficulty: "hard"
});

for await (const chunk of stream) {
  if (chunk.type === "status") {
    console.log(chunk.data.message); // "Analyzing...", "Generating..."
  }
  if (chunk.type === "complete") {
    console.log(chunk.data); // Full route object
  }
}
```

#### Structured Output with Validation

Gemini 3's JSON mode ensures reliable, parseable responses:

```typescript
// Route generation returns validated RouteResponse
interface RouteResponse {
  name: string;
  description: string;
  coordinates: Array<{ lat: number; lng: number; ele?: number }>;
  storyBeats: Array<{
    progress: number;
    label: string;
    type: "climb" | "sprint" | "drop" | "rest";
    intensity: number;
  }>;
  zones: Array<{
    name: string;
    type: "warmup" | "endurance" | "tempo" | "threshold";
    description: string;
  }>;
  // ... plus 10+ more fields
}
```

#### Real-Time Coaching Engine

Adaptive coaching based on rider telemetry:

```typescript
const coaching = await getCoachingWithGemini(
  {
    riderHeartRate: 165,
    targetHeartRate: 160,
    currentResistance: 45,
    currentCadence: 85,
    workoutProgress: 0.65,
    recentPerformance: "above",
    fatigueLevel: "moderate"
  },
  conversationHistory
);

// Returns structured coaching response
{
  message: "Great effort! Your heart rate is elevated—ease off 2% to stay in Zone 4.",
  tone: "challenging",
  action: { type: "decrease_resistance", value: 2 },
  motivation: "You're crushing this climb!",
  technique: "Relax your shoulders, breathe steadily"
}
```

#### Agent Reasoning with Confidence Scoring

Autonomous AI agents make explainable decisions:

```typescript
const decision = await agentReasoningWithGemini(
  "Coach Atlas",
  "motivational",
  {
    telemetry: { avgBpm: 155, resistance: 50, duration: 30 },
    market: { ticketsSold: 42, capacity: 50, revenue: 2.5 }
  }
);

// Returns explainable decision
{
  thoughtProcess: "Riders are performing well (155 BPM avg), but we have 8 unsold tickets with 10 mins left",
  action: "discount_price",
  parameters: { multiplier: 0.8, message: "Last chance! 20% off remaining tickets" },
  confidence: 0.87,
  reasoning: "Price reduction will likely fill remaining seats without significantly impacting revenue",
  expectedOutcome: "Sell 6-8 more tickets, total revenue increase of 15-20%"
}
```

### Gemini 3 Model Configuration

```typescript
// Optimized settings for Gemini 3.0 Flash Preview
const config = {
  model: "gemini-3.0-flash-preview",
  generationConfig: {
    temperature: 0.7,      // Balanced creativity/consistency
    topK: 40,              // Diverse token selection
    topP: 0.95,            // Nucleus sampling
    maxOutputTokens: 8192, // Allow detailed responses
    responseMimeType: "application/json" // Structured output
  }
};
```

### Error Handling & Resilience

Production-ready retry logic with exponential backoff:

```typescript
const route = await withRetry(
  () => generateRouteWithGemini(request),
  3 // Max 3 retries
);
```

### Configuration

#### Required Environment Variables

```env
# Gemini 3 API Key (required)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Venice AI for agent reasoning fallback
VENICE_API_KEY=your_venice_api_key_here
```

#### Health Check Endpoints

All API routes expose health checks:

```bash
curl /api/ai/generate-route
# { "status": "ready", "model": "gemini-3.0-flash-preview", ... }
```

---

## Agentic Finance: The Uniswap v4 Integration

### Thesis
Fitness classes are perishable inventory. AI Agents using Uniswap v4 Hooks are superior to static pricing for managing this inventory.

### The Core Primitive: SpinPacks (ERC-1155)

We treat every fitness course as a composable asset bundle called a **SpinPack**.

- **Token ID 0 (The IP)**: The "Master" NFT. Ownership of the route data, music playlist, and effort logic. Held by the Creator (Human or AI).
- **Token ID 1..N (The Access)**: Fungible tickets for individual class sessions.

**The Shift**: Instead of selling tickets via a static contract, the AI Agent creates a **Uniswap v4 Pool** for the `Access Token` vs. `$SPIN`.

### The Innovation: Dynamic Demand Hooks

We propose a custom Uniswap v4 Hook: `DemandSurgeHook.sol`.

#### The Problem
Static class pricing fails in two ways:
1. **Underpricing**: Popular classes sell out instantly, leaving value on the table (scalpers win).
2. **Overpricing**: Empty classes earn $0 because the price didn't adapt to low demand.

#### The Agentic Solution
The AI Instructor attaches a Hook to its class liquidity pool that acts as an automated market maker with "inventory awareness."

##### Hook Logic:
1. **BeforeSwap**:
    - Check `block.timestamp` vs `classStartTime`.
    - Check `pool.liquidity` (remaining tickets).
2. **Fee Adjustment**:
    - *Inventory Low + Time Near*: **Surge Mode**. Increase swap fee to 5-10%. The Agent captures premium demand.
    - *Inventory High + Time Near*: **Fire Sale Mode**. Lower swap fee to 0.01% or even offer a *negative fee* (rebate) to fill the room.
3. **AfterSwap**:
    - If the user bought a ticket, automatically check if they hold a "Membership NFT" (SpinChain Pass). If yes, rebate a portion of the fee instantly.

### The Agent Workflow

How "Coach Atlas" (our AI) actively manages liquidity:

1. **Deployment**: Atlas deploys a `SpinPack` and initializes a V4 Pool (`Ticket / ETH`) with the `DemandSurgeHook`.
2. **Liquidity Provisioning**: Atlas is the sole LP. It provides the initial 50 tickets into the pool range.
3. **Monitoring**: Atlas runs an off-chain cron job (or Sui Agent) monitoring social sentiment.
4. **Rebalancing**:
    - If a route goes viral on Twitter, Atlas calls `poolManager.modifyPosition` to concentrate liquidity at a higher price range.
    - This is **Agentic Finance**: The code acts on external signals to optimize yield.

### Technical Implementation for HackMoney

#### The `SpinHook` Contract
```solidity
// Pseudo-code for the Hackathon Hook
contract SpinHook is BaseHook {
    struct ClassState {
        uint256 startTime;
        uint256 capacity;
        uint256 sold;
    }

    mapping(PoolId => ClassState) public classes;

    function beforeSwap(...) override returns (...) {
        // 1. Calculate Time Decay
        uint256 timeRemaining = class.startTime - block.timestamp;

        // 2. Calculate Scarcity
        uint256 scarcity = (class.sold * 100) / class.capacity;

        // 3. Adjust Fee
        if (scarcity > 90) {
            return (BaseHook.Override.Fee, 50000); // 5% Surge
        } else if (timeRemaining < 1 hours && scarcity < 50) {
            return (BaseHook.Override.Fee, 100);   // 0.01% Discount
        }

        return (BaseHook.Override.None, 0);
    }
}
```

### Winning the Prize

This architecture directly addresses the Uniswap prompt:
> *"Agents that manage liquidity and execute trades onchain."*

Our AI Agents don't just "trade"; they **structure the market** for their own services, dynamically optimizing for maximum revenue and maximum attendance. It is a perfect micro-cosm of Agentic Finance.