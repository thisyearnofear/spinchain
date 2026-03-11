# SpinChain Demo Script

A 3-minute guided walkthrough for showcasing SpinChain to investors, riders, instructors, and testers.

---

## 🎯 Demo Overview

| Segment | Duration | Key Focus |
|---------|----------|-----------|
| Introduction | 30 seconds | Platform vision & Yellow integration |
| Live Demo | 2 minutes | Rider experience with real-time rewards |
| Wrap-up | 30 seconds | Technical highlights & next steps |

---

## 📋 Pre-Demo Setup

### Quick Start (30 seconds)

```bash
# Start the dev server
cd spinchain
pnpm install
pnpm run dev
```

### Demo URL (auto-configured)
Navigate to:
```
http://localhost:3000/rider/ride/demo?mode=practice&demo=true&auto=true&name=Investor+Demo&instructor=Atlas&date=2026-03-11
```

This URL automatically:
- ✅ Enables practice mode (no wallet required)
- ✅ Starts the simulator
- ✅ Auto-begins the ride

---

## ⏱️ 3-Minute Demo Script

### [0:00 - 0:30] Introduction

**Slide: Landing Page**

> "SpinChain is a fitness protocol that turns every workout into rewards. We're building on Avalanche for fast settlement and Sui for parallel execution. And at the heart of our rewards system is Yellow Network—enabling real-time streaming rewards via state channels."

**Key Talking Points:**
- Cross-chain architecture: Avalanche + Sui
- Two reward modes: **ZK** (privacy-first) and **Yellow** (real-time streaming)
- Yellow is currently in β (beta)

---

### [0:30 - 1:30] Live Demo - The Ride Experience

**Step 1: The HUD (10 seconds)**

> "Here's the rider's Heads-Up Display during a class. You see power, cadence, heart rate—all live. But watch this bottom section..."

**Point to:**
- Real-time effort score calculation
- Telemetry from the simulator (or connected BLE device)

---

**Step 2: Yellow vs ZK Rewards (15 seconds)**

> "Riders can choose between two reward modes. ZK mode uses zero-knowledge proofs for privacy—your health data never leaves the device. But Yellow mode is where it gets exciting."

**Action:**
- If not already selected, click "Yellow" mode
- Point to the indicator showing ClearNode connection

> "Yellow streams rewards in real-time—every 10 seconds you see your SPIN balance tick up. That's instant gratification versus waiting for batch settlement."

---

**Step 3: Watch Rewards Accumulate (20 seconds)**

> "As the rider pedals, effort directly correlates to rewards. Higher power + heart rate = more SPIN. Let it run for a moment and watch..."

**Demo Tip:**
- Let the audience see the ticker increment in real-time
- Mention: "This is running on Yellow's state channels—off-chain, low fees, instant finality"

---

**Step 4: Ride Complete + Results (20 seconds)**

> "When the ride ends, we show the summary. Here's the effort score, duration, and rewards earned."

**Point to:**
- SPIN earned (e.g., "18.5 SPIN")
- USD equivalent value
- Yellow vs ZK comparison explaining each mode

---

### [1:30 - 2:30] Platform Highlights & Investor Value

**Step 5: The Demo Complete Modal (30 seconds)**

> "This modal does heavy lifting for different audiences:"

**For Investors:**
- Show **Platform Statistics**: "10.2K riders, 48.7K classes, $2.4M in rewards"
- Yellow integration = real-time streaming at scale

**For Riders:**
- "Connect wallet to earn real SPIN"
- Instant rewards via Yellow

**For Instructors:**
- "Book live classes with top instructors"
- Earnings tied to class performance

**For Testers:**
- Connection status indicator shows ClearNode health
- Error states are clear and actionable

---

**Step 6: Technical Architecture (30 seconds)**

> "Under the hood, SpinChain uses:"

| Layer | Technology |
|-------|------------|
| Settlement | Avalanche (C-Chain) |
| Execution | Sui (parallel) |
| Rewards | Yellow Network (state channels) |
| Privacy | ZK proofs (client-side) |
| Off-chain | ClearNode WebSocket |

> "Yellow handles micro-transactions at scale—we can stream rewards every 10 seconds without bloating the blockchain. Settlement happens on Avalanche, but the experience feels instant."

---

### [2:30 - 3:00] Wrap-Up

> "To recap: SpinChain combines fitness + crypto in a privacy-first way. Yellow makes rewards feel immediate. And the cross-chain architecture gives us scale."

**Call to Action:**
- "Try it yourself at localhost:3000"
- "Connect a wallet for real rewards"
- "Check out docs.spinchain.dev for more"

---

## 🔧 Demo Troubleshooting

| Issue | Solution |
|-------|----------|
| Simulator not starting | Add `?demo=true` to URL |
| Ride not auto-starting | Add `?auto=true` to URL |
| Yellow not connecting | Normal in demo mode—shows fallback UI |
| BLE device not found | Use simulator mode instead |

---

## 📝 Demo Variations

### For Investors
Focus on: Platform stats, Yellow infrastructure, scalability

### For Riders
Focus on: Easy onboarding, real rewards, simulator for testing

### For Instructors
Focus on: Earnings potential, class analytics, live feedback

### For Testers
Focus on: Debug panel, connection status, error handling

---

## 🔗 Key URLs

| Environment | URL |
|-------------|-----|
| Dev Server | http://localhost:3000 |
| Demo Ride | `/rider/ride/demo?mode=practice&demo=true&auto=true` |
| Yellow Docs | https://docs.yellow.org |
| Project | https://github.com/spinchain |

---

*Last updated: March 2026*
