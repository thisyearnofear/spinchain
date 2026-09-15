# SpinChain Character System

> **Status**: ACTIVE — character, world, and coach decisions reference this document.
> **Created**: 2026-09-15
> **See also**: [WEDGE.md](./WEDGE.md) for the core loop, [ARCHITECTURE.md](./ARCHITECTURE.md) for the technical layers.

---

## Why

Riders said the characters "look like blobs" and the platform feels flat. The fix is not just better assets — it is a **consistent character that exists across the whole rider journey**, tied to the rider's actual health, wellness, and outcomes. A character that only appears mid-ride is a feature. A character that remembers you, suffers with you, recovers with you, and celebrates with you is a relationship — and that relationship is what makes SpinChain a beloved spin-class supplement rather than a novelty.

A spin class gives energy, music, and community for 45 minutes — but no individual progression, no between-class continuity, no memory. SpinChain's wedge as a supplement is exactly those three gaps. The character is the narrative carrier for all of them.

---

## The Cast

Three "characters," each with one job. Keep the roles distinct.

| Character | Role | Rendered by |
|-----------|------|-------------|
| **The avatar** (first: "Nova") | The rider's *body* in the world. Mirrors state: effort, fatigue, celebration. It is you. | 3D GLB in the route world (Mint pipeline), Rive rig in the HUD |
| **The coach** (Atlas / Dr. Spin / Zen Master) | The *voice* of the relationship. Guidance, accountability, memory. | RiveCoachOrb, debrief text, TTS |
| **The world** | The *mood*. Sprint heat, recovery calm, flow glow. | three.js scene (World Labs pipeline for environments) + world-reactivity |

Body, voice, mood — that is the full cast. Every surface should know which member of the cast is speaking and not confuse them.

---

## One State Vocabulary, Many Renderings

The character must behave consistently everywhere. There is **one vocabulary of character states** for the whole product, rendered medium-appropriately per surface (3D clip in the world, Rive posture on the HUD, portrait/tone on cards).

