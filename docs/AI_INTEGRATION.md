# SpinChain: AI Integration

## AI Route Generation Features

### Overview

SpinChain's AI route generation system transforms natural language descriptions into fully-realized spin class routes with elevation profiles, story beats, and immersive visualizations.

### Key Features

#### 1. Natural Language Route Creation
Describe your ideal route in plain English, and AI generates complete route data:

**Example Prompts:**
- "A 45-minute coastal climb with ocean views starting from Santa Monica"
- "Fast urban sprint through downtown with minimal stops"
- "Beginner-friendly rolling hills for endurance training"
- "Challenging mountain ascent with valley views and steep sections"

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

#### ✅ Implemented (MVP)

- **Natural Language Input**: Describe routes in plain English
- **Automatic Route Generation**: AI creates coordinates, elevation, and story beats
- **GPX Export**: Download generated routes as standard GPX files
- **Integration with Existing UI**: Seamlessly embedded in route builder
- **Mock Implementation**: Working demo without external API dependencies
- **Unified AI Service**: Single source of truth for all AI interactions

#### 🚧 Future Enhancements (Phase 2)

- **Real Gemini API Integration**: Replace mock with actual Google Gemini API
- **Google Maps Integration**: Real-world route data and Street View preview
- **Voice Input**: Speak your route description
- **Multi-Route Series**: Generate training programs across multiple days
- **Route Optimization**: AI suggests improvements based on ride goals
- **Community Templates**: Share and discover AI-generated routes

### Configuration

#### Environment Variables

```env
# Required for production (Phase 2)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional
NEXT_PUBLIC_AI_PROVIDER=gemini  # or "openai" in future
```

#### Current Implementation

The MVP uses **mock implementations** that generate realistic routes without requiring external API keys. This allows immediate testing and development.

To switch to real Gemini API:

1. Uncomment the Gemini API code in `/app/api/ai/generate-route/route.ts`
2. Add `GEMINI_API_KEY` to your `.env.local`
3. Install `@google/generative-ai` package (already in dependencies)

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