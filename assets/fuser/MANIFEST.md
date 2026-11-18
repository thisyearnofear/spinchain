# Fuser-generated assets

Generated via Fuser studio canvas (fal MiniMax/Gemini reference still → Tripo 3D P2 image-to-3D). Reference stills are the `*-ref.*` files. Checked in as static assets — no runtime Fuser dependency.

| File | Type | Notes |
|---|---|---|
| rider-ember.glb | GLB mesh | New rider archetype "Ember": crimson/charcoal aero kit + red helmet, from `rider-ember-ref.png` T-pose still. Untextured Tripo P2 mesh — verify fit in `/test-harness/rig-studio` before registering in `app/lib/generated-avatars.json`. |
| rider-ember-ref.png | reference still | Strict T-pose, symmetrical, neutral background — Mixamo-compatible intent. |
| bike-fuser.glb | GLB mesh | Road bike variant, Tripo i2d from `scripts/meshy/reference/bike-side.png`. Side-profile dims (~1.0 long × 0.45 tall). Untextured. |
| bike-art.png | image | Stylized colorful bike illustration — promo/loading art. |
| prop-trophy.glb | GLB mesh | Golden trophy cup, PBR texture, 1 mesh. ~1.5M verts — decimate before real-time use (see `scripts/meshy/measure-rig.mjs` for measurement). |
| prop-trophy-ref.jpg | reference still | Source image fed to Tripo Front Image input. |

## Integration

`prop-trophy-opt.glb` (weld + meshopt simplify ratio 0.05, 1024px textures: 17,459 verts / 25,058 tris, ~1 unit tall, centered) is vendored at `public/props/trophy.glb`. Preview it in the harness at `/test-harness/model-viewer?url=/props/trophy.glb`. The raw 1.5M-vert Tripo output stays here untouched.

See `STATUS.md` for the current integration state: `ember` is registered but its arm skin weights are still broken (rig repair in progress via `scripts/meshy/fix-rig-arms.mjs`, experimental output at `ember-rig-fixed-experimental.glb`), and `bike-fuser-rig.glb` is normalized but not yet registered in `app/lib/assets.ts`.
