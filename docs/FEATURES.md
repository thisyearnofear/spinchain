# SpinChain: Features

This file distinguishes between what is implemented in the current app, what is partially wired, and what is still planned.

## Current Product State

### Implemented or Partially Implemented
- Landing, rider, instructor, analytics, and route-builder screens
- Wallet connection and testnet-oriented contract configuration
- Guest/demo ride flows
- BLE/mobile scaffolding and simulator-oriented ride inputs
- Route visualization and themed ride cards
- Early AI endpoints and route-generation flows
- Noir effort-threshold prototype circuit
- Chunked ZK reward claims that batch 60-second proofs into one `IncentiveEngine` submission

### Not Yet Launch-Ready
- Fully validated production-safe reward settlement
- Real testnet verifier and engine validation for chunked proof claims
- Reliable replacement of mock data in user-facing flows
- Finalized launch verification and operational monitoring

---

## AI Integration

### Default AI: Venice AI (Privacy-First)
- Privacy-first (data not used for training)
- No setup required

**Fallback**: Gemini 3.0 Flash via BYOK

---

### AI Features

#### 1. Natural Language Route Generation
```typescript
const route = await generateRouteWithGemini({
  prompt: "45-minute coastal climb with ocean views",
  duration: 45,
  difficulty: "moderate"
});
```
Returns: GPX coordinates, elevation, story beats, 3D preview

#### 2. Voice Input (Hands-Free)
- Click "Voice" → speak naturally
- Web Speech API (all modern browsers)

#### 3. Route Library
- Save, favorite, search, export routes
- Auto-tagging based on characteristics

