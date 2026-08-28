# SpinChain Wedge

> **Status**: ACTIVE — all feature decisions reference this document.
> **Last reviewed**: 2026-08-17
> **See also**: [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) for concrete tasks, [ARCHITECTURE.md](./ARCHITECTURE.md) for the background layer, [OPERATIONS.md](./OPERATIONS.md) for setup and deployment.

---

## The Wedge

> **SpinChain makes indoor cycling addictive by turning physical effort into real-time visual transformation in a 3D world.**

That is the one thing. If a competitor cloned only that and every rider started using them instead, we would be devastated. Everything else in this codebase is infrastructure around that core loop.

---

## What This Means In Practice

### The Core Loop (must be under 30 seconds)

```
User opens page → Sees one CTA → Clicks "Start Demo Ride"
→ 3s activation sequence → Pedals → Effort changes 3D world
→ Flow state hits → "Holy shit I need to come back tomorrow"
```

If any step in this loop requires: wallet connection, profile setup, class selection, quiz answers, or reading a tutorial — you have inserted friction into the wedge. Remove it.

### The Gamification Must Be Visible Before the Ride

The flow state engine, milestones, streaks, and experience level are built and deep. But they are invisible on the front door. A rider could browse classes for weeks without understanding they are stepping into a game.

**Rule**: Every landing page and rider dashboard must surface at least one gamification signal within the first viewport: streak count, current flow tier, milestone progress, or experience level badge.

### Rider-Facing Language Only

The rider never needs to know about:
- ZK proofs
- State channels
- ERC-1155 tokens
- Uniswap v4 hooks
- Agent autonomy
- Walrus blobs
- ClearNode

These are infrastructure. If the coach card says "agenticPowers: Dynamic pricing based on demand," that is a wedge violation. The rider wants to know: "Coach Atlas pushes you harder on climbs."

---

## Wedge Guardrails

Every new feature, refactor, or UX change must pass this checklist:

| Guardrail | Question |
|-----------|----------|
| **30-second rule** | Can a new user start pedaling and see their effort transform the world in under 30 seconds? |
| **Visible game** | Does the rider see gamification signals (streaks, flow, milestones) before they enter a ride? |
| **One primary CTA** | Does each page have one dominant action, not a grid of choices? |
| **No preview badges** | Are we never showing a "Preview" label next to a core feature? (Either make it real or remove it.) |
| **Rider language** | Does any component use infrastructure language (ZK, state channel, ERC, hook, agent) that a rider would not understand? |
| **Wedge-first** | Would this feature make the core loop (effort → visual transformation) more or less compelling? |

If a feature fails more than one guardrail, it must be reviewed against this wedge document before merging.

---

## What Is NOT The Wedge (But Still Belongs In The Product)

These are important and we are building them. But they are **moats**, not the wedge. They should be built in the background, not in the foreground:

- **ZK proof system** — Privacy moat. Riders should feel its benefit (no raw data exposed), not its mechanics.
- **State channel rewards** — Economic moat. Real-time micro-rewards are a differentiator, but only after the ride is already compelling.
- **Multi-provider AI coaching** — Quality moat. The AI is a garnish on the visual experience, not the main course.
- **BLE hardware integration** — Distribution moat. Important for the full product, but a demo ride with a keyboard should feel just as magical.
- **Instructor-rider loop** — Network moat. Important for the platform layer. Riders who have never met an instructor should still get the full wedge experience.
- **Ghost riders** — Competition moat. Nice to have, but the solo ride must be complete without it.

**Rule**: Moats are built in parallel. The wedge is built sequentially — perfect it first, expand from it.

---

## Competitors And Why We Win

| Competitor | What They Do | What They Can't Do |
|------------|-------------|-------------------|
| Peloton | Live classes, branded instructors | Real-time effort→visual transformation. The screen is passive. |
| Zwift | 3D world, gamification | Effort maps to avatar speed, not visual world transformation. No flow state engine. |
| Wahoo/Strava | Data, analytics, leaderboards | No visual feedback loop. No gamification inside the ride itself. |
| Sweatcoin | Token rewards | No ride experience at all. Just step counting. |

**Our wedge**: No one makes the world *react* to your sweat in real-time. The road glows, fog thickens, speed lines accelerate, camera FOV widens — all from your effort. That is the thing.

---

## Success Metric

When we shipped something right, we will know because:

1. **Retention**: Riders come back voluntarily. Not because of a streak notification, not because of token rewards. Because they *want* to ride again.
2. **Word of mouth**: Someone says "you have to try this" without mentioning rewards or blockchain.
3. **The demo ride is the product**: If the demo ride (keyboard, no wallet, no signup) is better than the paid experience, we have the wedge.

---

## Anti-Examples (From This Codebase)

These decisions violated the wedge and should be corrected:

| Anti-Example | Why It Violates Wedge | Fix |
|-------------|----------------------|-----|
| `/rider` page shows a class grid with filter tabs | Analysis paralysis. 12 products, not one wedge. | Replace with one "Start Demo Ride" CTA. Classes are secondary. |
| Coach cards show "agenticPowers" with blockchain terms | Rider language violation | Replace with rider-facing specialty descriptions |
| "Preview" badge on reward system | Partial gamification is worse than none | Make real or remove |
| Onboarding quiz before the first ride | Friction before the core loop | Show quiz *after* first ride, or integrate it into the ride |
| Landing page: wallet connect + demo + checklist + banner + network status | Too many competing CTAs | One CTA. One message. One ride. |

---

## This Is A Living Document

When a new feature is proposed, the first question is: "Does this serve the wedge or is it infrastructure?" If it's infrastructure, build it in the background. If it serves the wedge, build it in the foreground.

Never forget: the wedge is the one thing. Everything else is noise until the wedge is undeniable.