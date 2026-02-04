# SpinChain: AI Integration

## AI Route Integration - Product Design & System Architecture

### Vision

Transform SpinChain from a route creation tool into an **end-to-end AI-powered fitness experience** where routes flow seamlessly from generation → class creation → live ride → proof of effort.

---

### Current State Analysis

#### What We Have
1. **AI Route Generator** (`/routes/builder`)
   - Natural language route creation
   - Voice input capability
   - Route library with save/share
   - Beautiful UI/UX

2. **Instructor Dashboard** (`/instructor/*`)
   - Class creation wizard
   - Economic controls (pricing, rewards)
   - Revenue tracking
   - **Gap**: No route selection/integration

3. **Rider Experience** (`/rider/*`)
   - Class browsing
   - Ticket purchasing
   - Reward claiming
   - **Gap**: No route visualization during ride

4. **Smart Contracts** (Avalanche)
   - SpinClass NFT tickets
   - IncentiveEngine for rewards
   - ClassFactory for deployment
   - **Gap**: No route metadata stored

5. **Sui Move Objects**
   - High-frequency telemetry
   - Session management
   - Story beat triggers
   - **Gap**: Not connected to routes

#### What's Missing

❌ **Routes aren't connected to classes**
- Instructors create routes separately from classes
- No way to attach a route to a SpinClass contract
- Routes are isolated in local storage

❌ **Riders don't experience the route**
- Journey page is static
- No real-time route visualization during ride
- Story beats aren't triggered automatically

❌ **AI isn't used for live coaching**
- AI instructor page is a demo
- No integration with actual ride sessions
- Story beats manually triggered (not AI-driven)

---

### Proposed Architecture

#### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SPINCHAIN AI ECOSYSTEM                        │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  INSTRUCTOR  │      │    RIDER     │      │   AI AGENT   │
│  WORKFLOW    │      │  EXPERIENCE  │      │   COACHING   │
└──────────────┘      └──────────────┘      └──────────────┘
        │                     │                     │
        ├─ Generate Route     ├─ Browse Classes    ├─ Monitor Session
        ├─ Create Class       ├─ Purchase Ticket   ├─ Trigger Beats
        ├─ Attach Route       ├─ Join Live Ride    ├─ Adjust Difficulty
        └─ Deploy Contract    └─ Claim Rewards     └─ Post-Ride Analysis
      
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│  │ Avalanche  │  │    Sui     │  │  Walrus   │  │  Local   │ │
│  │ (Classes)  │  │ (Sessions) │  │  (Routes) │  │ (Library)│ │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

### Product Design: User Journeys

#### Journey 1: Instructor Creates AI-Powered Class

**Current Flow:**
1. Go to `/routes/builder` → Generate route → Save to library
2. Go to `/instructor/builder` → Create class → No route attached
3. Deploy class contract → Route information lost

**Proposed Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Generate or Select Route                            │
├─────────────────────────────────────────────────────────────┤
│ • AI Generate new route OR Browse library                   │
│ • Preview route in 3D with story beats                      │
│ • See estimated metrics (distance, duration, elevation)     │
│ • Option to edit/refine route                               │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Class Configuration (Enhanced)                      │
├─────────────────────────────────────────────────────────────┤
│ • Auto-populate class name from route                       │
│ • Auto-set duration from route estimate                     │
│ • Link route metadata to class                              │
│ • Choose AI instructor personality                          │
│ • Configure pricing + rewards                               │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Deploy to Chains                                    │
├─────────────────────────────────────────────────────────────┤
│ • Deploy SpinClass to Avalanche (with route URI)           │
│ • Upload route to Walrus (get blob ID)                     │
│ • Store route reference in contract metadata               │
│ • Create Sui Session template                              │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Pre-Class Prep                                      │
├─────────────────────────────────────────────────────────────┤
│ • View enrolled riders                                       │
│ • Preview route with AI commentary                          │
│ • Test story beat timings                                   │
│ • Activate AI co-instructor                                 │
└─────────────────────────────────────────────────────────────┘
```

**UI Changes Needed:**

1. **Instructor Builder - Step 0 (NEW)**
```tsx
<SurfaceCard eyebrow="Step 0" title="Choose Your Route">
  <div className="grid grid-cols-2 gap-4">
    <button onClick={() => setRouteSource('generate')}>
      ✨ Generate with AI
    </button>
    <button onClick={() => setRouteSource('library')}>
      📚 Browse Library
    </button>
  </div>
  
  {selectedRoute && (
    <div className="mt-4">
      <RoutePreviewCard route={selectedRoute} />
      <RouteVisualizer elevationProfile={route.elevationProfile} />
    </div>
  )}