#### 4. Real-Time AI Coaching
- **Data-Driven Feedback**: AI monitors HR, Power, and Cadence vs. workout targets.
- **Personality Logic**:
  - **Drill Sergeant**: Pushes for higher intensity when energy reserves are high.
  - **Zen Master**: Advise recovery when entering the "red zone" (<20% W'bal).
  - **Quant Analyst**: Fine-tunes resistance for optimal power efficiency.
- **Autonomous Control**: planned direction; validate end-to-end hardware control before public launch

#### 5. W'bal Physiological Modeling
- **Anaerobic Energy Tracking**: Real-time "fuel tank" (Joules) based on Skiba (2015) model.
- **Dynamic Recovery**: Energy "recharges" when riding below Critical Power (CP).
- **Red Zone Protection**: Visual and audio alerts when anaerobic capacity is depleted.

#### 6. Virtual Shifting System
- **22-Speed Drivetrain**: Simulated 50/34 front and 11-28 rear gear ratios.
- **Keyboard/UI Shifting**: Use Arrow Up/Down to shift gears on any spin bike.
- **Physics-Based Speed**: Speed is calculated based on gear ratio, cadence, and aero drag.

#### 7. Ghost Rider & TCX Export
- **Ghost Pacer**: concept exists in the product, but historical/live data sources still need verification for launch use
- **Industry Standard Export**: export-related UX exists in parts of the app; treat as under active development until fully validated
- **High-Fidelity Recording**: data model exists, but retention/export guarantees are not yet launch-grade

#### 8. Agent Reasoning
AI instructors make explainable decisions:
- Dynamic pricing based on demand
- Liquidity management via Uniswap v4 hooks
- Confidence-scored actions

---

### API Endpoints

| Endpoint | Feature |
|----------|---------|
| `/api/ai/generate-route` | Route generation |
| `/api/ai/generate-narrative` | Route descriptions |
| `/api/ai/chat` | Real-time coaching |
| `/api/ai/agent-reasoning` | Autonomous decisions |

---

## Route Worlds (3D)

### Features
- **WebGL Rendering**: High-fidelity 3D from GPX
- **Theme Support**: Neon, Alpine, Mars
- **Ghost Riders**: prototype/experimental
- **Audio Triggers**: Synchronized interval cues
- **Voice Guidance**: Real-time coaching
- **Street View**: Google Maps Static API previews

### Story Beats
AI-detected moments:
```typescript
interface StoryBeat {
  progress: number;      // 0-100%
  type: "climb" | "sprint" | "drop" | "rest";
  intensity: number;     // 1-10
}
```

---

## Mobile & BLE

### Capacitor Native Bridge
```bash
pnpm add @capacitor-community/bluetooth-le
```

### Supported Devices
- Schwinn IC4, Bowflex C6, Keiser M3i (w/ converter)
- **FTMS (Fitness Machine Service)**: Full bi-directional resistance control
- **Cycling Power (CPS)**: Power and Cadence sensors
- **Heart Rate (HRS)**: Standard BLE chest straps and watches

### Resistance Control
SpinChain supports the **FTMS Control Point** protocol:
1. **Request Control**: AI takes ownership of the fitness machine.
2. **Set Resistance**: Logic automatically adjusts 0-100% resistance based on the workout plan.
3. **Reset**: Returns control to the user upon ride completion.

### Usage
```typescript
import { useBleData } from '@/lib/hooks/ble';

const { metrics, status, scanAndConnect } = useBleData();
```

### Device Memory
- First connection: Normal pairing
- Return visits: Quick Connect button
- Stored in localStorage (max 5 devices)

### Browser Support
| Browser | BLE |
|---------|-----|
| Chrome Desktop | ✅ Full |
| Safari iOS 16+ | ⚠️ Partial |
| Chrome Android | ⚠️ Partial |
| Firefox/Safari | ❌ Use native app |

---

## Accessibility

### Guest Mode
- No wallet required
- Try demo rides with simulator
- Intended for exploration and internal demos, not final reward claims

### Pedal Simulator
- Keyboard: Arrow keys (← / →)
- Animated crank with cadence zones
- Haptic feedback on mobile
- Generates valid telemetry

### Responsive HUD
| Device | Layout |
|--------|--------|
| Mobile Portrait | 1 primary + 2 secondary |
| Tablet Portrait | 1x4 column |
| Desktop | 2x2 grid |

**Touch**: All buttons ≥ 44x44px (Apple HIG)

### Collapsible UI Panels
Reduce visual clutter during rides by collapsing data panels:

- **Preview Badges**: Collapsed panels show key metrics at a glance (e.g., "Zone 3" for workout, "ERG" for input mode)
- **Keyboard Shortcut**: Press `C` to toggle all panels globally
- **Persistent State**: Panel states saved to localStorage and restored on reload
- **Device-Aware Defaults**: Mobile starts with focus panels collapsed; desktop starts expanded
- **Components**:
  - Workout Plan selector
  - Input Mode selector (ERG/Level/Free Ride)
  - Focus View panels (left, right, bottom)

---

## Planned / Experimental Areas

The sections below describe intended roadmap areas or experiments. Do not read them as production-complete capabilities.

## Agentic Finance (Uniswap v4)

### SpinPacks (ERC-1155)
- **Token ID 0**: Master NFT (route IP)
- **Token ID 1..N**: Access tickets

### DemandSurgeHook
Dynamic pricing based on inventory:
```solidity
function beforeSwap(...) override {
  uint256 scarcity = (sold * 100) / capacity;
  if (scarcity > 90) return 50000; // 5% surge
  if (timeRemaining < 1h && scarcity < 50) return 100; // Discount
}
```

### Agent Workflow
1. Deploy SpinPack + V4 Pool with hook
2. Provide initial liquidity
3. Monitor social sentiment
4. Rebalance based on demand

---

## Multi-Route Training

### Sequence Builder
- AI generates multi-day plans
- Progressive difficulty
- Goal-specific programs

### Walrus Storage
- Plans stored as JSON
- Persistent across devices
- Cost-efficient (off-chain)

---

## Mindbody/ClassPass Bridge

```typescript
interface MindbodyAdapter {
  pollBookings(): Promise<Booking[]>;
  mintTickets(bookings: Booking[]): Promise<TicketNFT[]>;
  generateClaimLink(booking: Booking): Promise<string>;
}
```

- Zero changes to core protocol
- Wallet-less claims via magic links

---

## Privacy Features

### Selective Disclosure
```typescript
const disclosure = new DisclosureBuilder(DEFAULT_POLICY)
  .withStatement('Completed 30-minute endurance zone')
  .withMetadata({ duration: 30, zone: 'Endurance' })
  .build();
// Reveals: effortScore, zone, duration
// Hides: maxHeartRate, raw data
```

### Privacy Policies
```typescript
const HIGH_PRIVACY = {
  privateFields: ['heartRate', 'power', 'gps'],
  revealableFields: ['effortScore', 'zone'],
};
```

### Local Oracle
- Browser-based proof generation (<1s)
- 10-minute rolling telemetry buffer
- Walrus encrypted backup
- No data leaves device without consent

---

## Yellow Network (Real-time Rewards)

### State Channel Settlement
SpinChain uses **Yellow Network** state channels to enable high-frequency reward accrual during workouts.

- **Nitro RPC**: Real-time telemetry updates via WebSocket to ClearNode.
- **Micro-Rewards**: SPIN tokens accrue every second based on effort.
- **Batch Settlement**: Instructors batch co-signed sessions on Avalanche Fuji to save up to 85% gas.
- **ERC-7715 Permissions**: One-click authorization for instructor co-signing.

See [Yellow Network Integration](./YELLOW_NETWORK.md) for full technical details.
