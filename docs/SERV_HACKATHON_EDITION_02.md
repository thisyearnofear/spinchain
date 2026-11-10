# SERV Edition 02 (OpenServ) — SpinChain on the Kite track

**Event:** SERV Hackathon Edition 02 (OpenServ) · Nov 2–15, 2026 · $5,000 pool
**Deadline:** **Nov 15, 2026 23:59 UTC** · judged on creativity ·
user-readiness · revenue potential · **SERV Reasoning mandatory** in the build
Form: https://openserv.typeform.com/submissions02 · key:
https://console.openserv.ai/ · X post tagging @openservai required. Enable
data collection at console.openserv.ai/settings/organization (Edition 01
eligibility rule).

**Status:** UNBLOCKED by the user — the app-store/legal review that held real
users is being lifted so this entry can be submitted. Receipt-first
architecture stands: ride completion saved independently of any chain;
value-bearing redemption stays an optional, separately-approved layer.

## Why SpinChain is the natural Kite-track entry

**The Kite track** asks for agents with *verifiable identity and spending
limits you control, so they can shop, book and pay on your behalf, safely*.

SpinChain already has the pieces committed:

- `app/lib/kite-settlement.ts` — **gokite-aa-sdk**: agent revenue settlement
  in USDC via AA wallet, **spending rule configuration (budgets, time
  windows)**, gasless bundler transactions, attestation IDs + explorer links
- `app/config.ts` — agent passport / AA wallet config against the Kite chain
  testnet ARC (rpc + bundler endpoints)
- Phase-5 pilot: **issuer-signed receipt redemption** (ClaimRegistry +
    AchievementRedeemerV2) dogfooded on Fuji — the "agent earns, spends within a
  budget" loop with receipts built in
- `app/lib/ai-agent-integration.ts` — the agent layer the wedge hangs on

## The wedge feature (what we add for this window)

**Coach agents as first-class, verifiable spenders.** Each coach agent gets a
Kite Passport identity + a spending budget; riders authorize their coach's
budget window. The coach proposes live world/flow/coaching changes and buys
optional paid services (music stems, route renders, achievement settlement)
within its cap — everything else rides free.

1. **SERV Reasoning pass** on coach decisions: propose the service purchase +
   why, bounded, with an explanation field — *commentary only*, the
   deterministic budget guard decides (mirrors the receipt-first rule: the
   chain never sees a buy the cap didn't clear)
2. **Kite settlement receipts**: buy → attestation → USDC settle → explorer
   link stored alongside the ride's receipts (legit: two receipt trails,
   deliberately separate)
3. **Rider control**: budget window + revoke — the "limits you control" axis

## Build plan (Nov 6–14)

- [ ] Unblock launched; confirm real-device validation path for the demo
      (Capacitor build is enough; real-bike stays blocked — demo on device)
- [ ] SERV reasoning toggle on coach purchase proposals
      (`SERV_ENABLED`/`SERV_API_KEY`; rule-floor: budget guard veto)
- [ ] Passport identity per coach + budget window in config UI
- [ ] Settlement receipt page (existing path) extended with purchase history
- [ ] Demo recording: ride → coach proposes stem purchase → cap clear →
      settle → receipt; then a cap-blocked attempt with the guard firing
- [ ] X post + form by Nov 15 23:59 UTC

## Risks (honest)

- Testnet-only (Kite chain + Fuji + Vercel prod for UI) — receipts must be
  labelled as testnet in the post; do not imply real funds moved
- Legal sign-off is in flight; demo stays inside the already-approved scope
- Keep SpinChain identity intact: effort→world narrative first, spend layer
  demoed as the optional achievement/redemption economy — not a finance app

## Links

- Event: https://www.openserv.ai/hackathon-2
- Submission form: https://openserv.typeform.com/submissions02
- Kite Passport docs: https://docs.gokite.ai/passport
- SERV Reasoning docs: https://docs.openserv.ai/serv-reasoning/api
- Edition 01 winners (pattern reference):
  https://www.openserv.ai/hackathon
