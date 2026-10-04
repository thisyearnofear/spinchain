# SpinChain: wedge-aligned verification and settlement

**Research date:** 2026-10-04

**Status:** Research completed; receipt-first direction approved 2026-10-04. The `ride_summaries.summary` column was absent at preflight; the additive migration was applied during release prep 2026-10-04 and phase-1 code deployed 2026-10-04 (application release `a3c7e37`).

**Decision:** Should SpinChain repair its existing effort-to-token contracts, or redesign the contract layer around the current cycling experience?

## Executive summary

My recommendation is a **receipt-first architecture with optional settlement**, rather than a more sophisticated version of the current token-per-effort architecture. Keep live telemetry, flow, world transformations, coaching, and ordinary progression entirely independent of blockchain availability. Save a completed ride durably, assign its provenance honestly, and let eligible riders export or redeem a narrowly scoped achievement afterward. Retain Avalanche as the settlement chain; do not add a chain migration to this redesign.

The research supports this direction, but it does not prove SpinChain's retention hypothesis. Clinical evidence supports both gamification and financial incentives in some settings, including a 2024 randomized trial; it does not establish that a tradable exercise token is necessary or beneficial for this particular cycling product. Bluetooth FTMS is an interoperability protocol, not a transferable attestation of physical effort. Zero-knowledge can hide inputs and prove calculations, but cannot independently establish that a real rider generated those inputs. Those are separate product and trust decisions. [1][2][3][4]

There are also concrete local reasons not to deploy an adapter as the next step: the existing proof does not cryptographically bind the class, rider, threshold, or minimum-duration metadata; replay protection is keyed to proof bytes rather than a stable ride identifier; and one telemetry upload path base64-encodes raw biometrics without encrypting them. Repairing the verifier's three-output interface is useful correctness work, but it does not resolve those design problems. [R2][R3][R4][R5]

**Recommended immediate direction:** preserve the reliability fixes already implemented; hold live verifier changes; close the raw-telemetry privacy gap; design a durable, versioned ride receipt and recoverable post-ride job; validate the ride without money being its primary reward. Decide which achievements actually need public settlement only after that loop works. The migration was completed 2026-10-04 and commit/deploy prep authorized; contract changes remain paused.

## 1. Scope, evidence, and assumptions

This review combines direct inspection of the current repository with Tavily searches and primary-source extraction. The retrieval covered sensor provenance, ZK and zkTLS, wallet abstraction, Chainlink CRE, exercise incentives, settlement standards, fitness competitors, decentralized storage, and native-app policy. Fifteen targeted searches were followed by extraction of eight selected primary pages. Search results were not treated as equivalent evidence: protocol specifications, maintainers' documentation, official product documentation, and peer-reviewed trials were preferred over commentary.

The current product constraint comes from `docs/WEDGE.md`: a new rider should start without a wallet, and effort should change the world before infrastructure becomes relevant. The same document puts ZK, state channels, storage, AI, and hardware integration behind the foreground experience. This is the governing product choice, not a technical limitation imposed by this report. [R1]

I assume the first useful cohort is ordinary indoor cyclists rather than cryptocurrency investors; the current distribution is a browser app with a Capacitor/mobile ambition; the app stays on testnets during validation; and there are no approved real-money payouts in the research scope. These assumptions should be changed if the intended first customer is instead a studio, insurer, employer, or existing crypto community. Each has different verification, payment, and onboarding needs.

The analysis distinguishes three kinds of claims. **Observed** means visible in current source or in the earlier read-only production preflight. **External evidence** means supported by a cited source retrieved during this session. **Recommendation** means a design judgment for SpinChain, not a result established by the literature. Nothing below should be interpreted as proof that an integration is already wired into this app, or that a proposed contract is audited.

## 2. The important problem is provenance, not proof generation

### 2.1 What the current ZK system actually proves

The Noir circuit accepts a private input struct containing heart-rate samples, sample count, threshold, and minimum duration. Its public return is only `threshold_met`, `seconds_above`, and `effort_score`. The browser generates a witness for that struct and then constructs a seven-element application envelope by attaching threshold, minimum duration, class ID, and rider ID. Local verification checks only the three public outputs. Those four attached metadata fields are therefore not cryptographically established by this circuit. Comments that call some struct fields public do not make them public circuit inputs. [R2]

