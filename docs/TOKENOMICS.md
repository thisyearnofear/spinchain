# SPIN Tokenomics Design

## Core Problem Statement

Current state: Users earn SPIN tokens but there's no sustainable value accrual mechanism. Without demand-side pressure, tokens become inflationary rewards with no utility.

## Design Goals

1. **Sustainable Value Accrual**: Every class payment creates buy pressure on SPIN
2. **Natural Demand**: Users want SPIN for tangible benefits (discounts, access, status)
3. **Instructor Alignment**: Instructors benefit from holding and distributing SPIN
4. **Cross-Chain Unity**: Single economic model across Sui and Avalanche
5. **Progressive Unlock**: Benefits scale with holding amount (not binary)

---

## Token Flow Architecture

### 1. Primary Value Accrual: The "SpinCycle"

```
User pays for class (USDC/ETH/SUI)
         ↓
   [10-20%] automatically swapped to SPIN
         ↓
    ┌────┴────┐
    ↓         ↓
Burn (5%)  Treasury (95%)
    ↓         ↓
Deflation  Instructor rewards
           User rewards pool
           Staking rewards
```

**Key insight**: Every class payment = SPIN buy pressure. The more popular the platform, the more valuable SPIN becomes.

### 2. User Utility Tiers (Progressive Benefits)

| Tier | SPIN Required | Benefits |
|------|---------------|----------|
| **Rider** | 0 SPIN | Basic class access |
| **Spinner** | 100 SPIN | 5% class discount, basic agent access |
| **Cyclist** | 500 SPIN | 10% discount, premium agents, early class access |
| **Peloton** | 2,000 SPIN | 15% discount, exclusive agents, private classes |
| **Century** | 10,000 SPIN | 25% discount, governance, revenue share |

**Benefits are multiplicative** - hold more SPIN, get more value. No binary "you have it or you don't."

### 3. Instructor Incentive Mechanisms

Instructors can create **SPIN-backed challenges** with verifiable metrics:

#### Verifiable On-Chain Metrics (via ZK proofs)
- **Effort Score**: Heart rate × power × duration
- **Consistency**: Classes attended per week
- **Improvement**: Resting HR decrease over time
- **Power Progression**: FTP (Functional Threshold Power) improvement
- **Zone Mastery**: Time in target heart rate zones

#### Challenge Types
```
Instructor creates challenge:
├── Prize Pool: 1000 SPIN (from instructor treasury)
├── Metric: "Most improved FTP over 4 weeks"
├── Entry: 50 SPIN (creates demand)
├── Verification: ZK proof of effort data
└── Winner takes: 80% of pool
    Platform: 10%
    Burn: 10%
```

### 4. Cross-Chain Mechanics

**SPIN (Avalanche)**: ERC-20, primary trading, deep liquidity
**SPIN (Sui)**: Native object, fast transfers, gaming integrations

**Bridge Flow**:
```
User wants to use Sui-native feature
        ↓
   Lock SPIN on Avalanche
        ↓
   Mint SPIN on Sui (1:1)
        ↓
   Use on Sui ecosystem
        ↓
   Burn Sui SPIN
        ↓
   Unlock Avalanche SPIN
```

**Key**: SPIN supply is managed across chains. Total supply is fixed/controlled.

---

## Economic Sustainability Model

### Revenue Sources

| Source | % of Class Price | Destination |
|--------|------------------|-------------|
| Instructor | 70% | Direct payout |
| Treasury | 15% | SPIN buyback + operations |
| Platform | 10% | Development, marketing |
| Insurance | 5% | Refund pool, disputes |

### Treasury Allocation (from 15%)

```
Treasury receives USDC/ETH
        ↓
   DEX swap to SPIN
        ↓
    ┌───┼───┐
    ↓   ↓   ↓
  Burn Stake Rewards
   20%  30%  50%
        ↓
   Staked SPIN earns
   more SPIN + USDC
```

### The Virtuous Cycle

