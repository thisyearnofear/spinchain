# SpinChain — Litepaper

**Indoor cycling that respects your effort — and your data.**

SpinChain is a live fitness application for indoor cycling: real telemetry
(BLE/FTMS smart trainers) or a built-in simulator drives a 3D world, AI
coaching, and structured classes. Progression is durable and private by
default. Settlement on Avalanche is an optional layer — deployed and working
on Fuji today — that lets issuers (studios, platforms, us) recognize
verified sessions with bounded, auditable rewards.

Live app: https://spinchain.vercel.app — Code: https://github.com/thisyearnofear/spinchain

---

## 1. Problem

Two failures define the space:

1. **Fitness apps die on retention and trust.** Connected fitness is a
   ~$12–15B market growing ~9–11% CAGR, but engagement decays fast and the
   data is captive: effort history lives in vendor silos, unverifiable and
   unportable.
2. **Move-to-earn died on tokenomics.** STEPN hit ~400k DAU on
   earnings-driven demand and collapsed ~97% when new-user inflow slowed —
   proof that leading with the token produces a ponzinomic treadmill, not a
   product. The lesson the industry keeps re-learning: **if users show up
   for yield, they leave when yield slows.**

The open question isn't "can we tokenize exercise" — it's whether a fitness
product can use a chain without becoming the chain.

## 2. Thesis: receipt-first, settlement-optional

SpinChain's architecture inverts the usual pattern:

- **The product is the ride.** Effort drives the world, coaching, and
  progression in real time — no wallet required to play.
- **Records precede claims.** A completed ride produces a durable
  `RideReceiptV1` on-device (localStorage), then optionally a private
  account sync behind a granular `cloud_history` consent. The receipt is a
  record, not a certificate — it makes no verification claim it can't
  support.
- **Settlement is a layer, not the product.** A separately-governed,
  bounded redeemer contract accepts issuer-signed receipts. If the chain
  went away tomorrow, the app is unchanged.

This is deliberately conservative. Privacy boundaries ship before features
(third-party AI/voice context requires explicit `ai_voice` consent; public
personal-data publishing is disabled in code), and honest status vocabulary
is enforced: *progress saved* ≠ *verification pending* ≠ *redemption
confirmed*.

## 3. Product status — built, not proposed

- **Live app** (Vercel): BLE smart-bike ingest (Capacitor + Web Bluetooth),
  React Three Fiber 3D world driven by effort, multi-provider AI coaching
  (Venice → NVIDIA → Gemini fallback, consent-gated), instructor-led
  classes, journey/progression screens, demo mode for zero-hardware trials.
- **Engineering**: 525 unit tests, sharded Playwright E2E (~6.5 min CI),
  TypeScript-clean, Foundry-tested contracts, Supabase + Walrus storage.
- **Deployed on Avalanche Fuji** (2026-10-07):
  `ClaimRegistry` `0x53C1F0b6…64E1`, `AchievementRedeemerV2`
  `0x0F00848C…d204`, pilot asset `0x3DC82882…7243`. An issuer-signed
  EIP-712 receipt redeems against a bounded campaign; the nullifier
  registry makes replay impossible across redeemer generations. Dogfooded
  end-to-end through the production app (`docs/PHASE-5-PILOT.md`).
- **Real ZK, honestly scoped**: Noir `effort_threshold` circuit verified
  via UltraHonk (`HonkVerifier`, ~1.19M gas measured — real benchmark, not
  mock). The circuit proves effort-over-threshold on committed telemetry;
  it is a future privacy layer over issuer commitments, not load-bearing
  today.
- **Verification-provider interface** (phase 3): providers attest to what
  they actually saw — `spinchain.cloud-observed.v1` approves
  server-observed rides today; studio/wearable providers plug into the
  same interface. Every attestation carries its trust statement verbatim:
  *"this ride exists in consented cloud history; its telemetry was not
  independently verified."*

## 4. How Avalanche is used

```
ride (device/sim) → local receipt → consent → cloud sync
                 → verification provider → issuer signature (EIP-712)
                 → AchievementRedeemerV2.redeem() → ClaimRegistry nullifier
                 → campaign budget → recipient
```

- **Issuer-signed receipts** (EIP-712, domain-bound to chain + contract)
  let any authorized issuer — a studio, a league, us — recognize sessions
  under an explicit policy hash.
- **Campaigns are bounded**: funded budgets, per-user caps, expiry windows,
  pause + issuer-rotation controls, gas-payer allowlist. No unbounded
  minting, no emission treadmill.
- **ClaimRegistry survives redeploys** — consumed nullifiers are forever,
  so upgrading the redeemer never resets replay protection.

### Why Avalanche specifically

Sub-second finality and sub-cent fees make per-ride micro-redemptions
viable where L1 Ethereum pricing cannot. EVM tooling is mature (Foundry,
viem, RainbowKit all in production use here), and C-chain + L1/subnet paths
give a credible route if a multi-studio settlement network ever justifies
its own chain.

## 5. What we are NOT claiming

- No physical-world provenance yet: `device-observed` means a device
  reported telemetry, not that a human pedaled. Studio/wearable
  attestation is the next honesty tier.
- No value-bearing token: the pilot asset is testnet PSPIN, worthless by
  construction. Any real-asset economics need jurisdictional + platform
  review first.
- No health/diagnostic claims: effort scores are game mechanics, not
  medical measurements.

## 6. Roadmap (grant-relevant)

| Milestone | Deliverable |
|---|---|
| M1 — Device-validated loop | Real BLE smart-trainer rides end-to-end; `device-observed` provenance exercised on physical hardware |
| M2 — Studio-attested pilot | A studio/wearable provider implementation signing sessions it witnessed; `provider-attested` provenance live |
| M3 — Pilot cohort | 10+ riders complete real rides → issuer-signed receipts → Fuji redemptions; retention/"want again" readout |

## 7. Team

<!-- Fill before submission: names, roles, links, relevant background. -->

Founder/operator: [name] — full-stack + contracts (the repo is public and
the commit history shows a solo-shipped product incl. deployment, CI, ZK
pipeline).

## 8. Links

- App: https://spinchain.vercel.app
- Demo ride: https://spinchain.vercel.app/rider/ride/demo?mode=practice&demo=true&auto=true
- Repo: https://github.com/thisyearnofear/spinchain
- Fuji contracts + deployment record: `docs/PHASE-5-PILOT.md`