The corrected wrapper now forwards the three outputs the generated Honk verifier expects. This resolves the interface mismatch, and real local proof-to-mint tests demonstrate that the cryptographic verifier accepts the resulting proof. It does **not** make the appended class or identity metadata part of the proven statement. Comparing the submitted rider field with `msg.sender` is an application check, not evidence that the proof was originally made for that rider. [R2][R3][R4]

The circuit also does not authenticate the origin of its private samples. A user can prove a correct computation over values supplied to the prover without establishing that those values came from an actual cycling session. This is not a flaw unique to Noir. It is the difference between proving a computation and authenticating a real-world observation. TLSNotary's maintainers make an analogous distinction for zkTLS: selective disclosure and integrity of witnessed content do not remove the need to trust the witness and the data source. [1]

Consequently, the product should not label the current path as universally “trustless verified effort.” More precise labels describe what was checked: recorded session, authenticated account, source-backed activity, or policy-approved achievement. A public proof can strengthen a specific layer without making every preceding layer trustworthy.

### 2.2 What BLE contributes—and what it does not

The Bluetooth SIG FTMS specification defines training-data transport from a fitness machine to a client. Its characteristic table lists Indoor Bike Data as a notification characteristic with security permissions “None”; the Fitness Machine Control Point has encryption requirements. The indoor-bike data record includes flags and optional speed, cadence, power, heart-rate, and timing fields. It does not supply SpinChain with a manufacturer-signed, session-bound assertion that a particular person completed a workout. [2]

The app's parser reads those measurements as numeric fields, and the BLE service connects through the platform/device picker. There is no manufacturer attestation verification in that path. A connection is useful evidence for a consumer fitness app, and substantially better than pretending estimated data is measured data. It should not be treated as sufficient authorization for an unlimited monetary reward. [R8]

**Recommendation:** introduce explicit provenance classes at the receipt boundary: `simulated`, `device-observed`, and `source-attested`. Device-observed should mean the app collected measurements from a connected device; it should not imply tamper-proof hardware. Source-attested should require a named integration and a documented authentication method. Do not assign the same payout policy to all three classes.

A studio deployment can later add a stronger route: enrolled equipment, device-to-gateway measurements, fresh server challenges, and a trusted studio attestation. A consumer route might use an authenticated wearable-provider record. Neither automatically proves which human used the equipment. Enrollment, account binding, plausibility, and fraud handling remain necessary at the value-bearing boundary.

## 3. The current economic contract is not an appropriate game-design primitive

### 3.1 Progression and settlement are different systems

The existing engine converts verified effort scores into a base reward plus a score-dependent bonus, then applies multipliers based on SPIN holdings. It also supports signed attestations, Chainlink-based claims, and rider/instructor channel settlement. The reward-token contract and class ticket discounts couple game progress, financial balance, and platform economics. This is a broad protocol surface for a product whose foreground promise is a satisfying ride. [R4][R9]

The wedge does not require every change in effort to be economically settled. A road glow, beam, flow tier, milestone, or coach reaction is a game event. Its timeliness and consistency matter more than financial finality. Treating that feedback as earned progression allows it to remain responsive when a wallet is absent, the network is unavailable, or a backend job is retrying. Settlement can then attach to selected completed outcomes rather than to the rendering clock.

**Recommendation:** separate three ledgers. The first is immediate local session state, used only for visual response and coaching. The second is durable account progression, used for history, earned world variations, badges, and repeat-ride motivation. The third is an optional settlement ledger for explicitly eligible achievements or funded campaigns. “Progress saved,” “verification pending,” and “on-chain redemption confirmed” should be distinguishable states, not interchangeable success messages.

This is not an argument to remove blockchain permanently. Publicly verifiable achievements, portable access rights, and transparent creator payments may be meaningful differentiators. They become clearer product benefits when they are not also responsible for making a neon road react to a pedal stroke.

### 3.2 What the incentive literature actually supports

The BE ACTIVE trial enrolled 1,062 participants at elevated cardiovascular risk. Over its twelve-month intervention, gamification, financial incentives, and their combination increased mean daily steps compared with control; the combined intervention had the largest effect. At six-month follow-up, the combined arm remained significantly different under the study's multiple-comparison procedure. These findings are evidence that well-designed incentives can help in that setting. They are not a trial of cryptocurrency, indoor-cycling worlds, or SpinChain's users. [3]

An earlier systematic review found that incentives tended to improve exercise during intervention, while sustained behavior after their removal was mixed. It explicitly stated that the reviewed studies did not establish whether incentives undermined intrinsic motivation. We should therefore not make the stronger claim that financial rewards necessarily destroy intrinsic motivation. Equally, we should not claim that earning a transferable token will create durable retention. [4]

