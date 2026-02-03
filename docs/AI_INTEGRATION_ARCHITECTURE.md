# AI Route Integration - Product Design & System Architecture

## 🎯 Vision

Transform SpinChain from a route creation tool into an **end-to-end AI-powered fitness experience** where routes flow seamlessly from generation → class creation → live ride → proof of effort.

---

## 🔄 Current State Analysis

### What We Have
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

### What's Missing

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

## 🏗️ Proposed Architecture

### System Overview

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

## 📋 Product Design: User Journeys

### Journey 1: Instructor Creates AI-Powered Class

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

## 🔗 Data Flow Architecture

### Route Lifecycle

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

### Smart Contract Updates

**1. Enhanced SpinClass.sol**

```solidity
contract SpinClass is ERC721, Ownable, ReentrancyGuard {
    // ... existing code ...
    
    // NEW: Route metadata
    struct RouteData {
        string walrusBlobId;    // Decentralized storage reference
        string name;
        uint256 distance;       // in meters
        uint256 duration;       // in seconds
        uint256 elevationGain;  // in meters
        bool aiEnabled;
        string aiPersonality;
    }
    
    RouteData public route;
    
    constructor(
        // ... existing params ...
        RouteData memory route_
    ) {
        // ... existing code ...
        route = route_;
    }
    
    function getRouteMetadata() external view returns (RouteData memory) {
        return route;
    }
}
```

**2. Enhanced Sui Session**

```move
module spinchain::spinsession {
    // ... existing code ...
    
    struct Session has key, store {
        id: UID,
        class_id: ID,
        instructor: address,
        duration: u64,
        is_active: bool,
        
        // NEW: Route integration
        route_blob_id: String,  // Walrus reference
        story_beats: vector<StoryBeat>,
        current_progress: u64,  // percentage * 100
    }
    
    struct StoryBeat has store, drop {
        progress: u64,    // percentage * 100
        label: String,
        beat_type: String,
        triggered: bool,
    }
    
    public entry fun update_progress(
        session: &mut Session,
        progress: u64,
        ctx: &mut TxContext
    ) {
        session.current_progress = progress;
        
        // Auto-trigger story beats at right time
        let beats = &mut session.story_beats;
        let i = 0;
        let len = vector::length(beats);
        
        while (i < len) {
            let beat = vector::borrow_mut(beats, i);
            if (!beat.triggered && progress >= beat.progress) {
                beat.triggered = true;
                event::emit(StoryBeatTriggered {
                    label: beat.label,
                    beat_type: beat.beat_type,
                    intensity: 5, // Could be dynamic
                });
            };
            i = i + 1;
        };
    }
}
```

---

## 🎨 UI/UX Integration Points

### Priority 1: Instructor Builder Enhancement

**File**: `app/instructor/builder/page.tsx`

```tsx
// Add Step 0: Route Selection
const [selectedRoute, setSelectedRoute] = useState<SavedRoute | null>(null);

<div className="step-container">
  {step === 0 && (
    <RouteSelectionStep
      onRouteSelected={setSelectedRoute}
      showGenerator={true}
    />
  )}
  
  {step === 1 && selectedRoute && (
    <ClassBasicsStep
      defaultName={selectedRoute.name}
      defaultDuration={selectedRoute.estimatedDuration}
      route={selectedRoute}
    />
  )}
  
  // ... other steps
</div>
```

### Priority 2: Live Ride Page

**File**: `app/rider/ride/[classId]/page.tsx` (NEW)

```tsx
export default function LiveRidePage({ params }: { params: { classId: string } }) {
  const { route, session } = useRideSession(params.classId);
  const { telemetry } = useTelemetry();
  const { aiCoach } = useAICoach(session);
  
  return (
    <RideContainer>
      <RouteVisualization3D
        route={route}
        progress={telemetry.progress}
        storyBeats={route.storyBeats}
      />
      
      <RideHUD telemetry={telemetry} />
      
      <AICoachingOverlay
        coach={aiCoach}
        session={session}
      />
    </RideContainer>
  );
}
```

### Priority 3: Class Browser with Routes

**File**: `app/rider/page.tsx`

```tsx
// Fetch classes with route metadata
const classes = useClasses(); // Enhanced to load route data

<div className="classes-grid">
  {classes.map(cls => (
    <ClassCard
      key={cls.id}
      class={cls}
      route={cls.route}
      onPreview={() => setPreviewRoute(cls.route)}
    />
  ))}
</div>

{previewRoute && (
  <RoutePreviewModal
    route={previewRoute}
    onClose={() => setPreviewRoute(null)}
    onPurchaseTicket={() => purchaseTicket(cls.id)}
  />
)}
```

---

## 📊 Data Schema Updates

### Route Library Entry

```typescript
interface SavedRoute {
  // ... existing fields ...
  
  // NEW: Deployment tracking
  deployments: Array<{
    classId: string;
    chainId: number;
    contractAddress: string;
    walrusBlobId: string;
    deployedAt: string;
    instructor: string;
  }>;
  
  // NEW: Usage analytics
  analytics: {
    timesUsed: number;
    avgRating: number;
    completionRate: number;
  };
}
```

### Class Contract Metadata

```typescript
interface ClassMetadata {
  // Existing fields
  name: string;
  description: string;
  instructor: string;
  
  // NEW: Route reference
  route: {
    walrusBlobId: string;
    sourceLibraryId?: string;  // Link back to library
    checksum: string;          // Verify integrity
  };
  
  // NEW: AI configuration
  ai: {
    enabled: boolean;
    personality: string;
    settings: Record<string, any>;
  };
}
```

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal**: Connect routes to classes