</SurfaceCard>
```

2. **Enhanced Class Metadata**
```typescript
interface ClassMetadata {
  name: string;
  description: string;
  
  // NEW: Route information
  route: {
    id: string;              // Route library ID or generated hash
    walrusBlobId?: string;   // Decentralized storage reference
    name: string;
    distance: number;
    duration: number;
    elevationGain: number;
    storyBeats: StoryBeat[];
    theme: 'neon' | 'alpine' | 'mars';
  };
  
  // NEW: AI configuration
  ai: {
    enabled: boolean;
    personality: 'zen' | 'drill-sergeant' | 'data';
    autoTriggerBeats: boolean;
    adaptiveDifficulty: boolean;
  };
}
```

---

### Journey 2: Rider Experiences Immersive Route

**Current Flow:**
1. Go to `/rider` → See static class list
2. Purchase ticket → No preview
3. Ride happens offline → No app involvement
4. Claim rewards manually

**Proposed Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Discover Classes with Route Previews               │
├─────────────────────────────────────────────────────────────┤
│ • Browse classes with route thumbnails                      │
│ • Filter by: distance, difficulty, theme, AI instructor    │
│ • Preview route in 3D before purchasing                    │
│ • See instructor + AI personality                           │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Purchase Ticket + Pre-Ride Setup                   │
├─────────────────────────────────────────────────────────────┤
│ • Buy ticket (existing flow)                                │
│ • Download route data (cache locally)                       │
│ • Test device connection (HR monitor, etc.)                 │
│ • Set privacy preferences                                   │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Live Ride Experience (NEW PAGE)                    │
├─────────────────────────────────────────────────────────────┤
│ • Full-screen route visualization (3D)                      │
│ • Real-time progress indicator                              │
│ • Story beats triggered automatically                       │
│ • AI coaching cues (audio + visual)                         │
│ • Effort tracking (private, local)                          │
│ • Ghost riders from other sessions                          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Post-Ride + Rewards                                │
├─────────────────────────────────────────────────────────────┤
│ • Generate effort proof                                      │
│ • Claim SPIN rewards                                         │
│ • View route replay with your stats                         │
│ • Share social proof card                                   │
│ • Save ride to personal history                             │
└─────────────────────────────────────────────────────────────┘
```

**UI Changes Needed:**

1. **Enhanced Class Browser**
```tsx
// app/rider/page.tsx - Add route preview cards
<div className="grid gap-4 md:grid-cols-2">
  {classes.map(classData => (
    <ClassCard
      key={classData.id}
      class={classData}
      route={classData.route}  // NEW
      onPreview={() => showRoutePreview(classData.route)}
    />
  ))}
</div>
```

2. **New Live Ride Page** (Priority!)
```tsx
// app/rider/ride/[classId]/page.tsx (NEW FILE)
export default function LiveRidePage() {
  return (
    <div className="h-screen flex flex-col">
      {/* Full-screen 3D route */}
      <RouteVisualizer3D 
        route={route}
        progress={rideProgress}
        storyBeats={route.storyBeats}
        onBeatTrigger={handleStoryBeat}
      />
      
      {/* Overlay HUD */}
      <RideHUD
        currentSpeed={telemetry.speed}
        heartRate={telemetry.hr}
        effort={telemetry.effort}
        nextBeat={upcomingBeat}
      />
      
      {/* AI Coaching */}
      <AICoachingOverlay
        personality={instructor.ai.personality}
        message={aiMessage}
      />
    </div>
  );
}
```

---

### Journey 3: AI Agent Conducts Live Class

**Current State:**
- `/instructor/ai` page is a demo with static content
- No real integration with live sessions
- Story beats manually triggered

**Proposed Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ Pre-Class: AI Agent Preparation                             │
├─────────────────────────────────────────────────────────────┤
│ • Load route data (story beats, elevation profile)          │
│ • Load instructor personality settings                      │
│ • Generate pre-ride motivational content                    │
│ • Prepare adaptive difficulty algorithms                    │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ During Class: Real-Time Monitoring                          │
├─────────────────────────────────────────────────────────────┤
│ • Subscribe to Sui telemetry events                         │
│ • Calculate group aggregate effort                          │
│ • Trigger story beats at precise route positions           │
│ • Adjust messaging based on group performance              │
│ • Broadcast coaching cues to all riders                     │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Post-Class: Analysis & Improvement                          │
├─────────────────────────────────────────────────────────────┤
│ • Generate class summary report                             │
│ • Identify optimal story beat timings                       │
│ • Suggest route adjustments for next class                 │
│ • Create social proof cards for riders                      │
└─────────────────────────────────────────────────────────────┘
```

**Technical Implementation:**

```typescript
// app/lib/ai-coach.ts
export class AICoach {
  private route: GeneratedRoute;
  private personality: AgentPersonality;
  private session: SuiSession;
  
