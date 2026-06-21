# Sui Overflow 2026 — Walrus Track Submission

**Project**: SpinChain  
**Track**: Walrus (Specialized Track — $70K prize pool)  
**Secondary track eligibility**: Agentic Web (AI Coach with on-chain autonomy), Entertainment & Culture  
**Deadline**: June 21, 2026 (build window closes)  
**Demo Day**: Jul 20-21, 2026 · Winners announced Aug 27  
**Submission URL**: https://overflow.sui.io  

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
│  ├─ RiderStats (owned, 10Hz updates)                         │
│  ├─ TelemetryAnchor (owned, points to Walrus blob)           │
│  ├─ Coach (shared, AI agent with Walrus CID memory)          │
│  └─ SPIN Token (coin with buyback/burn treasury)             │
├─────────────────────────────────────────────────────────────┤
│  Walrus — Verifiable Data & Memory Layer                     │
│  ├─ Ride summaries (JSON, 90-epoch storage)                  │
│  ├─ Full telemetry time-series (compressed, delta-encoded)   │
│  ├─ Route GPX files                                          │
│  └─ AI Coach system prompts & decision logs                  │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Next.js + React Three Fiber)                      │
│  ├─ SuiEngine: session lifecycle, batched telemetry, anchor  │
│  ├─ WalrusClient: store/retrieve with aggregator failover    │
│  └─ RidePersistence: upload → anchor → save tx digest        │
└─────────────────────────────────────────────────────────────┘
```

## What's On-Chain (Sui Testnet, live now)

| Component | Status | Details |
|-----------|--------|---------|
| `spinsession` module | **Deployed v2** | Session, RiderStats, Coach, TelemetryAnchor, telemetry events |
| `spin_token` module | **Deployed v2** | SPIN coin with treasury, buyback/burn, claim_for_bridge |
| `anchor_telemetry_blob` entry | **Live** | `sui client call --package 0x51542d… --module spinsession --function anchor_telemetry_blob` |
| `TelemetryBlobAttached` event | **Live** | Emitted on every anchor; queryable via `suix_queryEvents` |
| `TelemetryAnchor` object | **Live** | Owned by caller, links rider → Walrus blob ID + epoch + point count |
| Package ID (v2, current) | `0x51542d1d4b43763d58e6f91f845f63157d5fc59bd95ead54dc370b0898d1185c` | Sui testnet, upgrade-tx `350668558` |
| Package ID (v1, original) | `0x98144f86c83bf486d90232833a6ed467aa3d853d237126537241a6e147f2b3f6` | Preserved as `original-id` in `Published.toml` |

### Live on-chain evidence (smoke-test anchor, 2026-06-20)

```bash
$ sui client call --package 0x51542d1d… --module spinsession --function anchor_telemetry_blob \
    --args "smoketest-class-1781954292" "smoketest_blob_1781954292" 90 5 1781954292 \
    --gas-budget 10000000

Status: Success
Owner:  0x9018a50508af247c8ef949a6fd6522fc0b7f6652a9d07a2b108d748728f7b73f
New object: 0x51542d1d…::spinsession::TelemetryAnchor
Gas used: 0.00323 SUI

