# Agent Skills Evaluation — 2026-09-01 (Updated 2026-09-01 PM)

> Review only at first — then installed per plan. Flagged commands below were initially not run, then executed as documented.

**Status 2026-09-01 PM:** `react-doctor@0.9.13` installed (`pnpm add -D react-doctor` + `react-doctor.yml` CI, `pnpm doctor`), threejs selective (`threejs-aaa-graphics-builder` + `debug-profiler` + `qa-release` to `~/.agents/skills`, added `@playwright/test` + `playwright.config.ts` + `tests/visual-regression.spec.ts` + `app/lib/test-hooks.ts` + `app/test-harness/route-visualizer`), `webgpu` still parked. Brand harness (Sylva + Maxima) shipped as `chainring-carousel` + `chain-tension` + `morph-cta` + `how-it-works` scroll-scrub + `effort-aura-canvas`.

## Verdict (Rank by ROI for SpinChain)

| # | Skill | Repo | Verdict | Why |
|---|-------|------|---------|-----|
| 1 | `millionco/react-doctor` | 14.7k★ · 1,405 commits · MIT | **Install now** | Deterministic React lint + perf trace + CI gate (diff-only comments). Catches the 6 `rules-of-hooks`/`purity`/`refs` errors just fixed in `enhanced-flow-background.tsx:42` + 218 warnings. Framework-agnostic (Next/Vite), no API keys. Telemetry to Sentry opt-out with `--no-telemetry`. Lowest risk, highest ROI. |
| 2 | `majidmanzarpour/threejs-game-skills` | 1.4k★ · 9 commits · MIT | **Evaluate selectively** | 9 skills + director router (`threejs-game-director`) for playable Three.js games. Bundles Vite+TS scaffold, seeded RNG + `__THREE_GAME_TEST_HOOKS__`, Playwright smoke/visual/bot templates, `inspect-threejs-canvas.mjs` (color entropy/edge density/budget), scorecard anchors. Relevant to `app/components/features/route/route-visualizer.tsx` (1.7k-line R3F) + `visualization-engine.ts` FPS degrade. Optional Tripo (`TRIPO_API_KEY`) / Gemini (`GEMINI_API_KEY`) / ElevenLabs (`ELEVENLABS_API_KEY`) generation with credential probe — env-only, never browser. Heavyweight director wants to own scaffold; adopt `threejs-aaa-graphics-builder` + `threejs-debug-profiler` + `threejs-qa-release` only. |
| 3 | `dgreenheck/webgpu-claude-skill` | 1.2k★ · 15 commits · MIT | **Park** | Single skill `webgpu-threejs-tsl` for `three/webgpu` + TSL (`WebGPURenderer.init()`, `colorNode`, `Fn`, compute, `wgslFn`, device-loss). Aligned to r183 (`PI2→TWO_PI`). Docs-only, no installer binary. SpinChain is WebGL `Canvas frameloop="demand"` today — park as reading until WebGPU migration is committed. |

## Flagged Install Prompts — Not Executed

The following commands/prompts were suggested in the reviewed READMEs and were **flagged, not run**:

```
# threejs-game-skills
npx skills add majidmanzarpour/threejs-game-skills --skill '*' -a codex -g -y
npx skills add majidmanzarpour/threejs-game-skills --skill '*' -a claude-code -g -y
./install.sh --codex
./install.sh --claude
./install.sh --all
./install.sh --codex --force
./install.sh --all --prune-managed
bash ~/.claude/skills/threejs-game-director/scripts/probe_asset_credentials.sh
python3 skills/threejs-gameplay-systems/scripts/create_threejs_game.py ../my-threejs-game
node skills/threejs-qa-release/scripts/inspect-threejs-canvas.mjs --url http://127.0.0.1:5188 --mobile
node skills/threejs-qa-release/scripts/inspect-threejs-canvas.mjs --url http://127.0.0.1:5188 --state active-play --seed 12345

# react-doctor
npx react-doctor@latest
npx react-doctor@latest install
npx react-doctor@latest ci install
npx react-doctor@latest scan http://localhost:3000
npx react-doctor@latest scan https://app.example.com --cdp http://127.0.0.1:9222
react-doctor ci config
react-doctor ci upgrade

# webgpu-claude-skill
/skill install webgpu-threejs-tsl@<your-github-username>/webgpu-claude-skill
# manual copy: skills/webgpu-threejs-tsl → ~/.claude/skills/ or <project>/.claude/skills
# manual copy: .cursor/rules + skills/webgpu-threejs-tsl → your-project/
```

## Plan for SpinChain

### Immediate — react-doctor
1. Local run: `npx react-doctor@latest` at project root for baseline audit
2. Agent skill: `npx react-doctor@latest install` (Claude Code / Cursor / Codex)
3. CI gate: `npx react-doctor@latest ci install` — reviews only issues introduced by the change, not backlog

### Near-term — threejs-game-skills (selective)
- Trial on `route-visualizer.tsx` / `focus-route-visualizer.tsx`:
  - `threejs-aaa-graphics-builder` scorecard vs `visualization-engine.ts:36` FPS degrade and `gpu-probe.ts` quality tiers
  - `threejs-debug-profiler` for black-screen / mobile resize / draw-call profiling
  - `threejs-qa-release` canvas metrics vs manual verification gate `IMPLEMENTATION-PLAN.md` Phase 2.4
- Do not adopt full director scaffold wholesale; cherry-pick graphics/QA/debug. Verify asset generation fallback (procedural) when `TRIPO_API_KEY`/`GEMINI_API_KEY` missing.

### Parked — webgpu-claude-skill
- Keep as reference (`skills/webgpu-threejs-tsl/docs/` + `examples/`). Re-evaluate when `three/webgpu` migration is on the roadmap. Current SpinChain probe `gpu-probe.ts:76` (`focus-2d` on low-end) remains WebGL-based; WebGPU availability (Chrome 113+) is narrower.

## Security & Supply-Chain Notes

- All three are MIT, GitHub-hosted, no binaries or network exfiltration beyond opted-in API calls (Tripo/Gemini/ElevenLabs) or Sentry telemetry (react-doctor, opt-out).
- Never commit `TRIPO_API_KEY`/`GEMINI_API_KEY`/`ELEVENLABS_API_KEY` — use shell profile or `probe_asset_credentials.sh` (SET/MISSING without printing values).
- Treat `react-doctor` Chrome traces as sensitive (URLs, source paths, React profiling).

## Why This Order

- **Revenue/loop first** per `WEDGE.md` — react-doctor protects the loop (effort → visual transformation → dopamine) by catching React #185 regressions without changing product scope.
- **Graphics second** — threejs skills polish the world only after the loop is stable (Phase 2.3 `useDemoEffort` world reactivity).
- **WebGPU last** — future renderer (`splat`/`ai-gen` in `ARCHITECTURE.md §3`) deferred until SpinChain commits to `WebGPURenderer`; premature adoption adds bundle/compat cost.

## References

- threejs-game-skills: https://github.com/majidmanzarpour/threejs-game-skills
- react-doctor: https://github.com/millionco/react-doctor
- webgpu-claude-skill: https://github.com/dgreenheck/webgpu-claude-skill