  async conductClass() {
    // 1. Monitor telemetry
    this.session.subscribe('telemetry', (data) => {
      const avgEffort = this.calculateGroupEffort(data);
      
      // 2. Trigger story beats
      const currentProgress = this.getRideProgress();
      const nextBeat = this.findNextBeat(currentProgress);
      
      if (this.shouldTriggerBeat(nextBeat, currentProgress)) {
        this.triggerStoryBeat(nextBeat);
        this.broadcastCoachingCue(nextBeat);
      }
      
      // 3. Adaptive difficulty
      if (avgEffort < this.targetEffort * 0.8) {
        this.adjustDifficulty('increase');
      }
    });
  }
  
  private async triggerStoryBeat(beat: StoryBeat) {
    // Emit event to Sui
    await this.session.triggerBeat(
      beat.label,
      beat.type,
      this.calculateIntensity(beat)
    );
    
    // Generate coaching message
    const message = await this.generateCoachingMessage(beat);
    
    // Broadcast to all riders
    this.broadcast('coaching', { beat, message });
  }
}
```

---

### Data Flow Architecture

#### Route Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ 1. GENERATION                                                │
├─────────────────────────────────────────────────────────────┤
│ Input: Natural language prompt                               │
│ Process: Gemini AI → Route data                             │
│ Output: GeneratedRoute object                                │
│ Storage: LocalStorage (route library)                       │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. CLASS ATTACHMENT                                          │
├─────────────────────────────────────────────────────────────┤
│ Input: GeneratedRoute + Class params                         │
│ Process: Upload to Walrus → Get blob ID                     │
│ Output: Route URI (walrus://blob_id)                        │
│ Storage: SpinClass.classMetadata (JSON with route ref)     │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. SESSION INITIALIZATION                                    │
├─────────────────────────────────────────────────────────────┤
│ Input: SpinClass contract address                           │
│ Process: Fetch metadata → Load route from Walrus           │
│ Output: Route data + Session object on Sui                 │
│ Storage: Sui Session with route reference                   │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. LIVE RIDE                                                │
├─────────────────────────────────────────────────────────────┤
│ Input: Session + Rider telemetry                            │
│ Process: Real-time progress tracking                        │
│ Output: Story beat triggers + AI coaching                   │
│ Storage: Sui events (telemetry, beats)                     │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. POST-RIDE PROOF                                          │
├─────────────────────────────────────────────────────────────┤
│ Input: Session data + Rider stats                          │
│ Process: Generate effort proof → Submit attestation        │
│ Output: SPIN rewards + Social proof card                   │
│ Storage: IncentiveEngine records + Walrus (ride history)   │
└─────────────────────────────────────────────────────────────┘
```

---

## AI Features Guide

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
- **Token ID 1..N (The Access)**: Fungible tickets for specific scheduled slots (e.g., "Monday 9am").

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

### Privacy DeFi Angle (Track 2)

We can combine this with our Privacy architecture:

- **Dark Pools for VIPs**: High-net-worth riders or celebrities can swap for tickets in a private pool where the Hook verifies a ZK Proof of "Status" without revealing their address.
- **Proof**: "I own a SpinPass > Level 50" (verified inside the Hook) -> Access granted to the VIP liquidity range.

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

---

## Agentic Finance Implementation Plan

### Mission
Deploy autonomous agents ("Coach Atlas") that manage physical class difficulty in real-time on Sui and optimize financial yield on EVM using Uniswap v4 Hooks.

### System Architecture: The "Dual-Engine"

We utilize a hybrid-chain architecture to decouple **High-Frequency State** (Biometrics/Performance) from **High-Value State** (Assets/Settlement).

#### A. Settlement Layer (EVM / Avalanche / Ethereum)
- **Role**: The "Bank" and "Identity Provider".
- **Core Assets**:
    - **Identity**: ENS (`coachatlas.eth`) bridged to app.
    - **Inventory**: Class Tickets (ERC-721).
    - **Revenue**: `$SPIN` / `USDC` Liquidity Pools.
- **The Brain (Financial)**: `DemandSurgeHook.sol`
    - Attached to Uniswap v4 Pools.
    - Read-only access to Ticket Inventory.
    - **Action**: Dynamically adjusts Swap Fees based on supply/demand curves.

