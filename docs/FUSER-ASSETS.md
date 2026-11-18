# Fuser asset batch (17 Nov 2026)

Expiring Fuser trial credits were spent on one-off generated assets,
vendored as static files — there is NO runtime Fuser dependency.

- `public/props/trophy.glb` — Tripo P2 image-to-3D trophy, decimated to
  ~17k verts / 25k tris (~1 unit, centered). Preview:
  `/test-harness/model-viewer?url=/props/trophy.glb`.
- Raw 1.5M-vert output + reference still kept in `assets/fuser/` —
  always ship the `-opt` variant, never the raw GLB.

Provenance + prompts: `assets/fuser/MANIFEST.md`.