**Recommendation:** keep the user's experience of mastery as the default reward, and make financial incentives a separately funded experiment. Useful targets include consistency with a personalized workout, returning voluntarily, completing an appropriate session, and exploring an earned visual variation. Avoid a blanket “higher heart rate means more money” incentive. The exact scoring policy requires product and exercise-domain review; this research does not authorize new numerical thresholds.

A sponsored campaign is a more bounded economic model than unconstrained token inflation: someone funds a defined budget, the eligibility policy is versioned, rewards are capped, and the product can account for actual liability. Off-chain points should not promise cash value, and a token balance should not silently become a claim on a funded pool. Any move to transferable or cash-like rewards needs a jurisdiction-specific review before launch.

### 3.3 STEPN is a precedent, not evidence that its model fits this wedge

STEPN's official whitepaper describes an earnable GST utility token, token-burning game mechanics, and earning linked to sneaker attributes, activity conditions, and SMAC anti-cheating classification. Its documentation makes fraud handling part of reward eligibility, rather than assuming a blockchain transaction alone establishes authentic exercise. [5][6]

The Grid's public records also identify STEPN and STEPN GO as live products. That is useful discovery metadata, not evidence of sustainable economics, profitability, or retention. The official product pages and whitepaper were used for functional claims; no market-performance conclusion was derived from a status label.

SpinChain should learn the separation between gameplay and eligibility, but should not copy the cost of owning a tokenized item before exercise. Requiring NFT equipment, funding a wallet, and understanding token repair/burn loops would add pre-ride friction to the current wedge. The first question remains whether people enjoy returning to the ride without mentioning rewards. [R1]

## 4. Proposed architecture: a durable receipt followed by optional redemption

### 4.1 The two-speed system

The foreground flow should remain:

```text
BLE or simulator
    -> local ride engine
    -> live world transformation and coaching
    -> immediate completion and earned progression
```

The background flow should be:

```text
completed session
    -> durable, versioned receipt
    -> provenance and policy checks
    -> optional private proof or issuer attestation
    -> recoverable redemption job
    -> confirmed settlement receipt
```

A failure in the second flow must never invalidate a completed ride in the first. A rider who closes the finish screen should not lose an eligible claim. The account and journey page should be able to reconstruct the pending job from durable receipt/proof state, without inventing raw samples by repeating an average.

The current deferred-claim spec assumes its indexed Walrus blob contains raw telemetry, while `ride-persistence.ts` actually stores a summary. A different oracle path uploads telemetry, but does not establish the indexed, recoverable association assumed by the spec. The redesigned boundary should make the durable data model explicit rather than relying on a page staying mounted. [R5][R10]

### 4.2 Receipt contents and disclosure

A proposed internal `RideReceiptV1` should bind a stable session identifier, authenticated account identifier, optional beneficiary wallet, class/workout version, policy version or hash, provenance class, telemetry commitment, completion timestamp, earned progression, and verification status. If a value-bearing claim is later authorized, its signed or proven statement must additionally bind its recipient, campaign/asset, maximum amount, expiry, and replay nullifier.

This is a proposed interface, not a new production schema. A telemetry commitment should use a deliberately specified, domain-separated, salted commitment scheme appropriate for the proof system. A low-entropy hash of a heart-rate average is not a safe substitute for minimizing health disclosure. Stable internal account identifiers should not be copied into public events merely because they are convenient database keys.

The public statement should contain only the information necessary for the selected benefit. An on-chain achievement might require a recipient and eligibility commitment, not a heart-rate score, injury profile, exact ride time, or public route history. The rider should understand that exporting an achievement can associate a wallet with an activity. Public consent is separate from consent to save private history.

If the receipt is accepted by a SpinChain service, the honest trust statement is “SpinChain approved this session under this policy.” If it comes from a studio or external provider, name that issuer and its authentication method. A private proof may then establish a property of the issuer-bound data. This keeps issuer trust, computational integrity, and confidentiality separate.

### 4.3 The minimal on-chain redemption surface

For an initial value-bearing experiment, use one narrow settlement surface rather than one engine that supports every verification paradigm. A proposed `AchievementRedeemerV2` would accept an issuer-signed typed claim, or a later verifier-approved claim envelope with the same semantic identifiers. It would enforce issuer authorization, beneficiary binding, policy/campaign activation, expiry, one redemption per stable session/campaign nullifier, and campaign/user limits. It would emit only minimal settlement evidence.

