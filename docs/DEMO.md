# SpinChain: The 3-Minute "Holy Shit" Demo

> **Rule**: This demo sells one thing — effort turns into visual power. No wallet, no ZK, no chain names until minute 2:30. See [WEDGE.md](./WEDGE.md).

## Hook (0:00 - 0:30)

> "Indoor cycling is boring. The screen just sits there. Watch this."

Click **Start Demo Ride — No Wallet Needed**. 3s activation. Pedal (← → keys if no bike).

> "Pedal harder — the world reacts. Road glows, fog thickens, camera widens. That's the whole product."

## Live Ride (0:30 - 2:00)

**Step 1: Sprint = firepower (0:30 - 1:00)**
> "Sprint. See the beam hold while you hold watts? That's your power made visible. Stop pedaling — it dies. This isn't a video. It's your legs."

**Step 2: Flow = unlock (1:00 - 1:30)**
> "Hold target for 15 seconds — flow tier rises, visuals multiply 1.5x, music lifts. Consistency unlocks the big VFX. No button. Just discipline."

**Step 3: Milestone = dopamine (1:30 - 2:00)**
> "First flow minute — badge pops, character fist-pumps. The coach notes your ride locally on this device — if you've ridden here before it can greet you with your last average next session."

## Business (2:00 - 2:40)

> "The demo is free and it's the best part. Freemium converts on fun:"
>
> * Free: demo ride, one world, full delight.
> * Paid (business-model candidate — requires App Store/entitlement review, not shipped): custom worlds, coach memory, ghosts, extended history.
>
> "Your ride saves on this device and earns progression — not tokens. Private account sync and any future reward settlement are opt-in and still being built; where we're headed is a receipt-based model, not free crypto. Details exist, but they're never the pitch."

## Wrap (2:40 - 3:00)

> "Your effort transforms this world — in this moment, on this route. Try it — you'll feel it in 30 seconds."

---

## Demo Cheat Sheet

| If asked | Say |
|----------|-----|
| Blockchain? | Avalanche + Sui testnet experiments exist in the background. The ride works without them; no wallet is a prerequisite. |
| ZK? | Browser-side effort proofs exist in the testnet experiment; live claims are not approved (deployed Fuji wrapper rejects real proofs; app-side legacy gate implemented locally, off in prod env) — a receipt-first redesign is approved. Details in ARCHITECTURE. |
| Rewards? | Rides earn progression — visuals, milestones, history. Token redemption is a future, separately designed path; no free SPIN is promised. |
| Data? | Completed rides save locally on the device. Private cloud sync and consent controls are being built; nothing is claimed private-by-default yet. |
| Hardware? | FTMS / cycling-power / heart-rate BLE devices; specific models (IC4/C6/M3i candidates) require validation. Keyboard simulator is always available. |

**One-Click Demo URL:**
`https://spinchain.vercel.app/rider/ride/demo?mode=practice&demo=true&auto=true`
