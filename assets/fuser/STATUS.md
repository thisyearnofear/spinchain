# Fuser integration status — spinchain

Snapshot of where the Fuser-generated asset integration stands and what's left.
Update or delete this file once the remaining work lands.

## Ember rider (`rider-ember`)

**Registered** in `app/lib/generated-avatars.json` as `ember`, pointing at
`public/characters/rider-ember.glb` (+ `rider-ember.webp` thumbnail). That GLB
is the original Fuser **Meshy Rigging** output (Tripo image-to-3D from
`assets/fuser/rider-ember-ref.png`, then auto-rigged). It renders correctly in
bind pose, and the procedural IK fit solves (hip on saddle, torso ~71°) —
**but the arm weights are broken**, so the avatar is not shippable yet:

- Left arm verts are almost all bound to `LeftArm`; right arm verts to
  `RightHand`. Shoulder/forearm verts are scattered across unrelated joints,
  including ~30k chest/back verts.
- When the IK rotates the arm joints toward the bars, chest geometry is
  dragged with them → black blob over the bars (visible in
  `/test-harness/rig-studio?avatar=ember&view=bars&markers=1`).
- Both Meshy Rigging and the repo's own Meshy-API script produced the same
  defect; a second Tripo regeneration (`ember2.glb`) came back armless, so
  ember1's mesh is the one to keep.

**Rig facts learned** (needed by any repair):

- Mesh space is metres (POSITION ±0.8, rider ~1.7 m); joint world space is
  cm — `J_world = 100 × bind_pos`, `J·IBM = uniform 100×` for every joint.
- Joint bind positions live at `inv(IBM)` translations; current arm joints
  sit inside the torso (LeftArm bind x≈0.04 m).
- The arms are **bent forward at the elbow** (wrists ≈ (±0.65, 1.31, ~0.43)),
  not straight ±X — the Tripo mesh isn't a pure T-pose. There is also a
  horizontal sheet at y≈1.55 spanning the full z range (wing/cape-like
  geometry) that contaminates any naive "arm verts" selection.

**Repair attempt so far:** `scripts/meshy/fix-rig-arms.mjs` rewrites arm
weights by parametrizing verts along distance-to-hand (S=deltoid shell,
elbow/wrist = shell centroids), re-homes chest verts to the nearest torso
joint, and rebuilds IBMs via `inv(J_new)·J_old·IBM_old`. Latest output is
preserved at `assets/fuser/ember-rig-fixed-experimental.glb`. Legs pedal
correctly and the fit solves, but joint targets still collapse on the bent
arm (shell centroids average the fold) — **not production-ready**.

**What's left:**

1. Finish `fix-rig-arms.mjs` — place the elbow at the point of max deviation
   from the S→H chord rather than a distance-shell centroid, and account for
   the wing sheet at y≈1.55.
2. Copy the result to `public/characters/rider-ember.glb`, rerun
   `measure-rig.mjs`, then verify **side/front/bars/head/pedal** views in
   rig-studio (numeric measures alone proved misleading here — the fit
   solves even with the torso blob).
3. If repair stalls: alternatives are a fresh image→3D pass with a different
   source pose, or a Blender/Mixamo re-rig outside Fuser.
4. Update the `ember` registry description once the rig is verified.

## Fuser bike (`bike-fuser-rig.glb`)

Normalized into rig space via `scripts/meshy/normalize-bike-fuser.mjs`
(mirrors `normalize-bike.mjs`): scale ≈2.66, translate [0, 0.601, 0.154],
source wheelbase ≈0.571. Output `public/characters/bike-fuser-rig.glb`
(~1.4 MB) is registered in `app/lib/selection-library.ts` as `fuser-cycle`
("Ember SL", thumbnail `/images/equipment/fuser-bike.webp`, scale 0.75,
y −1.45 — the `mesh-cycle` fit values).

**What's left:**

1. Verify wheel placement/orientation in the route or model-viewer
   (`/test-harness/model-viewer?url=/characters/bike-fuser-rig.glb`).

## Also done

- `trophy-fuser.glb` already filed and manifest'd.
- Gates: `pnpm exec tsc --noEmit` clean; eslint has no findings (scripts/
  is in the ignore list, same as the rest of `scripts/meshy/`).