EIP-712 provides typed signing and domain separation. It explicitly does not provide replay protection by itself. OpenZeppelin supplies reviewed EIP-712 and signature-checking primitives, including support for ERC-1271 contract signatures; the application still needs its own consumed-nullifier state and eligibility rules. Newer APIs in current documentation must be checked against the installed OpenZeppelin version before implementation. [7][8]

Replay state should survive changes of verifier implementation. The semantic nullifier identifies the eligible session/campaign, not the randomized bytes of one proof. A new proof of the same achievement must not produce a new payout. If a migration changes contracts, preserve or intentionally bridge the old claim registry and maintain a clear cutoff/version rule. Do not treat a fresh address as a clean slate for earned obligations.

For small validation cohorts, individual signed receipts are understandable and auditable. Merkle batches can be evaluated once claims are numerous enough to justify them. A Merkle root proves inclusion in an issuer's published set; it does not independently validate the underlying workout. That distinction is the same for an individual signature, an epoch root, and an oracle report.

## 5. Where ZK, CRE, and state channels fit

### 5.1 Keep ZK as an optional privacy capability

Noir remains useful if the product needs a rider to demonstrate eligibility while hiding raw measurements. However, a redesigned circuit must bind the source commitment, policy, recipient/session identifiers, and stable nullifier into the verified statement. A source or issuer signature over the commitment can establish a provenance boundary; the private computation can then prove the achievement over committed data without publishing the data itself. It still inherits that issuer's trust.

Do not require a browser proof merely to finish or save a ride. Defer heavy proof work to an explicit optional action or a consented background job. A device that cannot generate the proof should retain its ride and progression. Retry state should preserve an already-generated proof, rather than forcing repeated full computation or repeated raw-data uploads.

The existing gas documentation should not guide an economic decision without revision. `ZKGasBenchmark.t.sol` uses `MockVerifier`, so its numbers do not include the cost of real Honk verification. The real-verifier integration tests now establish cryptographic correctness, but test-function gas totals are not a clean production invoice. Measure actual calls with the intended proof, circuit, calldata, chain fees, and settlement mode before setting a gas budget or promising savings. [R11]

A reason to restore ZK as the primary path would be a validated demand for private, independently checkable achievements across applications. A sponsor simply asking SpinChain whether someone completed a session may not need that machinery yet. Make ZK earn its operational complexity through a real privacy requirement.

### 5.2 CRE is relevant to authenticated provider data—not arbitrary BLE measurements

Chainlink's current documentation describes workflows executed across DONs, API/chain capabilities, and a confidential HTTP client whose requests execute in secure enclaves, with secret injection and optional response encryption. The current CRE overview still says production workflow deployment requires approval. The old access dependency should not be assumed resolved solely because the SDK has evolved. [9][10]

This could be useful for retrieving an authenticated wearable-provider activity record without exposing API credentials to ordinary workflow nodes, and producing a policy-approved result. It does not make an unauthenticated third-party endpoint a trustworthy physical sensor, nor does consensus over a provider response establish that the provider observed the right human. The provider integration and permission model must come first.

The current local CRE workflow contains a simulated request and a placeholder wearable URL, rather than a complete production ingestion path. Therefore, “switch to CRE” is not a small deployment toggle in this repository. It means implementing and validating the provider authorization, real event processing, data semantics, replay handling, and report delivery. [R6]

**Recommendation:** leave CRE behind a verification-provider interface. Use it when a real studio/wearable partner makes the external trust useful. Do not put it in the dependency path for starting or completing a solo ride.

### 5.3 Live game feedback does not require state channels

The engine currently maintains multiple reward modes, including channel-based micro-rewards, ZK batches, and a placeholder Sui-native mode. The public settlement contract also accepts arrays of signed updates and applies token-balance multipliers. This is understandable historical experimentation, but it creates distinct operational and recovery paths for one user outcome. [R4][R12]

**Recommendation:** keep the live HUD as an earned-progress estimate and settle only the agreed completed outcome. Park state-channel settlement unless there is a concrete, funded use case where continuously enforceable balances are needed before a ride ends. A rapidly changing number on screen does not, by itself, create that need.

Counterargument: streaming financial rewards could be a differentiator for a crypto-native class. That remains a viable separate experiment. It should be named as an economic product with counterparties, budgets, signatures, and failure behavior, rather than assumed to be necessary for the cycling game's visual loop.

