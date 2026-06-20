# Sui Overflow 2026 — Walrus Track Submission

**Project**: SpinChain  
**Track**: Walrus (Specialized Track — $70K prize pool)  
**Secondary track eligibility**: Agentic Web (AI Coach with on-chain autonomy)  
**Deadline**: June 21, 2026  
**Submission URL**: https://www.deepsurge.xyz/hackathons/b587dc0c-4cb8-4e63-ada5-519df38103bf  

---

## Project Name

SpinChain — Walrus-as-Memory for On-Chain Fitness

## One-Line Description

SpinChain is a dual-engine fitness protocol where AI coaches run real-time biometric sessions on Sui, using Walrus as the verifiable memory layer for high-frequency telemetry data.

## Problem Statement

Fitness and biometric data is high-frequency (10Hz+), voluminous (thousands of data points per session), and privacy-sensitive. Storing this on-chain is economically infeasible. Yet the data must be verifiable, composable, and persistent — a ride's telemetry should be anchorable to an on-chain identity, retrievable by anyone with permission, and survive wallet migrations.

Existing approaches either:
- **Store everything on-chain** → prohibitive gas costs for 10Hz data
- **Store off-chain with no on-chain link** → data is unverifiable, non-composable
- **Use centralized servers** → defeats the purpose of on-chain fitness protocols

## Solution

SpinChain uses **Walrus as the memory layer** and **Sui as the settlement/identity layer**:

1. **During a ride**: 10Hz telemetry (HR, power, cadence) streams into Sui `RiderStats` Move objects via batched PTB transactions (50 points per tx, ~80% gas reduction)
2. **At ride completion**: the full telemetry time-series is uploaded to Walrus as a compressed JSON blob
3. **On-chain anchoring**: a `TelemetryAnchor` Move object is minted on Sui, storing the Walrus blob ID, storage epoch, and point count — creating a durable on-chain pointer to the off-chain data
4. **AI Coach memory**: the `Coach` Move struct has a `system_prompt_cid` field that references Walrus blobs containing the agent's behavioral logic and decision history

