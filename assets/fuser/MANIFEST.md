# Fuser-generated assets

Generated via Fuser studio canvas (fal MiniMax/Gemini reference still → Tripo 3D P2 image-to-3D). Reference stills are the `*-ref.*` files. Checked in as static assets — no runtime Fuser dependency.

| File | Type | Notes |
|---|---|---|
| ~~rider-ember.glb~~ | deleted | Malformed Tripo P2 mesh (no arm geometry) — removed 19 Nov along with `public/characters/rider-ember*.glb` and `ember-rig-fixed-experimental.glb`. Diagnosis preserved in STATUS.md. The shipped `ember` comes from `scripts/meshy/avatar-factory.mjs` (`ember-mk2*`). |
| rider-ember-ref.png | reference still | Strict T-pose, symmetrical, neutral background — Mixamo-compatible intent. Source image for the avatar-factory regeneration. |
| bike-fuser.glb | GLB mesh | Road bike variant, Tripo i2d from `scripts/meshy/reference/bike-side.png`. Side-profile dims (~1.0 long × 0.45 tall). Untextured. |
| bike-art.png | image | Stylized colorful bike illustration — promo/loading art. |
| prop-trophy.glb | GLB mesh | Golden trophy cup, PBR texture, 1 mesh. ~1.5M verts — decimate before real-time use (see `scripts/meshy/measure-rig.mjs` for measurement). |
| prop-trophy-ref.jpg | reference still | Source image fed to Tripo Front Image input. |

## Integration

`prop-trophy-opt.glb` (weld + meshopt simplify ratio 0.05, 1024px textures: 17,459 verts / 25,058 tris, ~1 unit tall, centered) is vendored at `public/props/trophy.glb`. Preview it in the harness at `/test-harness/model-viewer?url=/props/trophy.glb`. The raw 1.5M-vert Tripo output stays here untouched.

See `STATUS.md` for the current integration state: `ember` shipped 19 Nov via the avatar factory (`ember-mk2-meshy.glb`, verified in rig-studio), and `bike-fuser-rig.glb` is registered in `app/lib/selection-library.ts` as `fuser-cycle` "Ember SL".