## 6. Wallets, ticketing, and creators

### 6.1 Remove wallet friction before adopting a new wallet standard

ERC-4337 describes bundlers, smart accounts, and paymasters that can sponsor user transactions. Sponsorship is not free: someone must fund and constrain it, and the infrastructure must support the target network. Avalanche's Builder Hub documents embedded-wallet and gas-sponsorship integrations. This is enough to justify evaluating a smoother post-ride wallet journey without changing the settlement chain. [11][12]

It is not enough to assume that every new Ethereum account feature is ready on Fuji. The canonical Avalanche ACP-209 page retrieved in this research labels EIP-7702-style account abstraction “Proposed” and discusses Avalanche-specific compatibility requirements. That source does not establish live activation or wallet/provider coverage for our target deployment. Avoid selecting the architecture on an unverified protocol-support assumption. [13]

**Recommendation:** the first ride remains wallet-free. Account save can use ordinary authentication; wallet linking is an explicit later step. If a rider chooses public redemption, an embedded/exportable wallet or a narrowly constrained relayer can hide gas management where supported. Retain external-wallet connection as a power-user option. The current EVM sign-in route verifies EOA signatures; adopting contract wallets additionally requires a compatible authentication path rather than just a nicer button.

A receipt redeemed for a fixed recipient can support a relayer paying gas without taking custody of the rider's assets. For actions spending a rider's funds, explicit authorization and account infrastructure are different requirements. Do not use broad session permissions or unrestricted paymaster sponsorship simply to remove a modal.

### 6.2 Consolidate access rights if portability becomes useful

The repository has both per-class ERC-721 contracts and ERC-1155 pack infrastructure. OpenZeppelin documents ERC-1155's ability to represent multiple token types and batch operations in a single contract, which can reduce deployment complexity for a multi-item system. [14][R13]

**Recommendation:** if tokenized access is actually required, evaluate one audited multi-class access registry, with class/workout definitions off-chain and explicit versioned identifiers. Avoid deploying a full contract for every generated training plan merely because the builder can generate many plans. Ticket purchase, entitlement checking, refunds, instructor payout, and achievement redemption should remain separable responsibilities.

For the first solo-ride cohort, a conventional account entitlement may be enough. Public portability becomes useful when another application, studio, or creator genuinely needs to verify or honor access. Do not equate token ownership with legal ownership of route intellectual property; licensing and creator agreements require an explicit model. An AI coach is not automatically an independent economic counterparty just because it can sign or compose a class.

Keep creator royalties or stablecoin payouts as optional later business infrastructure. A human instructor's content can still be identified and compensated with the same class identifiers even if the rider's first purchase is through conventional payment rails. The contract should implement the agreed commercial policy, not invent it through a bonding curve.

### 6.3 Native-app rules are a design constraint now

Apple's current guidelines say NFT ownership must not unlock in-app features and generally require in-app purchase for digital functionality. They also distinguish one-to-one real-time fitness training from one-to-many services, and distinguish physical services consumed outside the app. Storefront exceptions and permitted links vary; a generic “fitness” label does not exempt a digital class from review requirements. [15]

This matters because a token-gated world or NFT ticket for a digital spin class might work on the web while conflicting with the planned native distribution model. Earned local cosmetics, private progression, and an optional exportable achievement are easier to separate from purchases than a core app whose features depend on owning an external NFT.

**Recommendation:** decide the initial commercial and distribution model before committing to tokenized memberships. Keep the account entitlement layer able to represent both conventional purchase receipts and optional on-chain access, subject to the applicable platform rules. This report is not legal advice or a guarantee of App Store acceptance.

## 7. Privacy must be a launch property, not a proof-system slogan

The oracle's telemetry-storage method is named and commented as secure/encrypted, but the actual asset path delta-encodes timestamps, includes heart-rate/power/cadence arrays, base64-encodes JSON, and uploads the asset with rider and session metadata. There is no encryption operation in that path. Base64 is reversible encoding. A ZK proof generated elsewhere does not make this separately uploaded data private. [R5]

Walrus Memory's current documentation distinguishes these properties clearly: content addressing establishes integrity of stored bytes, while confidentiality comes from Seal ciphertext. It also describes on-chain account ownership and delegation. Those are capabilities of the documented system, not features automatically inherited by this repository's custom HTTP client. [16]

The EDPB guidance emphasizes data minimization, retention, erasure, and assessing whether personal data belongs on a blockchain at all. It also explains that encrypted personal data remains personal data. This supports a conservative architectural boundary: protect biometric data at the storage layer, not just inside a proof, and do not promise deletion merely because a pointer or key is removed. [17]

