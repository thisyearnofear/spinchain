# SpinChain: Getting Started

This guide is for local development and internal testing.

Current status as of 2026-04-02:
- The app is in demo/testnet stage
- Some rider-facing views still use mock or guest data
- Reward, verifier, and workflow configuration still need launch hardening
- Do not treat this repo as production-ready without completing the launch checklist in `docs/PRODUCTION_ROADMAP.md`

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.local.template .env.local

# Start development server
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Setup

### Required Variables

```env
# WalletConnect (get from cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_id

# Venice AI (default - privacy-first, get from venice.ai)
VENICE_API_KEY=your_key

# Optional: Gemini 3 (fallback - BYOK from aistudio.google.com)
GEMINI_API_KEY=your_key

# Optional: ElevenLabs (voice synthesis)
ELEVENLABS_API_KEY=your_key
```

### Optional Variables

```env
# Sui Wallet (for instructor session creation)
SUI_WALLET_ADDRESS=0x...
SUI_PRIVATE_KEY=your_key

# Deployed Contracts (see DEPLOYMENT.md)
NEXT_PUBLIC_SUI_PACKAGE_ID=0x...
NEXT_PUBLIC_ULTRA_VERIFIER_ADDRESS=0x...
NEXT_PUBLIC_EFFORT_VERIFIER_ADDRESS=0x...
NEXT_PUBLIC_INCENTIVE_ENGINE_ADDRESS=0x...
```

---

## Current User Flows

### 1. Welcome Modal
New users see a 3-step intro focused on the product concept. This is onboarding copy, not proof that all reward and privacy flows are fully live end to end.

### 2. Guest Mode
- Skip wallet connection → "Explore as Guest"
- Access demo/practice flows without wallet connection
- Useful for local testing and product walkthroughs

### 3. First Ride Checklist
- [ ] Connect Wallet (RainbowKit)
- [ ] Link Device (BLE or Simulator)
- [ ] Complete a ride flow in demo or testnet mode

---

## Ride Experience

### Input Modes

**BLE Device** (Native Mobile)
- Connects to Schwinn IC4, Bowflex C6, HR monitors
- Uses Capacitor BLE plugin (`@capacitor-community/bluetooth-le`)
- Works on iOS, Android, Desktop Chrome

**Pedal Simulator** (No Hardware)
- Keyboard controls: Arrow keys (← / →) to pedal
- Animated crank with cadence zones
- Haptic feedback on mobile
- Generates valid telemetry for testing

### HUD Tutorial (First Ride)

Interactive 4-step overlay:
1. **Metrics Panel**: HR, Power, Cadence, Speed
2. **Effort Score**: Core metric for ZK rewards
3. **ZK Privacy Shield**: Local proof generation indicator
4. **Start Controls**: Begin session

### Story Beats

AI-detected moments trigger full-screen alerts:
- **Climb**: "Final push to the summit!"
- **Sprint**: "30-second max effort!"
- **Drop**: "Recovery spin, catch your breath"
- **Rest**: "Hydrate and prepare for next interval"

---

## Post-Ride & Rewards

### Stats Summary
- Average Heart Rate, Power, Cadence
- Effort Score (0-1000)
- Telemetry Source (Live Bike vs. Simulator)

### Claiming Rewards

The intended reward path is:

1. **ZK Proof Generation**
   - Current circuit only handles short telemetry windows
   - Full class-length proof aggregation is still a launch blocker

2. **On-Chain Settlement**
   - Avalanche Fuji/testnet oriented today
   - Runtime configuration still needs final validation

3. **Token Distribution**
   - Prototype flows exist
   - Do not assume launch-safe accounting until release gates pass

---

## Testing

### Unit Tests (Forge)

```bash
# Run all tests
forge test --root contracts/evm

# BiometricOracle tests (verbose)
forge test --root contracts/evm --match-path test/BiometricOracle.t.sol -vv
```

### ZK Circuits (Noir)

```bash
cd circuits/effort_threshold

# Compile
nargo compile

# Test
nargo test

# Generate verifier (or use CI)
nargo codegen-verifier
```

### End-to-End Simulation

```bash
# Chainlink CRE flow (with simulator data)
node scripts/simulate-cre-flow.js

# ZK Live Loop validation
npx ts-node --esm scripts/e2e-live-loop.ts
```

### Verification Summary

| Feature | Method | Status |
|---------|--------|--------|
| CRE Biometric Oracle | Manual/dev verification | Prototype |
| Confidential HTTP | Local simulation | Prototype |
| Incentive Engine | Contract + app wiring | Partial |
| ZK Circuits | Nargo | Prototype |

---

## Security: Pre-Commit Hook

Blocks accidental secret commits:

### What It Blocks
- Private keys (Sui `suiprivkey1...`, ETH 64-char hex)
- API keys (Google `AIza...`, GitHub `ghp_...`, AWS `AKIA...`)
- High-entropy `KEY=`, `SECRET=`, `TOKEN=` patterns
- `.env.local`, `.env.production`, `.env.development`

### Bypass (Emergency Only)
```bash
git commit --no-verify
```

---

## Mobile Testing

### Capacitor Setup

```bash
# Install Capacitor
pnpm add @capacitor/core @capacitor/cli
npx cap init

# Add platforms
npx cap add ios
npx cap add android

# Install BLE plugin
pnpm add @capacitor-community/bluetooth-le
```

### Test on Device

```bash
# Build and sync
pnpm run build
npx cap sync

# Open in Xcode / Android Studio
npx cap open ios
npx cap open android
```

### Browser Compatibility

| Browser | BLE Support | Notes |
|---------|-------------|-------|
| Chrome Desktop | ✅ Full | Works great |
| Safari macOS | ❌ None | Use native app |
| Safari iOS 16+ | ⚠️ Partial | Limited |
| Chrome Android | ⚠️ Partial | Varies |
| Firefox Mobile | ❌ None | Use native app |

---

## Troubleshooting

### "Wallet not connected"
- Ensure `.env.local` has `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- Check RainbowKit provider in `app/providers.tsx`

### "BLE device not found"
- Use Chrome/Edge (Firefox/Safari unsupported on web)
- Grant Bluetooth permissions in browser settings
- Ensure device is in pairing mode

### "ZK proof failed"
- Check `NEXT_PUBLIC_EFFORT_VERIFIER_ADDRESS` is set
- Verify contract deployed to correct network (Fuji)
- Ensure proof hasn't been used (replay protection)
- Be aware the current effort circuit only supports short sessions

### "Sui transaction failed"
- Check testnet SUI balance: `sui client gas`
- Request faucet: `sui client faucet`
- Verify package ID in `.env.local`

---

## Demo Script (2 Minutes)

**0:00-0:15** | Guest Mode
- Click "Guest Mode" → "Try Demo Ride"
- Show 3D route, no wallet required

**0:15-0:45** | Pedal Simulator
- Press 'W' to increase intensity
- Show metrics rising, AI coaching kicks in

**0:45-1:20** | Chainlink CRE
- Finish ride → "Verify Performance"
- Run `node scripts/simulate-cre-flow.js`
- Explain Confidential HTTP fetching private data

**1:20-1:45** | Settlement
- Show "Verified" status
- Claim SPIN rewards on Avalanche

**1:45-2:00** | Conclusion
- "Dual-engine fitness protocol"
- "Built on Chainlink, Avalanche, and Sui"
