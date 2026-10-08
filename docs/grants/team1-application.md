# Team1 Mini Grant — Application Draft

Program: https://grants.team1.network/ — Mini Grants, up to $10k, milestone-released.
Submit: litepaper (`team1-litepaper.md`), prototype, market analysis, team.

---

## Application field answers (paste-ready)

**Project name**: SpinChain

**One-line pitch**: A live indoor-cycling app where effort drives a 3D world
and AI coaching — with Avalanche as an optional, issuer-signed settlement
layer, deployed and working on Fuji today.

**Category**: Consumer dApp (gaming/fitness) — closest fit to "Got Something
Else"; touches oracles/attestation via the verification-provider layer.

**Problem**: Connected fitness is a ~$12–15B market growing ~9–11% CAGR, but
apps lose users to engagement decay and hold data captive in unverifiable
silos. Move-to-earn tried to fix motivation with yield and collapsed — STEPN
hit ~400k DAU then fell ~97% on ponzinomic tokenomics. The missing piece is
a product that's good first and on-chain second.

**Solution**: Receipt-first architecture. Rides produce durable local records
(works offline, no wallet needed); consented cloud sync is private by
default; and a deployed Fuji settlement layer lets authorized issuers
recognize verified sessions against bounded, auditable campaigns — replay
protection, per-user caps, pause controls. ZK (Noir/UltraHonk) is already
benchmarked as the future privacy layer over issuer commitments.

**Prototype evidence**:
- Live app: https://spinchain.vercel.app (demo ride: /rider/ride/demo?mode=practice&demo=true&auto=true)
- Public repo: https://github.com/thisyearnofear/spinchain — 525 unit tests, full CI
- Deployed Fuji contracts: ClaimRegistry `0x53C1F0b6E740F1F8A91352B6169F67Daf2Fa64E1`,
  AchievementRedeemerV2 `0x0F00848CA2aA4493C6A6C89ED0FD3128Cc31d204`
- End-to-end dogfood incl. production-app redemption: `docs/PHASE-5-PILOT.md`

**Stage**: Working product on testnet; settlement layer deployed and
dogfooded. Pre-real-device-validation, pre-revenue.

**Funding ask**: $10,000 — see Use of Funds.

**Team**: <!-- fill: name, role, links, background. Solo founder shipping
publicly; the commit history is the résumé. -->

---

## Market analysis

**TAM/SAM**: Connected fitness equipment ~$11.6B (2025, ~8.7% CAGR); virtual
cycling platforms ~$1.0–1.6B (2025, ~12% CAGR); indoor-cycling app market
projected ~$5B by 2035. Zwift ~1M est. subscribers; Rouvy ~250k and
profitable at ~$17M rev; Peloton ~3M paid subs. A mid-single-digit-thousand
subscriber niche platform is a proven viable business (Rouvy is the model).

**Wedge**: Zwift/Rouvy sell racing realism to serious cyclists at $15–20/mo
with trainer hardware. The underserved segment is motivated beginners and
gym-adjacent riders who want game-feel + progression without the sim-racing
tribalism — the simulator-first + studio-class onboarding path targets
exactly them.

**Why on-chain helps (and where it doesn't)**: for retention the chain adds
nothing today — that's the honest answer, and it's why settlement is an
optional layer. Where it does add value is *inter-issuer portability*: a
studio's "verified session" can be recognized by any platform or campaign
without data-sharing agreements, and reward campaigns are auditable on a
public ledger. That's a real property competitors can't offer without a
neutral settlement rail.

**Competition on-chain**: move-to-earn corpses (STEPN, Genopets) tried
emission-led growth; the credible current cohort is consumer apps that keep
crypto invisible (Fantasy Top, Polymarket-adjacent UX patterns). SpinChain's
stance — settlement optional, honest attestation vocabulary — is positioned
for the post-pump cycle.

**Business model (future, not promised)**: subscription classes/coaching,
studio licensing of the attestation rail, campaign management for sponsored
challenges. Real-value rewards gated on legal/platform review.

## Use of funds (~$10k)

| Item | Est. | Purpose |
|---|---|---|
| BLE smart trainer + devices | ~$2,000 | Real-device validation (Kickr/Core/Flux class) — the top unverified surface |
| Studio/wearable pilot | ~$3,000 | Partner integration work for a `provider-attested` feed (M2) |
| Pilot cohort incentives & ops | ~$2,000 | 10+ rider cohort: onboarding, testnet AVAX, support |
| Content/coaching assets | ~$1,500 | Class production for the pilot cohort |
| Engineering/design sprint | ~$1,500 | Device-validation + provider-integration sprint toward device-verified MVP |

## Milestones for milestone-release structure

- **M1** (30 days): real-device validated ride loop — physical BLE trainer
  end-to-end through receipt → sync → issuer signature → Fuji redemption.
- **M2** (60 days): second verification provider (studio or wearable feed)
  producing `provider-attested` attestations; provider registry in-app.
- **M3** (90 days): pilot cohort of 10+ riders completes real rides with
  Fuji redemptions; published retention/"want again" readout + metrics
  dashboard.

## Interview prep — anticipated hard questions

1. *"Why does this need a chain?"* → It doesn't need one to play — that's
   deliberate. The chain provides portable attestation + auditable campaign
   settlement between issuers who don't trust each other. Live demo of the
   Fuji loop available on the spot.
2. *"How is this different from STEPN?"* → Architecture, not rhetoric:
   rewards never fund gameplay, campaigns are budgeted and bounded, and the
   app carries its own retention (game + coaching + progression). The
   earning isn't the product.
3. *"How do you know a ride is real?"* → Honest tiering: today the issuer
   attests cloud-observed existence only; device-attested provenance is
   milestone M1–M2 with real hardware. The trust statements are verbatim in
   the API — we under-claim on purpose.
4. *"Revenue?"* → Subscriptions/studio licensing; the token layer is a
   settlement primitive, not the business model.
