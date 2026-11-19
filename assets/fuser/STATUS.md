# Fuser integration status — spinchain

Snapshot of where the Fuser-generated asset integration stands and what's left.
Update or delete this file once the remaining work lands.

## Ember rider — REGENERATED, VERIFIED, SHIPPED (19 Nov)

`ember` now points at `public/characters/ember-mk2-meshy.glb`, produced by
`scripts/meshy/avatar-factory.mjs` from the same `rider-ember-ref.png`
T-pose still (the Tripo mesh was the failure, not the image):

- image-to-3d `meshy-t2.5` smart-topology, t-pose, 30k target, `meshy-n1`
  texture (task `01a1f142`, 15cr) → `ember-mk2.glb` — 21,462 verts, real
  arm tubes both sides (factory geometry gate PASS)
- Meshy rigging (task `01a1f143`, 5cr) → `ember-mk2-meshy.glb` + baked
  walk/run clip GLBs. Mixamo bone names the IK pass expects.
- Rig-studio visual pass on all five views: hands land on the drops,
  aero tuck with helmet/visor, feet on pedals, no fin/overshoot.
  `experimental` flag removed — selectable everywhere.

The dead originals remain in `public/characters/` as `rider-ember*.glb`
(~32 MB, unreferenced) — safe to delete when convenient;
`assets/fuser/rider-ember.glb` and `ember-rig-fixed-experimental.glb`
stay for forensics.

### Diagnosis of the original (kept for the record)

The Tripo mesh had **no arm geometry at all**: a literal vertex gap
between torso and "arm" (left: zero verts x≈0.10→0.60), then a flat fan
at y≈0.51 spanning z 0→0.96 — the thumbnail "arm" was that fan's edge
silhouette. No weight fix could help; the geometry didn't exist. The
avatar-factory geometry gate (`gateHumanoid` in
`scripts/meshy/avatar-factory.mjs`) now codifies this check — contiguous
arm coverage + minimum cross-section — and runs for free between
generation and the paid rig step, so a malformed mesh stops at the i2d
charge instead of shipping.

**Coordinate spaces of the old shipped GLB** (recentered re-export —
60k verts, POSITION ±0.96 — not the 98k/1.7 m source):

- `inv(IBM)` translations live in raw mesh space; scene space is cm via
  `chainMat = 88.9·(meshPos + (0, 0.957, 0))` — derive this transform,
  don't hardcode the old `ARMATURE_SCALE=100`.
- `scripts/meshy/probe-rig-space.mjs` prints inv(IBM)/chain/POSITION for
  any rigged GLB; use it before trusting numbers from the other variant.

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