This creates a **"Walrus-as-Memory"** pattern: Walrus holds the heavy data, Sui holds the lightweight anchors, and the two layers compose to give verifiable, persistent, low-cost fitness data storage.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SPINCHAIN                                 │
├─────────────────────────────────────────────────────────────┤
│  Sui (Move) — Settlement & Identity Layer                    │
│  ├─ Session (shared object)                                  │
│  ├─ RiderStats (owned, 10Hz updates)                        │
│  ├─ TelemetryAnchor (owned, points to Walrus blob)          │
│  ├─ Coach (shared, AI agent with Walrus CID memory)         │
│  └─ SPIN Token (coin with buyback/burn treasury)            │
├─────────────────────────────────────────────────────────────┤
│  Walrus — Verifiable Data & Memory Layer                     │
│  ├─ Ride summaries (JSON, 90-epoch storage)                 │
│  ├─ Full telemetry time-series (compressed, delta-encoded)  │
│  ├─ Route GPX files                                          │
│  └─ AI Coach system prompts & decision logs                  │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Next.js + React Three Fiber)                      │
│  ├─ SuiEngine: session lifecycle, batched telemetry, anchor  │
│  ├─ WalrusClient: store/retrieve with aggregator failover   │
│  └─ RidePersistence: upload → anchor → save tx digest       │
└─────────────────────────────────────────────────────────────┘
```

## What's On-Chain (Sui Testnet)

| Component | Status | Details |
|-----------|--------|---------|
| `spinsession.move` | Deployed (v1) | Session, RiderStats, Coach, telemetry events |
| `TelemetryAnchor` | In source, needs upgrade deploy | New struct + `anchor_telemetry_blob` entry fn |
| `spin_token.move` | Deployed (v1) | SPIN coin with treasury, buyback/burn |
| DeepBook integration | In source | `BalanceManager` registration, limit order placement |
| Package ID | `0xc42b32ab25566a6f43db001e6f2c2fd6b2ccc7232e2af3cfca0b9beca824d7dc` | Sui testnet |

## What's On Walrus (Testnet)

| Data Type | Format | Storage Epochs |
|-----------|--------|----------------|
| Ride summaries | JSON | 90 epochs (~90 days) |
| Telemetry time-series | Compressed JSON (delta-encoded) | 90 epochs |
| Route GPX | Raw XML | 30 epochs |
| AI Coach prompts | JSON | 30 epochs |

## Why Sui + Walrus

- **Sui's parallel execution** handles independent rider telemetry transactions without contention
- **Move's resource model** ensures telemetry objects are owned and typed
- **480ms finality** enables real-time AI coach reactivity during live sessions
- **Walrus's low-cost blob storage** makes it economical to store thousands of telemetry points per ride
- **The anchor pattern** (small on-chain object → large off-chain blob) gives the best of both worlds: verifiability without prohibitive gas

## Key Code Links

- Move contracts: `contracts/move/spinchain/sources/spinsession.move`
- SuiEngine (telemetry + anchoring): `app/engines/sui-engine.ts`
- Walrus client: `app/lib/walrus/client.ts`
- Ride persistence (Walrus upload + anchor): `app/lib/walrus/ride-persistence.ts`
- Frontend wiring (ride page): `app/rider/ride/[classId]/page.tsx`
- Config: `app/config.ts` (SUI_CONFIG, package ID)

## Demo Video Script (2-3 minutes)

### Beat 1: Problem (15 sec)
"Fitness telemetry is high-frequency, voluminous, and must be verifiable. Storing it all on-chain is too expensive. Storing it off-chain with no link is unverifiable."

### Beat 2: Solution — Walrus-as-Memory (20 sec)
"SpinChain uses Walrus as the memory layer and Sui as the settlement layer. During a ride, telemetry streams to Sui Move objects. At ride end, the full dataset is uploaded to Walrus and anchored on-chain."

### Beat 3: Live Demo — Start a Ride (30 sec)
- Open the app, connect Sui wallet
- Start a practice ride (simulator mode)
- Show telemetry flowing: HR, power, cadence updating in the UI
- Mention: data is being batched into Sui PTB transactions (50 points per tx)

### Beat 4: Live Demo — Ride Complete + Walrus Upload (40 sec)
- End the ride
- Show the Walrus upload happening (console or UI indicator)
- Show the on-chain anchor transaction being submitted
- Display the TelemetryAnchor object on SuiScan with the Walrus blob ID

### Beat 5: Verify — Retrieve from Walrus (20 sec)
- Use the blob ID from the anchor to retrieve the ride data from Walrus
- Show the full telemetry time-series being read back

### Beat 6: AI Coach + Walrus Memory (20 sec)
- Show the Coach Move struct with `system_prompt_cid` field
- Explain: the AI coach's behavioral logic lives on Walrus, anchored on Sui
- This means coach memory is verifiable, composable, and survives wallet migration

### Beat 7: Why This Matters (15 sec)
"Walrus-as-Memory is a general pattern: small on-chain anchors, large off-chain verifiable data. We apply it to fitness, but it works for any high-frequency, data-heavy on-chain application."

## What's Testnet vs Mainnet-Ready

- **Testnet now**: Sui package, Walrus blobs, telemetry anchoring, AI coach
- **Mainnet path** (post-hackathon): publish Move package to mainnet, flip Walrus aggregator to mainnet, re-test end-to-end
- **100% prize unlock**: if deployed to mainnet by Aug 27 (winner announcement)

## Team

[Fill in team details]

## GitHub

https://github.com/[org]/spinchain

## Links

- Live demo: [deploy URL]
- Demo video: [video URL]
- Sui testnet package: https://suiscan.xyz/testnet/object/0xc42b32ab25566a6f43db001e6f2c2fd6b2ccc7232e2af3cfca0b9beca824d7dc
