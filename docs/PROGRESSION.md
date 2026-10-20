# The Rank Ladder

> **Status**: ACTIVE — the rider-facing progression system. Subordinate to [WEDGE.md](./WEDGE.md).
> **Created**: 2026-10-20
> **Code**: `app/lib/progression.ts` (ledger + ladder), `app/components/features/progression/` (UI),
> `app/stores/progression-store.ts` (celebration events).

---

## Why this exists

The codebase tracked a lot of a rider's life — streaks, flow tiers, session milestones, personal
bests, badges, weekly goals — and none of it added up to a *number that moves*. A rider could ride
for months and have no sense of having gone anywhere.

The wedge doc already said it:

> The flow state engine, milestones, streaks, and experience level are built and deep. But they are
> invisible on the front door.

The ladder is the thing that makes the game legible in one glance. One number, ten named steps, and
every ride moves it.

---

## The ladder

| Rank | Title | XP | Aura | Unlocks |
|-----:|-------|---:|------|---------|
| 1 | Spark Rider | 0 | — | Neon City |
| 2 | Ember Rider | 300 | ember | Summit Pass |
| 3 | Flow Rider | 750 | flow | Red Expanse |
| 4 | Surge Rider | 1,300 | surge | Toon Valley |
| 5 | Tempo Rider | 2,000 | surge | — |
| 6 | Vector Rider | 2,900 | apex | Spectrum Run |
| 7 | Apex Rider | 4,000 | apex | — |
| 8 | Zenith Rider | 5,300 | apex | — |
| 9 | Mythic Rider | 6,800 | apex | — |
| 10 | Singularity Rider | 8,500 | apex | — |

Thresholds are tuned so a solid 40-minute ride (≈350–450 XP) lands roughly one rank per ride early
on, tapering to one rank per three or four rides at the top. Twenty good rides should feel like a
journey, not a grind.

`RANKS` in `app/lib/progression.ts` is the single source of truth. Colours, blurbs, aura tiers and
thresholds all live there.

---

## Where XP comes from

XP is **derived from what the ride already recorded** — nothing new is invented, so existing ride
history is worth something the moment the ladder ships.

| Component | Weight | Cap |
|-----------|--------|-----|
| Time on the bike | 3 XP / minute | — |
| Average effort | 0.03 XP / point (0–1000) | 30 |
| Average power | 0.10 XP / watt | 48 |
| Time in flow (tier ≥ 2) | 12 XP / minute | — |
| Peak flow tier reached | 20 XP / tier | 80 |
| Session milestones earned | 25 XP / milestone | — |
| Daily streak | 10 XP / day | 50 |

Every component is something the rider actually did. Nothing is awarded for showing up, and every
input is clamped so a broken sensor cannot farm the ladder.

The award happens at the single ride-completion path (`app/hooks/ride/use-ride-milestones.ts`), so
there is exactly one place XP is granted.

---

## Storage

LocalStorage key **`spinchain:progression:v1`**:

```ts
{
  version: 1,
  entries: [{ id, at, rideId?, world?, xp, breakdown, rankAfter, backfilled? }],
  totalXp: number,
  worlds: string[],   // worlds the rider has ridden
  backfilled: boolean
}
```

An append-only ledger of what was earned and why. It matches the receipt-first direction: an
auditable record of effort, not a mutable score.

### Backfill

Riders who were here before the ladder existed would otherwise restart at zero. On first mount the
store reconstructs a starting total from the existing ride ledger
(`spinchain:rides:history:v2`), using only duration, average power and average effort. Flow and
milestone data are not invented, so the backfill is a **floor, not a guess** — it can only
under-count.

The backfill also recovers which **worlds** the rider has ridden. Practice rides were named after
their world ("Red Expanse"), so the ride name is matched against the world labels.

---

## Worlds are the ladder's teeth

Worlds gate on rank (`UNLOCKS` in `app/lib/progression.ts`):

- Neon City — rank 1 (always open)
- Summit Pass — rank 2
- Red Expanse — rank 3
- Toon Valley — rank 4
- Spectrum Run — rank 6

**A world the rider has already ridden stays unlocked forever.** The ladder only gates worlds they
have never seen; it never takes something away. This is enforced in
`isWorldUnlockedForRider()` and the ridden-world set lives in the ledger.

The gate is designed to motivate rather than block:

- The locked world still renders behind the pre-ride card — the rider sees what they are working
  toward.
- The gallery states the exact XP remaining.
- The pre-ride card offers "Ride Neon City instead" rather than a dead end.

---

## Where the ladder shows up

| Surface | What it shows |
|---------|---------------|
| Landing hero | Ladder preview for first-timers; rank + XP-to-next + next unlock for returning riders |
| Rider dashboard | Rank card (emblem, progress bar, next unlock), weekly goal, streak, PR |
| Gamification bar | Rank chip + XP progress + streak, rides, best power, flow |
| Journey page | Full rank ladder, unlock grid, XP ledger |
| Worlds gallery | Lock state per world, XP remaining, "Ridden" marker |
| Pre-ride card | World name; lock panel if the world is still gated |
| In-ride top bar | Live rank chip |
| Ride completion | XP receipt with a per-component breakdown; full-screen rank-up moment on promotion |

---

## Rules

1. **Rider language only.** XP is a score on your own ladder — never a token, never cash, never a
   chain. No surface says "XP" next to anything monetary.
2. **Derived, not duplicated.** XP is computed from data the ride already produced. There is no
   second source of truth for effort.
3. **Fair gates.** The ladder opens worlds. It never closes one you have ridden.
4. **Every ride moves the number.** Even a short, easy ride shows a receipt with what it earned.
5. **No prerequisites.** The ladder works with no wallet, no signup, and no chain. Losing the
   ledger loses progression, never the ride.

---

## Related changes this shipped with

- **Interval phases no longer swap the world.** `PHASE_TO_THEME` used to replace the entire
  visualizer theme mid-ride (warmup → alpine, sprint → mars). That discarded the rider's chosen
  world, made the world gallery a promise the ride didn't keep, and quietly bypassed the rank
  gates. The phase still shapes the ride — fog, road glow, props, speed lines all run through the
  reactive layer — it just no longer replaces the place.
- **The pre-ride camera runs in preview mode.** It used to be skipped entirely, leaving the default
  overhead camera pointing at empty sky, so the start screen showed a black void. It now flies a
  cinematic chase camera down the road.
- **The keyboard-controls panel auto-retires.** It opened on every desktop practice ride and covered
  a third of the world. It now shows for 6.5 seconds and can be reopened from the HUD.