**Recommendation:** before a real-bike production test, disable automatic plaintext/raw biometric publication or implement a reviewed consented encryption/retention path. Keep private raw telemetry in an encrypted local or account-controlled store; keep public world art, route assets, and non-sensitive creator metadata separate. If encrypted Walrus storage is chosen, specify key ownership, recovery, revocation, retention, and what remains recoverable after publication.

A receipt/proof persistence design can avoid retaining raw samples indefinitely. Persist only what is needed for retry, audit, and the user's requested history, and make that need explicit. An already-generated proof or minimal signed receipt may be sufficient for post-ride redemption. Do not retain raw biometrics just because a future proof might be convenient.

Health information also reaches AI coaching systems. Apple explicitly requires disclosure and permission for relevant sharing, including third-party AI, and applies additional rules to health/fitness data. Storage privacy, coaching consent, public achievement export, and cloud account sync should be separate choices rather than one misleading “privacy score.” [15]

## 8. Comparison and counterevidence

| Candidate | What it buys | What remains trusted | Wedge fit now | Recommendation |
|---|---|---|---|---|
| Repair current token-per-effort path | Makes the existing real proof submit correctly | Input provenance, unbound metadata, economic policy | Low if required for ride completion | Keep as isolated testnet experiment, not launch architecture |
| Private progression + durable signed receipts | Fast game loop; recoverable history; understandable issuer trust | SpinChain or enrolled issuer | High | Build this boundary first |
| Receipts + optional bounded on-chain redemption | Portability and explicit settlement without blocking rides | Issuer/source plus contract governance | High when a benefit needs portability | Preferred staged direction |
| ZK over issuer-bound commitments | Selective disclosure with stronger computation integrity | Issuer/source; circuit and key correctness | Conditional | Add when privacy/interoperability demand is demonstrated |
| CRE-authenticated provider verification | External API credentials/confidential retrieval and oracle execution | Provider/source, authorized workflow and oracle system | Conditional | Pilot with a real partner; not a ride dependency |
| State-channel micro-rewards | Continuously enforceable off-chain economic updates | Counterparty/signing and channel system | Low for ordinary local game feedback | Park until continuously enforceable payouts are required |

The strongest counterargument to a receipt-first system is centralization. A rider cannot independently force an issuer to approve a session, and a service could change its scoring policy. Address that honestly through versioned policies, inspectable claim data, exportable receipts, and a narrow path to independent verification. Do not pretend an issuer signature is trustless.

The strongest counterargument to parking money is the clinical evidence that combined gamification and financial incentives can help. That argues for keeping a funded campaign option, not for assuming that inflationary transferable tokens are the right mechanism for all users. Test the motivation hypothesis with the intended cohort and retain the results separately from the protocol roadmap. [3][4]

The strongest counterargument to keeping Avalanche is that another ecosystem might offer better wallet tooling or a simpler proof stack. No evidence retrieved establishes that changing chains would solve SpinChain's primary bottleneck. Provenance, policy binding, storage privacy, and recovery would still need redesign. Preserve the existing chain and only reopen that choice if target-network wallet/verification support proves blocking.

Finally, an optional public achievement still has privacy consequences. A collectible can reveal participation, and a supposedly anonymous commitment can become identifying when linked with account data. Minimize public metadata and make export a voluntary product action rather than treating “on-chain” as a default privacy benefit. [17]

## 9. Recommended staged plan and decision gates

**Stage A: retain the useful reliability work.** The already implemented auth, ownership, CTA, proof-interface, and receipt-status fixes are worth keeping. They improve correctness independently of the final economic design. Separate their release readiness from enabling live value-bearing claims. Do not discard tested work simply because the future contract architecture changes.

**Stage B: protect the real ride.** Close automatic raw-telemetry disclosure; ensure saving a completed ride does not wait for proof generation or a transaction; keep demo/simulator progression honestly separate from source-attested eligibility. Confirm account changes and cloud retries never reassociate private history with another wallet.

**Stage C: make the receipt durable.** Specify the canonical session/receipt identity and versioned policy. Persist provenance and pending claim state. Make the journey page able to resume eligible actions after the finish screen is closed, and ensure unavailable evidence produces an honest non-claimable state rather than a dead button.

