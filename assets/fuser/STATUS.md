# Fuser integration status — spinchain

Snapshot of where the Fuser-generated asset integration stands and what's left.
Update or delete this file once the remaining work lands.

## Ember rider (`rider-ember`)

**Registered** in `app/lib/generated-avatars.json` as `ember`, pointing at
`public/characters/rider-ember.glb` (+ `rider-ember.webp` thumbnail), and
flagged `experimental` — hidden from the garage and the in-ride skin
switcher (`SELECTABLE_AVATARS`) but still resolvable by id for rig-studio
work. **Not shippable, and not repairable by re-weighting.**

**Diagnosis (verified 18 Nov, `scripts/meshy/analyze-ember*.mjs`):** the
Tripo mesh has **no arm geometry at all**. There is a literal vertex gap
between torso and "arm": on the left, zero verts between x≈0.10 and
x≈0.60, then a flat fan at y≈0.51 (one vertex thick) spanning z 0→0.96 —
what reads as an arm in the thumbnail is that fan's edge silhouette. The
earlier note's "arms bent forward at the elbow (wrists z≈0.43)" was the
same sheet misread as a tube. Rig-studio confirms it visually: the IK
fit solves (hip on saddle, torso 6.4°) and legs pedal, but in `view=head`
an "arm" points skyward, `view=side` shows the hand overshooting the
bars horizontally, and the sheet renders as a black fin off the back —
`/test-harness/rig-studio?avatar=ember&view=head|bars&markers=1&debug=1`.

**Coordinate spaces of the shipped GLB** (it is a recentered re-export —
60k verts, POSITION ±0.96 — not the 98k/1.7 m source described below):

- `inv(IBM)` translations live in raw mesh space; scene space is cm via
  `chainMat = 88.9·(meshPos + (0, 0.957, 0))` — derive this transform,
  don't hardcode the old `ARMATURE_SCALE=100`.
- `scripts/meshy/probe-rig-space.mjs` prints inv(IBM)/chain/POSITION for
  any rigged GLB; use it before trusting numbers from the other variant.

**Why the repair can't land:** `scripts/meshy/fix-rig-arms.mjs` rewrites
weights and rebuilds IBMs, but there is no arm volume to bind — folding
the fan onto Arm/ForeArm/Hand joints only folds a plane. Output preserved
at `assets/fuser/ember-rig-fixed-experimental.glb` for forensics.

**Path forward (pick one, all need a new mesh — weights can't help):**

1. Fresh image→3D with a different source pose or generator (costs
   credits — confirm before spending).
2. Re-rig in Blender/Mixamo is pointless for the same reason: the
   geometry is missing, not just the binding.
3. Alternatively drop Ember entirely and keep only `fuser-cycle`
   (verified below) + the trophy from this batch.

## Fuser bike (`bike-fuser-rig.glb`)

Normalized into rig space via `scripts/meshy/normalize-bike-fuser.mjs`
(mirrors `normalize-bike.mjs`): scale ≈2.66, translate [0, 0.601, 0.154],
source wheelbase ≈0.571. Output `public/characters/bike-fuser-rig.glb`
(~1.4 MB) is registered in `app/lib/selection-library.ts` as `fuser-cycle`
("Ember SL", thumbnail `/images/equipment/fuser-bike.webp`, scale 0.75,
y −1.45 — the `mesh-cycle` fit values).

**Verified 18 Nov** in `/test-harness/model-viewer?url=/characters/bike-fuser-rig.glb&view=side&spin=0`
(note `spin=0` — the viewer turntables non-procedural models): clean side
profile, front wheel at +Z matching `bike-meshy-rig.glb`, wheel bottoms at
y≈−0.001 (deck contract). Shippable as `fuser-cycle` "Ember SL".

## Also done

- `trophy-fuser.glb` already filed and manifest'd.
- Gates: `pnpm exec tsc --noEmit` clean; eslint has no findings (scripts/
  is in the ignore list, same as the rest of `scripts/meshy/`).