```
More users → More class payments
                ↓
         More SPIN buybacks
                ↓
         SPIN price increases
                ↓
    Existing holders wealth increases
                ↓
         They hold longer
                ↓
         Supply shock
                ↓
         Price increases more
                ↓
    New users want SPIN for discounts
                ↓
         More demand
                ↓
    [Cycle repeats]
```

---

## Token Distribution & Emissions

### Initial Distribution

| Category | % | Vesting | Purpose |
|----------|---|---------|---------|
| Community Rewards | 40% | 4 years linear | Ride-to-earn, challenges |
| Team & Advisors | 15% | 4 years cliff + linear | Long-term alignment |
| Treasury | 20% | 2 years linear | Operations, marketing |
| Liquidity | 15% | Immediate | DEX pools |
| Early Backers | 10% | 2 years linear | Initial funding |

### Emissions Schedule

**Year 1**: 25% of rewards pool (high inflation to bootstrap)
**Year 2**: 20% of remaining
**Year 3**: 15% of remaining
**Year 4+**: 10% of remaining (sustainable long-term)

**Halving mechanism**: Every 2 years, emissions halve.

---

## Advanced Features (Future)

### 1. SPIN-Backed Class Insurance
- Users stake SPIN as collateral
- If class is cancelled, stakers cover refunds
- Stakers earn yield from insurance fees

### 2. Agent Governance
- Hold SPIN to vote on AI agent features
- Propose new agent personalities
- Vote on protocol parameter changes

### 3. NFT Integration
- Complete challenges → Earn NFT badges
- NFTs boost SPIN earnings (multiplier)
- Tradeable, but soulbound for core achievements

### 4. Real-World Redemptions
- SPIN → Fitness equipment discounts
- SPIN → Gym partnerships
- SPIN → Health insurance discounts

---

## Open Questions

### Critical Decisions Needed

1. **Initial Supply**: 100M? 1B? Infinite with burn?
2. **Burn Rate**: Fixed % or dynamic based on volume?
3. **Bridge Custody**: Who controls the bridge? (Multisig? DAO?)
4. **Sui vs AVAX Priority**: Which chain gets features first?
5. **Regulatory**: Is SPIN a security? (Utility token design)

### Risk Factors

| Risk | Mitigation |
|------|------------|
| Low class volume = no buy pressure | Bootstrap with treasury buybacks |
| Whale manipulation | Holding caps for governance |
| Bridge exploit | Insurance fund + gradual unlocks |
| Instructor churn | Revenue share locks them in |
| Regulatory | Utility-first design, no profit promises |

---

## Success Metrics

### Phase 1 (Months 1-3): Bootstrap
- [ ] 1000+ classes completed
- [ ] 500+ SPIN holders
- [ ] $10k+ treasury accumulated

### Phase 2 (Months 4-12): Growth
- [ ] 10,000+ classes completed
- [ ] SPIN market cap > $1M
- [ ] 50%+ of users hold SPIN for discounts

### Phase 3 (Year 2+): Maturity
- [ ] Self-sustaining treasury (no external funding)
- [ ] SPIN trading on major DEXs
- [ ] Real-world redemption partnerships

---

## Next Steps

1. **Model the math**: Excel simulation with different scenarios
2. **Legal review**: Token classification in key jurisdictions
3. **Community feedback**: Share with early users, get input
4. **MVP contracts**: Start with basic SPIN + simple discount tier
5. **Testnet launch**: Let users play with fake money first

---

## Appendix: Comparison to Other Models

| Project | Model | Our Differentiation |
|---------|-------|---------------------|
| STEPN | Move-to-earn, shoe NFTs | No NFT requirement, real fitness data |
| Sweatcoin | Step counting | ZK privacy, DeFi integrations |
| Axie | Play-to-earn, breeding | Real-world utility (fitness), sustainable burns |
| Lido | Liquid staking | Fitness-verified staking |

**Our moat**: Real fitness data + privacy-preserving ZK proofs + sustainable economics.