| State | Meaning | 3D world clip | Rive HUD | Cards/screens |
|-------|---------|---------------|----------|----------------|
| `idle` | Resting, between efforts | seated idle ✓ | relaxed stance | calm portrait |
| `ready` | Primed for today's session | — | eager bounce ✓ (`isReady`) | greeting presence ✓ |
| `riding` | Steady work | seated idle ✓ *(until a pedaling clip exists — Mint's catalog has none yet)* | pedaling ✓ (cadence-tiered) | — |
| `flow` | Deep zone (flow-state tiers) | modifier: aura/intensity ↑ | flow glow | — |
| `recovery` | Recovery interval / rest day done right | catching breath ✓ | easy spin | "recovering well" |
| `celebrate` | PR, milestone, streak | fist pump ✓ | big burst on `prPulse`; small burst on `finishPulse` / `rewardPulse` ✓ | confetti moment |
| `fatigued` | Accumulated training load | *(reserved — 3D clip needs honest demand first)* | heavy sag ✓ (`isFatigued`) | recovery-first coach line ✓ |

**Celebration tiers**: every finished ride gets the small burst (`finishPulse`); a beaten PR gets the big one (`prPulse`). Reward ticks share the small burst — big celebrations must stay rare to stay meaningful.

**Fatigue honesty**: `isFatigued` is driven by `getWeeklyLoad` (`app/lib/analytics/training-load.ts`) — a transparent heuristic (≥3 hard rides in the trailing 7 days), never a readiness score. When it flags, the `/rider` greeting leads with recovery ("Recovery is training") and the character sags instead of bouncing.

**Single source of truth**: `app/lib/character-state.ts` (`CharacterState` + `resolveCharacterState`). Surfaces derive the state from the same stores (ride, telemetry, coaching) — never invent per-surface state logic. `flow` is a *modifier* layered on `riding` (aura, glow, FOV), not a separate clip, until the asset library grows.

**Asset pipeline note**: Mint's curated animation catalog has no cycling/pedaling clip (verified 2026-09-15 via `/v1/animation-options`). The 3D avatar rides in a neutral seated pose; the pedaling story is carried by the 2D Rive HUD rider (cadence-tiered pedal loops). If Mint ships a cycling clip, adding it is a registry-only change in `app/lib/generated-avatars.json`.

---

## Where the Character Surfaces — the Four-Act Loop

The ride is one act of a four-act loop. The character must be present in all four.

### Act 1 — Pre-ride (home, `/rider`)
The cheapest, most neglected moment. The character greets the rider **with memory**: streaks, last-ride context, today's session. This is where a supplement beats a studio — the instructor sees 30 people; the app sees one. Implemented: character greeting beside the rider hero with a memory-aware line.

### Act 2 — Ride
Done. 3D avatar in the route world (`RiderMarker` → `AnimatedModel`, state-crossfaded clips) + Rive HUD companion (cadence pedals, effort lean, sprint/recovery postures, PR celebration) in `RideHUDOverlayV2`.

### Act 3 — Post-ride (`RideCompletionV2`)
The highest-emotion 90 seconds in the product. The character is present in the celebration phase beside the coach's debrief — fist-pumping the PR, or calmly present after a disciplined easy ride. Celebration first, stats second, infrastructure last (existing design principle — the character anchors Phase 1).

### Act 4 — Between rides (`/rider/journey`)
Progression made flesh. Instead of XP bars alone, the character *is* the progression artifact: earned kits, new animation clips, aura tiers. The Mint pipeline (`scripts/mint/generate-rider.mjs`) is the content factory for this — unlockable clips and models are the reward inventory. **Not yet implemented — see roadmap.**

---

## Health & Wellness Principles

The character is how outcomes become emotional. These rules keep that honest:

1. **Celebrate the behaviors that create health, not just intensity.** Fist-pump the PR — but also visibly honor recovery compliance, zone-2 discipline, and a well-timed rest day. A character that is proud of you for resting is genuinely differentiated.
2. **Never punish rest.** Streak mechanics must be recovery-respecting (streak freezes over grind-or-break). A fatigued character is an invitation to ease off, never a scolding.
3. **No fake precision.** No readiness scores or medical-sounding claims without the data to back them (no HRV/sleep integration today). "You've gone hard four days straight — today we spin easy" is a coaching line, not a diagnosis.
4. **Stylized over realistic.** At current fidelity, a stylized character with great state transitions beats a realistic one with four clips. The uncanny valley kills the relationship faster than low poly ever will.
5. **Outcomes loop, always**: ride → measure (HR zones, power, PRs) → reflect *through the character* → prescribe (homework/plan) → return. The character is present at every step so it feels like one relationship, not four features.

---

## Roadmap

- [x] Rive HUD rider v2 (articulated, cadence/effort/phase/PR reactive)
- [x] Mint 3D avatar with state-driven clips (idle / recovery / celebrate)
- [x] Post-ride character presence in the completion moment (rider celebrates; coach orb speaks the debrief)
- [x] Pre-ride character greeting on `/rider`
- [x] Shared `CharacterState` vocabulary (`app/lib/character-state.ts`)
- [x] `ready` (eager pre-ride bounce) and `fatigued` (honest 7-day load → recovery coaching) states
- [x] Celebration tiers: `finishPulse` for every finish, `prPulse` for PRs
- [x] Second Mint archetype ("Volt", robot) — parameterized pipeline, earned-unlock proof of concept
- [ ] World Labs environments — the *world* as mood, generated against the state vocabulary (needs `WLT_API_KEY`; mobile-benchmark the pano tier)
- [ ] Journey-page character progression (earned cosmetics/clips; recovery-respecting streaks — Volt is the first unlock candidate)
- [ ] Pedaling clip for the 3D avatar (blocked on Mint's catalog)