#### B. Performance Layer (Sui)
- **Role**: The "Nervous System" and "Data Availability".
- **Core Objects**:
    - **Agent**: `Coach` (Shared Object). Represents the AI Instructor's current state (Mood, Tempo, Resistance).
    - **Session**: `Session` (Shared Object). Represents the live class instance.
    - **Telemetry**: `RiderStats` (Owned Object). High-frequency biometric data batches.
- **The Brain (Physical)**: AI Agent (Off-chain loop)
    - Reads `RiderStats` (Sui).
    - Writes to `Coach` (Sui) to change class difficulty.

---

### Component Design

#### 2.1 Uniswap v4 Hook (`DemandSurgeHook.sol`)
**Goal**: Maximize revenue and attendance.

| State | Condition | Fee Logic | Reasoning |
|-------|-----------|-----------|-----------|
| **Standard** | Utilization 20-80% | 0.30% | Normal market conditions. |
| **Surge** | Utilization > 80% + < 2h to start | 1.00% - 5.00% | Capture high willingness-to-pay. |
| **Fire Sale** | Utilization < 20% + < 24h to start | 0.05% | Incentivize liquidity and attendance. |

**Interface**:
```solidity
function beforeSwap(...) returns (uint24 feeOverride) {
    // 1. Get Class Inventory State
    // 2. Calculate Time-Weighted Utilization
    // 3. Return Dynamic Fee
}
```

#### 2.2 Sui Move Agent (`spinchain::spinsession`)
**Goal**: Real-time physical optimization.

**Object Structure**:
```rust
struct Coach has key, store {
    id: UID,
    personality: u8,      // 0=Zen, 1=Drill Sergeant, 2=Quant
    current_tempo: u64,   // BPM driving the music
    resistance_level: u8, // 0-100% global resistance offset
}
```

**Logic Flow**:
1. **Ingest**: Riders submit `TelemetryPoint` events (batched).
2. **Analyze**: AI (Off-chain) calculates "Class Energy".
3. **Act**: AI calls `adjust_environment(coach, new_tempo, new_resistance)`.
4. **Reflect**: Bikes subscribe to `EnvironmentChanged` events and adjust hardware resistance.

---

### Data Flow & Bridging

#### Phase 1: The Booking (EVM)
1. **Agent** creates `SpinClass` (ERC-721).
2. **Agent** initializes Uniswap v4 Pool with `DemandSurgeHook`.
3. **User** swaps `$SPIN` for Ticket (NFT). Hook optimizes price.

#### Phase 2: The Handover (Cross-Chain)
- *Mechanism*: Oracle / Message Bridge (Wormhole/LayerZero).
- **Event**: `TicketPurchased(tokenId, rider)` on EVM.
- **Action**: Agent mints `AccessPass` or updates `Session` allowlist on Sui.

#### Phase 3: The Ride (Sui)
1. **User** connects wallet to Bike.
2. **Bike** reads `Coach` object for initial settings.
3. **Loop**:
    - Bike -> Sui: `update_telemetry(...)`
    - Sui -> Agent (Off-chain): Event Indexer
    - Agent -> Sui: `adjust_environment(...)`
    - Sui -> Bike: Event Subscription

#### Phase 4: The Reward (Settlement)
1. **Class End**: Agent calculates "Effort Score" from Sui history.
2. **Bridge**: Agent posts Merkle Root of scores to EVM `IncentiveEngine`.
3. **Claim**: User claims `$SPIN` rewards on EVM.

---

### Implementation Roadmap

#### ✅ Step 1: Contracts (Foundation)
- `contracts/DemandSurgeHook.sol`: Uniswap v4 integration.
- `move/spinchain/sources/spinsession.move`: Sui state objects.

#### 🚧 Step 2: The Agent Brain (Off-Chain)
- **Service**: Node.js / Python service.
- **Inputs**:
    - EVM RPC (Poll `TicketPurchased`).
    - Sui RPC (Poll `TelemetryPoint`).
- **Outputs**:
    - EVM Wallet (Call `updateClassState` on Hook).
    - Sui Wallet (Call `adjust_environment` on Coach).

#### ⏳ Step 3: Frontend Integration
- **Dashboard**:
    - "Financial View": Uniswap Pool depth, Fee APY.
    - "Instructor View": Real-time heart rate heatmap of class.
- **Bike Interface**:
    - Simple display showing "Coach Atlas is increasing resistance...".

---

### Security & Principles

- **Enhancement First**: We use existing Uniswap liquidity rather than building a custom DEX.
- **Performance**: High-frequency data lives on Sui (cheap/fast); only final settlement hits EVM.
- **Modular**: The Hook is swappable. We can deploy a "CharityHook" or "VIPHook" without changing the core protocol.