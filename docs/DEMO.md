# SpinChain Demo Script

A 3-minute guided walkthrough for showcasing SpinChain to investors, riders, instructors, and testers.

---

## 🎯 Demo Overview

| Segment | Duration | Key Focus |
|---------|----------|-----------|
| Introduction | 30 seconds | The ownership problem & SpinChain's answer |
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

> "Think about a spin instructor who teaches six classes a week. She's built a real community — her regulars plan their Tuesdays around her. Brands have reached out. She has a following. And yet the platform she teaches on owns everything: the class recordings, the rider data, the relationship with her students. If she moves studios, she starts from zero. If the platform changes its algorithm, her income changes with it."

> "This isn't unusual. It's the norm. Peloton has 12 million members — and the instructors who built that community own none of it. Rider fitness data is worth $300–500 per person annually. The platforms capture it all. Participants capture nothing."

> "SpinChain is built to change that. Instructors own their classes. Riders own their data and earn from their effort. And Yellow Network is what makes the economics work in real time."

**Key Talking Points:**
- The core problem: platforms own everything — instructors and riders own nothing
- SpinChain flips this: class NFTs give instructors permanent revenue rights; SPIN tokens give riders real rewards for real effort
- Two reward modes: **ZK** (privacy-first, batch settlement) and **Yellow** (real-time streaming, every 10 seconds)
- Yellow is currently in β (beta)

---

### [0:30 - 1:30] Live Demo - The Ride Experience

**Step 1: The HUD (10 seconds)**

> "Here's the rider's Heads-Up Display during a class. Power, cadence, heart rate — all live. But watch the bottom section. That SPIN balance isn't decorative. It's updating in real time as the rider works."

**Point to:**
- Real-time effort score calculation
- Telemetry from the simulator (or connected BLE device)

---

**Step 2: Yellow vs ZK Rewards (15 seconds)**

> "Riders choose between two reward modes. ZK mode is privacy-first — your health data is proven on-device using zero-knowledge proofs and never leaves your phone. The chain knows you worked hard. Nobody else knows your heart rate."

> "Yellow mode solves a different problem: the waiting problem. Traditional on-chain rewards mean batching transactions, paying gas fees, and settling hours later. With Yellow, we open a state channel between the rider and the protocol. Rewards flow off-chain every 10 seconds — no gas, no delay, no batch. When the ride ends, we settle the final balance on-chain in one transaction."

**Action:**
- If not already selected, click "Yellow" mode
- Point to the ClearNode connection indicator (green = live state channel open)

> "Watch the SPIN balance in the corner. That's not a simulation — that's a live state channel update from Yellow's ClearNode."

---

**Step 3: Watch Rewards Accumulate (20 seconds)**

> "As the rider pedals, effort directly correlates to rewards. Higher power output and heart rate means more SPIN earned per interval. This isn't a points system — it's a real economic signal tied to real physical output."

> "And here's what Yellow makes possible that nothing else does: you can see your earnings grow *during* the ride. Not after. Not tomorrow. Right now. That feedback loop is what keeps riders coming back — because the reward is emotionally connected to the moment of effort. It's the difference between a loyalty programme that emails you a voucher next week and a slot machine that pays out on every pull."

**Demo Tip:**
- Let the audience watch the ticker increment in real-time for at least 10 seconds
- Mention: "Every tick is a Yellow state channel update — off-chain, zero gas, instant finality. We could never do this with raw on-chain transactions; the fees would exceed the reward value."

---

**Step 4: Ride Complete + Results (20 seconds)**

> "When the ride ends, the state channel closes and we settle on-chain in a single transaction. All those micro-updates — consolidated into one. The rider sees their final tally: effort score, duration, and total SPIN earned."

> "And on the instructor side: the class NFT they minted before this session just received its revenue split automatically. Ticket sales, replay fees, sponsor integrations — all embedded in the NFT's logic, flowing back to them permanently. Not licensed to them by a platform that can change the terms next quarter. Theirs."

**Point to:**
- SPIN earned (e.g., "18.5 SPIN") and its USD equivalent
- The settlement note: one on-chain transaction covers the entire session
- Yellow vs ZK comparison panel — use this to reinforce the trade-off story: Yellow = instant + transparent, ZK = private + batch

---

### [1:30 - 2:30] Platform Highlights & Investor Value

**Step 5: The Demo Complete Modal (30 seconds)**

> "This modal does heavy lifting for different audiences:"

**For Investors:**
- Show **Platform Statistics**: "10.2K riders, 48.7K classes, $2.4M in rewards"
- The ownership model is the moat: instructors who mint class NFTs here don't leave — their revenue logic lives on-chain, not on a platform's servers
- Yellow is the key infrastructure unlock: micro-reward streaming at scale without gas economics killing margins
- Each rider session = one on-chain settlement transaction, regardless of how many reward intervals fired during the ride

**For Riders:**
- "Connect wallet to earn real SPIN—no waiting, no batch, no gas surprises"
- Yellow means the reward you see mid-ride is the reward you get

**For Instructors:**
- "Your class NFT is yours — it earns for you whether you're teaching here, on another platform, or not teaching at all"
- Earnings tied to class performance, permanently, by code

**For Testers:**
- Connection status indicator shows ClearNode health
- Error states are clear and actionable

---

**Step 6: Technical Architecture (30 seconds)**

> "Under the hood, SpinChain uses:"

| Layer | Technology | Problem It Solves |
|-------|------------|-------------------|
| Settlement | Avalanche (C-Chain) | Fast, low-cost final settlement |
| Execution | Sui (parallel) | 1,000 riders × 10Hz telemetry at $0.72/session vs $144 on a single chain |
| Rewards | Yellow Network (state channels) | Real-time micro-rewards without per-tx gas fees |
| Privacy | ZK proofs (client-side) | Health data never leaves the device |
| Off-chain | ClearNode WebSocket | Live state channel relay between rider and protocol |

> "The Sui number is worth pausing on. Processing 10Hz biometric telemetry across 1,000 simultaneous riders on Ethereum L1 would cost over $7,000 per class. Sui's parallel object model drops that to $0.72. That 99% cost reduction isn't an optimisation — it's what makes the ownership model viable at all."

> "And Yellow completes the loop: the old model was 'ride → wait → settle → reward.' Yellow flips it to 'ride → reward → reward → reward → settle.' Riders feel it instantly. The chain only sees one event."

---

### [2:30 - 3:00] Wrap-Up

> "The fitness industry generates $96 billion annually. Almost none of that flows to the people doing the work — the instructors building communities, the riders generating the data. Helium proved a community could build a wireless network more efficiently than a telecoms company. Hivemapper is doing the same for street mapping. SpinChain applies that principle to fitness."

> "Effort becomes verifiable. Ownership becomes real. And the instructor in East London keeps what she's built — wherever she teaches next."

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
Focus on: Ownership model as moat, platform stats, Yellow infrastructure, Sui cost economics, scalability

### For Riders
Focus on: Easy onboarding, real rewards, simulator for testing, data privacy

### For Instructors
Focus on: Class NFT ownership, permanent revenue logic, earnings tied to class performance

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