- [ ] Update `ClassFormData` to include route selection
- [ ] Add Step 0 to instructor builder (route selection)
- [ ] Implement Walrus upload for routes
- [ ] Update SpinClass contract to store route metadata
- [ ] Add route preview to class cards

**Deliverables**:
- Instructors can attach routes to classes
- Routes stored on Walrus
- Class metadata includes route reference

### Phase 2: Rider Experience (Week 2)
**Goal**: Immersive live rides

- [ ] Create `/rider/ride/[classId]` page
- [ ] Implement full-screen route visualization
- [ ] Add real-time progress tracking
- [ ] Build HUD overlay for telemetry
- [ ] Connect story beats to route progress

**Deliverables**:
- Live ride page functional
- Route visualization during ride
- Story beats trigger at correct times

### Phase 3: AI Coaching (Week 3)
**Goal**: Autonomous AI instructors

- [ ] Build `AICoach` service class
- [ ] Subscribe to Sui telemetry events
- [ ] Implement adaptive difficulty algorithms
- [ ] Create coaching message generation
- [ ] Add voice synthesis for AI cues

**Deliverables**:
- AI monitors live sessions
- Story beats triggered automatically
- Coaching cues based on group performance

### Phase 4: Polish & Analytics (Week 4)
**Goal**: Production-ready experience

- [ ] Add route replay functionality
- [ ] Implement social proof cards
- [ ] Build instructor analytics dashboard
- [ ] Add route rating/feedback system
- [ ] Performance optimization

**Deliverables**:
- Complete end-to-end flow
- Analytics for instructors
- Social sharing features

---

## 🤔 Key Design Decisions

### Decision 1: Where to Store Routes?

**Options:**
1. **LocalStorage only** (current)
   - ✅ Fast, private, no cost
   - ❌ Not accessible to riders
   - ❌ Lost if browser cache cleared

2. **Walrus + IPFS** (proposed)
   - ✅ Decentralized, permanent
   - ✅ Accessible to all users
   - ❌ Upload cost (~$0.01 per route)
   - ✅ Censorship resistant

3. **Centralized server**
   - ✅ Fast, cheap
   - ❌ Against Web3 ethos
   - ❌ Single point of failure

**Recommendation**: **Walrus + LocalStorage hybrid**
- Store in library locally (fast access, free)
- Upload to Walrus when attaching to class (permanent)
- Cache Walrus data locally for riders

### Decision 2: Real-Time vs Recorded Routes?

**Options:**
1. **Live progress tracking**
   - Requires WebSocket/SSE connection
   - Updates route visualization in real-time
   - More complex, higher latency

2. **Pre-recorded with simulated progress**
   - Simpler implementation
   - Predictable behavior
   - Still feels immersive

**Recommendation**: **Start with simulated, add live in Phase 3**

### Decision 3: AI Agent Architecture?

**Options:**
1. **Server-side agent**
   - Monitors all sessions centrally
   - Better for group coordination
   - Higher server costs

2. **Client-side agent**
   - Runs in rider's browser
   - Privacy-preserving
   - No server costs

3. **Hybrid**
   - Instructor runs agent locally
   - Broadcasts to riders

**Recommendation**: **Hybrid approach**
- Instructor's browser runs AI coach
- Coaching cues broadcast via Sui events
- Riders receive cues client-side

---

## 💡 Innovation Opportunities

### 1. Dynamic Route Adaptation
AI adjusts route difficulty mid-ride based on group performance:
```typescript
if (avgEffort < targetEffort * 0.75) {
  // Group is struggling
  aiCoach.reduceIntensity();
  aiCoach.encourageRiders();
} else if (avgEffort > targetEffort * 1.25) {
  // Group is crushing it
  aiCoach.increaseIntensity();
  aiCoach.addBonusInterval();
}
```

### 2. Ghost Rider Replays
Show previous riders on the same route as translucent avatars:
```typescript
<RouteVisualization>
  <CurrentRider position={currentProgress} />
  <GhostRiders
    replays={previousSessions}
    opacity={0.3}
  />
</RouteVisualization>
```

### 3. Social Route Challenges
Community-created routes with leaderboards:
```typescript
interface RouteChallenge {
  route: SavedRoute;
  leaderboard: Array<{
    rider: string;
    time: number;
    avgPower: number;
    date: string;
  }>;
  prize: string; // e.g., "100 SPIN"
}
```

### 4. Procedural Route Generation
AI generates infinite variations:
```typescript
const weeklyRoute = await aiService.generateRoute({
  prompt: "Generate a progressive training route for week 3 of a 12-week program",
  baseRoute: lastWeekRoute,
  progressionFactor: 1.1
});
```

---

## 📈 Success Metrics

### Instructor Adoption
- % of classes with AI-generated routes
- Avg routes per instructor
- Route reuse rate

### Rider Engagement
- Completion rate (with vs without route)
- Session duration
- Return rate

### AI Performance
- Story beat timing accuracy
- Rider satisfaction scores
- Adaptive difficulty effectiveness

---

## 🎯 Next Steps

**Immediate Actions:**
1. Review this architecture with stakeholders
2. Prioritize features for Phase 1
3. Create detailed task breakdown
4. Begin Walrus integration research

**Questions to Answer:**
- Walrus API key / setup process?
- Sui WebSocket endpoint for live events?
- Voice synthesis for AI coaching?
- Mobile app considerations?

---

**Ready to start implementation?** Let me know which phase you'd like to tackle first!
