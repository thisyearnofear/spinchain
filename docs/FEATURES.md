# SpinChain: Features

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

#### 4. Real-Time Coaching
```typescript
const coaching = await getCoachingWithGemini({
  riderHeartRate: 165,
  targetHeartRate: 160,
  workoutProgress: 0.65
});
// Returns adaptive coaching messages
```

#### 5. Agent Reasoning
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
- **Ghost Riders**: Social presence (privacy-preserving)
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
- Schwinn IC4, Bowflex C6
- FTMS-compatible equipment
- Heart rate monitors

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
- See estimated rewards

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

---

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