**Stage D: test a bounded settlement pilot.** If portability or sponsor payouts are a real need, design and review one EIP-712 receipt redeemer with stable nullifiers, expiry, issuer authorization, and budget limits. Keep the payout asset and funded campaign economics explicit. Test wrong recipient, wrong class/policy, expired receipt, cross-chain replay, repeated proof of the same session, issuer rotation, and sponsored-gas abuse before enabling it.

**Stage E: graduate verification only when justified.** Add a studio or wearable source integration; then evaluate CRE or ZK over its authenticated commitment. Measure browser proving time/memory and real-verifier gas with the intended session statement. An aggregate proof or revised circuit may be worth exploring, but no claimed cost reduction is accepted without reproducible real-proof measurements.

**Stage F: return to deployment.** Once the architecture decision is approved, update the current README, architecture, operations, implementation plan, and deferred-claim spec so they agree on what is implemented versus experimental. Apply only the approved additive database migration and chosen testnet contract changes. Then stage, commit, push, deploy, and let the user perform the integrated real wallet/bike/cloud/claim loop on the production app while it remains on testnets.

The existing wedge validation criterion—riders wanting to return without mentioning rewards—remains useful. It is a product hypothesis and a small-cohort learning criterion, not a statistical proof of retention. Add operational criteria: no pre-ride wallet requirement; completion remains available offline; cloud save and public settlement have distinct status; private telemetry is not published by default; retry does not require re-riding; and public redemption never consumes more than the campaign authorizes. [R1]

## 10. Limitations and unresolved choices

This review did not run a live payout, migrate the database, deploy a verifier, or evaluate a real wallet/bike session. It did not establish manufacturer support for signed telemetry, live availability of EIP-7702 on Fuji, a quote for embedded-wallet sponsorship, or production CRE approval for this account. Current documentation describes capabilities; integration compatibility and commercial eligibility still require validation.

The clinical studies are useful counterevidence and design context, not predictions for indoor-cycling retention. The product examples establish that gamification, token earning, and fraud classification exist elsewhere; they do not establish SpinChain's unique advantage. Zwift already markets immersive worlds, training, and community, and its power-ups are established game mechanics. The defensible hypothesis is the quality of effort-responsive transformation and coach continuity, not that competitors have no gamification. [18][19]

Legal, privacy, and app-store conclusions depend on target users, geography, distribution, and the exact payment benefit. This report surfaces relevant constraints and does not replace professional review. No claim of “HIPAA compliant,” “GDPR compliant,” “anti-cheat proof,” or “trustless physical effort” should be inferred.

The key product decision remains: **are rewards primarily progression inside a compelling cycling game, or externally valuable payouts for verified activity?** My recommendation is the first as the default, with the second a bounded optional capability. If the intended first customer pays specifically for independently verifiable activity, source authentication moves earlier and the ZK/CRE roadmap should be prioritized accordingly.

## References

External sources were retrieved or extracted through Tavily during this research. Recommendation language is the author's synthesis, not a claim made by these sources.