$ curl … suix_queryEvents MoveEventType=…::TelemetryBlobAttached
{
  "anchor_id": "0x43d20ecb4cbc47ca0ab2673eedf3eccdaf561669fc42616660fa54ca351547d4",
  "rider":     "0x9018a50508af247c8ef949a6fd6522fc0b7f6652a9d07a2b108d748728f7b73f",
  "blob_id":   "smoketest_blob_1781954292",
  "class_id":  "smoketest-class-1781954292",
  "epoch":     90
}
```

## What's On Walrus (Testnet)

| Data Type | Format | Storage Epochs |
|-----------|--------|----------------|
| Ride summaries | JSON | 90 epochs (~90 days) |
| Telemetry time-series | Compressed JSON (delta-encoded) | 90 epochs |
| Route GPX | Raw XML | 30 epochs |
| AI Coach prompts | JSON | 30 epochs |

Walrus client uses **aggregator failover** (`aggregator.walrus-testnet.walrus.space` + `aggregator2.walrus-testnet.walrus.space`) so a single aggregator outage doesn't break ride persistence.

## Why Sui + Walrus

- **Sui's parallel execution** handles independent rider telemetry transactions without contention
- **Move's resource model** ensures telemetry objects are owned and typed
- **480ms finality** enables real-time AI coach reactivity during live sessions
- **Walrus's low-cost blob storage** makes it economical to store thousands of telemetry points per ride
- **The anchor pattern** (small on-chain object → large off-chain blob) gives the best of both worlds: verifiability without prohibitive gas

## What makes this an honest Walrus Track entry (not a wrapper)

- **Walrus is the primary store** for ride summaries, telemetry time-series, route GPX, and AI coach prompts. The on-chain Move objects stay small and reference verifiable Walrus blobs. We do not parallel-implement an Sui/IPFS fallback for the same data.
- **The anchor IS the data**: a `TelemetryAnchor` object without its Walrus blob is useless. The on-chain ID is a pointer, not a copy. This is the right cost/permanence trade-off.
- **Coach agent memory is on Walrus**: the `Coach.system_prompt_cid` field means an AI coach's behavioral logic is a Walrus blob referenced from a Sui object. Coach memory is verifiable, composable, and survives a wallet migration (the Walrus blob persists; the on-chain object just gets re-anchored).
- **Verifiable retrieval**: anyone with a `TelemetryAnchor` object can pull the Walrus blob ID, fetch the time-series from a Walrus aggregator, and reconstruct the ride. The on-chain event log is the audit trail.

## Submission narrative (paste-ready, ≤ 1000 chars)

> SpinChain is a dual-engine fitness protocol where AI coaches run real-time biometric sessions on Sui and riders are rewarded on Avalanche. Sui is the high-frequency performance layer (10Hz telemetry into Move `RiderStats` objects, batched PTB transactions). Walrus is the verifiable data and memory layer: every ride summary, every AI coach system prompt, and every coach decision is stored as a Walrus blob. A `TelemetryAnchor` Move object on Sui links the rider's wallet to the Walrus blob ID + storage epoch + point count, so the off-chain data is auditable and composable without the on-chain objects ballooning. The AI Coach in particular uses Walrus as its persistent memory: system prompts and decision logs live in Walrus, so a coach's behavioral history is verifiable and survives wallet migration. We don't wrap Walrus as a sidecar — it is the primary store for high-volume, low-cost data that would be uneconomical to keep on chain.

## Demo Video Script (2-3 minutes)

### Beat 1: Problem (15 sec)
"Fitness telemetry is high-frequency, voluminous, and must be verifiable. Storing it all on-chain is too expensive. Storing it off-chain with no link is unverifiable."

### Beat 2: Solution — Walrus-as-Memory (20 sec)
"SpinChain uses Walrus as the memory layer and Sui as the settlement layer. During a ride, telemetry streams to Sui Move objects. At ride end, the full dataset is uploaded to Walrus and anchored on-chain."

### Beat 3: Live Demo — Start a Ride (30 sec)
- Open the app at https://spinchain.vercel.app/
- Complete the rider personality quiz (3 quick questions — goal, experience, coach personality)
- See personalized hero with Coachy mascot and recommended ride
- Connect Sui wallet, start a practice ride (simulator mode)
- Show telemetry flowing: HR, power, cadence updating in the UI
- AI coaching messages appear with personality-aware prompts (drill-sergeant / zen / data)
- Mention: data is being batched into Sui PTB transactions (50 points per tx)

### Beat 4: Live Demo — Ride Complete + Walrus Upload (40 sec)
- End the ride
- Show the Walrus upload happening (console or UI indicator)
- Show the on-chain anchor transaction being submitted
- Display the TelemetryAnchor object on SuiScan with the Walrus blob ID
- Show the `TelemetryBlobAttached` event on the chain

### Beat 5: Verify — Retrieve from Walrus (20 sec)
- Use the blob ID from the anchor to retrieve the ride data from Walrus
- Show the full telemetry time-series being read back
- Verify the point count matches what was anchored on-chain

### Beat 6: AI Coach + Walrus Memory (20 sec)
- Show the Coach Move struct with `system_prompt_cid` field
- Explain: the AI coach's behavioral logic lives on Walrus, anchored on Sui
- This means coach memory is verifiable, composable, and survives wallet migration
- Note: AI coaching runs on a 3-provider fallback chain (Venice → NVIDIA NIM → Gemini) for reliability

### Beat 7: Why This Matters (15 sec)
"Walrus-as-Memory is a general pattern: small on-chain anchors, large off-chain verifiable data. We apply it to fitness, but it works for any high-frequency, data-heavy on-chain application."

## What's Testnet vs Mainnet-Ready

- **Testnet now** (live): Sui package v2, Walrus blobs, telemetry anchoring, AI coach agent, reward minting on Avalanche Fuji
- **Mainnet path** (post-hackathon, scheduled in `docs/PRODUCTION_ROADMAP.md`): publish Move package to Sui mainnet, flip Walrus aggregator to mainnet (`aggregator.walrus-mainnet.walrus.space`), deploy `IncentiveEngine.sol` to Avalanche C-Chain mainnet, re-test the full claim flow end-to-end
- **100% prize unlock**: if deployed to mainnet by Aug 27 (winner announcement), per Overflow handbook §prize terms

## Key Code Links

- Move contracts: `contracts/move/spinchain/sources/spinsession.move`, `spin_token.move`
- SuiEngine (telemetry + anchoring): `app/engines/sui-engine.ts` — `anchorTelemetryBlob()` at line 358
- Walrus client: `app/lib/walrus/client.ts` — aggregator failover
- Ride persistence (Walrus upload + anchor): `app/lib/walrus/ride-persistence.ts`
- Frontend wiring (ride page): `app/rider/ride/[classId]/page.tsx:510-530`
- Tatum RPC swap (single-file URL fallback, set `NEXT_PUBLIC_TATUM_API_KEY`): `app/sui-provider.tsx`
- Config (single SUI source of truth): `app/config.ts`

## Hackathon posture

- **Build window**: May 7 – Jun 21, 2026 (now: Jun 20, package upgraded and verified)
- **Testnet deployment posture**: required for submission; mainnet is post-hackathon work
- **Both submissions target testnet** — Tatum × Walrus (deadline already passed Jun 6) used the same code with one env-var URL swap

## GitHub

https://github.com/thisyearnofear/spinchain

## Links (to fill in at submission)

- Live demo: https://spinchain.vercel.app/
- Demo video: [video URL — record and paste]
- Sui testnet package: https://suiscan.xyz/testnet/object/0x51542d1d4b43763d58e6f91f845f63157d5fc59bd95ead54dc370b0898d1185c
- Walrus aggregator (testnet): https://aggregator.walrus-testnet.walrus.space
- Walrus event tx (anchor smoke test): https://suiscan.xyz/testnet/tx/GBQRG544QKNTvqXmioTTaKEdQjr5spCSj1ryv6NSE8ML