1. TLSNotary, [Zero-knowledge is not trustless: public verifiability in zkTLS](https://tlsnotary.org/blog/2026/06/17/public-verifiability), 2026-06-17. Maintainer explanation of witness/notary trust and selective disclosure.
2. Bluetooth SIG, [Fitness Machine Service 1.0.1](https://www.bluetooth.com/specifications/specs/html?src=ftms-v1-0-1_1756429637%2FFTMS_v1.0.1%2Fout%2Fen%2Findex-en.html), sections 4 and 4.9. Primary protocol specification, including security permissions and Indoor Bike Data.
3. Fanaroff et al., [BE ACTIVE randomized controlled trial](https://pmc.ncbi.nlm.nih.gov/articles/PMC11795842), Circulation, 2024, DOI 10.1161/CIRCULATIONAHA.124.069531. Primary trial; population and intervention differ from SpinChain.
4. Strohacker et al., [The impact of incentives on exercise behavior](https://pmc.ncbi.nlm.nih.gov/articles/PMC4412849), Annals of Behavioral Medicine, 2014, DOI 10.1007/s12160-013-9577-4. Systematic review with mixed post-intervention evidence and explicit motivation limitations.
5. STEPN, [Tokenomic](https://whitepaper.stepn.com/other-modules/tokenomic). Official descriptions of GST/GMT and burning mechanics; not evidence of economic sustainability.
6. STEPN, [GST Earning Basic](https://whitepaper.stepn.com/tokenomics/gst). Official earning conditions and SMAC classification; retrieved page links to the current earning-module location.
7. Ethereum, [EIP-712](https://eips.ethereum.org/EIPS/eip-712). Typed signing/domain separation; explicitly excludes replay protection.
8. OpenZeppelin, [Contracts 5.x cryptography](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography). EIP-712, SignatureChecker, ERC-1271 and other maintained primitives; check installed-version compatibility.
9. Chainlink, [CRE overview](https://docs.chain.link/cre). Workflow model and current production deploy-access approval requirement.
10. Chainlink, [Confidential API interactions](https://docs.chain.link/cre/guides/workflow/using-confidential-http-client). Enclave-executed requests, secret injection, optional response encryption.
11. Ethereum, [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337). Smart-account, bundler, and paymaster specification; sponsorship requires funding and validation.
12. Avalanche Builder Hub, [Openfort integration](https://build.avax.network/integrations/openfort). Embedded-wallet/gas-sponsorship documentation; not a verified vendor selection for this app.
13. Avalanche Builder Hub, [ACP-209](https://build.avax.network/docs/acps/209-eip7702-style-account-abstraction). Retrieved page lists the Avalanche proposal as Proposed; no live-activation claim inferred.
14. OpenZeppelin, [ERC-1155](https://docs.openzeppelin.com/contracts/5.x/erc1155). Multi-token and batch-operation architecture.
15. Apple, [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines), sections 3.1, 5.1, and 5.1.3. Digital functionality, NFT ownership, service exceptions, and health/fitness privacy constraints; storefront-specific qualifications apply.
16. Walrus, [Persistent, Verifiable Memory](https://docs.wal.app/walrus-memory/fundamentals/concepts/verifiable-memory). Distinguishes Seal encryption, content integrity, ownership, and durability.
17. European Data Protection Board, [Guidelines 02/2025 on blockchain processing](https://www.edpb.europa.eu/documents/guideline/guidelines-022025-on-processing-of-personal-data-through-blockchain_en). Data minimization, retention, erasure, and encryption limitations; no jurisdictional compliance conclusion inferred.
18. Zwift, [official iOS product link](https://www.zwift.com/ios), which resolves to the developer's App Store listing. Official product claims about worlds, training, and community.
19. Zwift Insider, [PowerUps guide](https://zwiftinsider.com/powerups). Independent specialist source, not Zwift corporate; used only for the described mechanics, not market claims.

### Repository evidence

- **R1:** [WEDGE](../docs/WEDGE.md), especially the core loop, background moats, and validation criterion.
- **R2:** [Noir circuit](../circuits/effort_threshold/src/main.nr) and [browser prover](../app/lib/zk/noir-prover.ts), especially the private struct and three-public-output mapping.
- **R3:** [EffortThresholdVerifier](../contracts/verifiers/EffortThresholdVerifier.sol), especially proof-byte replay tracking and extraction of attached metadata.
- **R4:** [IncentiveEngine](../contracts/evm/IncentiveEngine.sol), especially single/batch ZK claims, reward calculation, and daily mint limits.
- **R5:** [Local oracle telemetry upload](../app/lib/zk/oracle.ts), [Walrus client](../app/lib/walrus/client.ts), and [ride summary persistence](../app/lib/walrus/ride-persistence.ts). Separate summary and raw-telemetry paths; the raw path uses reversible base64, not encryption.
- **R6:** [CRE biometric workflow](../app/lib/chainlink/cre/spinchain/biometric-verify/main.ts). Simulated request and placeholder provider URL.
- **R8:** [BLE parser](../app/lib/ble/parser.ts) and [BLE service](../app/lib/ble/service.ts). Numeric measurement parsing and platform connection, without manufacturer signature checks.
- **R9:** [TieredRewards](../contracts/evm/TieredRewards.sol). Holding-based multipliers and class discounts.
- **R10:** [Journey claim spec](journey-claim-flow.md). Still a spec; its indexed raw-telemetry assumption needs redesign.
- **R11:** [ZKGasBenchmark](../contracts/evm/test/ZKGasBenchmark.t.sol) and [real Honk tests](../contracts/evm/test/EffortThresholdVerifierHonk.t.sol). Mock cost measurements must not be represented as real verifier costs.
- **R12:** [RewardsEngine](../app/engines/rewards-engine.ts). Multiple reward modes and live-state responsibilities.
- **R13:** [SpinClass](../contracts/evm/SpinClass.sol) and [SpinPack](../contracts/evm/SpinPack.sol). Existing overlapping access/ticketing models.
