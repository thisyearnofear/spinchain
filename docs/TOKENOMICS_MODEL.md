# SPIN Tokenomics Economic Model

## Assumptions & Scenarios

### Base Case (Conservative)

| Parameter | Value | Notes |
|-------------|-------|-------|
| Initial SPIN Supply | 100,000,000 | Fixed supply, deflationary |
| Initial SPIN Price | $0.01 | Bootstrap phase |
| Avg Class Price | $25 | Competitive with Peloton |
| Classes per Day (Month 1) | 10 | Bootstrap phase |
| Classes per Day (Month 6) | 100 | Growth phase |
| Classes per Day (Year 1) | 500 | Mature phase |
| Treasury % | 15% | Of each class payment |
| SPIN Buyback % | 100% | Treasury → SPIN |
| Burn Rate | 20% | Of bought SPIN |

### Revenue Projections

**Month 1**:
- Classes: 10/day × 30 days = 300 classes
- Revenue: 300 × $25 = $7,500
- Treasury: $7,500 × 15% = $1,125
- SPIN Buyback: $1,125 at $0.01 = 112,500 SPIN
- Burned: 22,500 SPIN
- Net Supply Change: -22,500 SPIN (deflationary!)

**Month 6**:
- Classes: 100/day × 30 = 3,000 classes
- Revenue: 3,000 × $25 = $75,000
- Treasury: $75,000 × 15% = $11,250
- SPIN Buyback: $11,250 at $0.05 = 225,000 SPIN
- Burned: 45,000 SPIN
- Net Supply Change: -45,000 SPIN

**Year 1**:
- Classes: 500/day × 365 = 182,500 classes
- Revenue: 182,500 × $25 = $4,562,500
- Treasury: $4,562,500 × 15% = $684,375
- SPIN Buyback: $684,375 at $0.50 = 1,368,750 SPIN
- Burned: 273,750 SPIN
- Net Supply Change: -273,750 SPIN

### Price Appreciation Model

```
Price = (Market Cap) / (Circulating Supply)

Market Cap Drivers:
1. Treasury buybacks (direct demand)
2. User demand for discounts (utility demand)
3. Speculation (expectation of future demand)
4. Staking yield (opportunity cost)

Simple Model:
- Each $1 of buyback → $5-10 market cap increase (crypto multiple)
- Year 1 buybacks: $684,375
- Implied market cap: $3.4M - $6.8M
- Circulating supply: ~80M (after burns + emissions)
- Implied price: $0.04 - $0.08

But if price reaches $0.50:
- Same buyback $ buys fewer SPIN
- More deflationary
- Price support increases
```

### User Holding Incentives

**Scenario: User rides 4x per month ($100 spend)**

Without SPIN:
- Monthly cost: $100
- Annual cost: $1,200

With 500 SPIN ("Cyclist" tier - 10% discount):
- SPIN cost at $0.05: $25
- Monthly class cost: $90 (10% off)
- Annual class cost: $1,080
- Savings: $120/year
- ROI on SPIN: 480% in year 1

**Conclusion**: Even small holdings are economically rational.

### Instructor Economics

**Scenario: Instructor runs 20 classes/month, 20 riders each**

Gross Revenue: 20 classes × 20 riders × $25 = $10,000/month

Distribution:
- Instructor (70%): $7,000
- Treasury (15%): $1,500
- Platform (10%): $1,000
- Insurance (5%): $500

**SPIN Challenge Incentive**:
Instructor creates "Most Improved FTP" challenge:
- Prize pool: 1,000 SPIN (~$50 at $0.05)
- Entry fee: 50 SPIN per rider
- 20 participants = 1,000 SPIN collected
- Winner gets 800 SPIN (80%)
- Platform gets 100 SPIN (10%)
- Burn 100 SPIN (10%)

**Result**: 
- Instructor cost: $0 (entry fees cover prize)
- Engagement: High (competition drives retention)
- SPIN demand: 1,000 SPIN bought for challenge

### Stress Test: Low Volume Scenario

**Worst case: Only 5 classes/day**

Monthly:
- Revenue: 150 × $25 = $3,750
- Treasury: $562.50
- SPIN buyback at $0.01: 56,250 SPIN

**Problem**: Low buy pressure, price stagnates

**Mitigation**:
- Treasury uses reserves to buy SPIN anyway
- Focus on user acquisition (growth over profit)
- Partner with fitness influencers for bootstrapping

### Stress Test: High Volume Scenario

**Best case: 2,000 classes/day**

Monthly:
- Revenue: 60,000 × $25 = $1,500,000
- Treasury: $225,000
- SPIN buyback at $1.00: 225,000 SPIN

**Result**: 
- Strong buy pressure
- Price appreciates
- Early holders rewarded
- New users attracted by discounts

### The "Death Spiral" Risk

**What if class volume drops 50%?**

- Buy pressure drops 50%
- Price drops
- Users sell SPIN (no longer worth holding)
- Price drops more
- [Death spiral]

**Mitigations**:
1. **Minimum buyback guarantee**: Treasury commits to minimum monthly buyback regardless of volume
2. **Staking lockups**: Longer locks = higher yields (prevents panic selling)
3. **Real-world utility**: SPIN useful outside platform (equipment discounts)
4. **Treasury diversification**: Hold stablecoins, not just SPIN

### Token Unlock Schedule Impact

**Team tokens (15% = 15M SPIN) vesting over 4 years:**

- Month 12: 3.75M unlocks
- If price is $0.10: $375,000 value
- If team sells 100%: Price impact?
  - Daily volume assumption: $50,000
  - 3.75M / 30 days = 125k SPIN/day
  - $12,500 sell pressure/day
  - 25% of daily volume → Significant but manageable

**Solution**: Staggered unlocks, team commitment to hold X%.

### Comparison: Fixed vs Dynamic Burn

**Fixed 20% burn**:
- Predictable
- Easy to model
- Doesn't adapt to market conditions

**Dynamic burn (based on volume)**:
- Low volume: 5% burn (preserve supply)
- High volume: 30% burn (accelerate deflation)
- Complex to implement
- Gameable?

**Recommendation**: Start fixed, move to dynamic after Year 1.

### Sensitivity Analysis

| Variable | -20% | Base | +20% | Impact on Price |
|----------|------|------|------|-----------------|
| Class volume | -30% | Base | +40% | High sensitivity |
| Class price | -15% | Base | +25% | Medium |
| Treasury % | -10% | Base | +15% | Medium |
| Burn rate | -5% | Base | +10% | Low (long-term) |

**Key insight**: Class volume is the most important variable. Everything else is secondary.

### Recommendations

1. **Bootstrap Phase (Months 1-6)**:
   - Treasury subsidizes buybacks (use seed funding)
   - Aggressive user acquisition (discounts for SPIN holders)
   - Don't worry about profitability, worry about volume

2. **Growth Phase (Months 6-18)**:
   - Let tokenomics run organically
   - Introduce staking yields
   - Launch instructor challenges

3. **Maturity Phase (Year 2+)**:
   - Transition to DAO governance
   - Real-world redemption partnerships
   - Cross-chain expansion

### Open Questions for Modeling

1. What's the elasticity of demand for classes at different price points?
2. How much SPIN will users actually hold vs immediately sell?
3. What's the correlation between crypto market cycles and fitness app usage?
4. How do competitor actions affect our volume assumptions?

### Next Steps

1. Build spreadsheet with these variables
2. Run Monte Carlo simulation (10,000 scenarios)
3. Identify failure modes and mitigations
4. Set up on-chain metrics dashboard
5. Monthly review and parameter adjustment

---

## Simple Calculator

```typescript
// Pseudo-code for tokenomics calculator

function calculateMonth(params: {
  classesPerDay: number,
  avgClassPrice: number,
  spinPrice: number,
  treasuryPercent: number,
  burnRate: number,
}) {
  const monthlyClasses = params.classesPerDay * 30;
  const revenue = monthlyClasses * params.avgClassPrice;
  const treasury = revenue * params.treasuryPercent;
  const spinBought = treasury / params.spinPrice;
  const spinBurned = spinBought * params.burnRate;
  
  return {
    revenue,
    treasury,
    spinBought,
    spinBurned,
    netSupplyChange: -spinBurned, // Deflationary!
  };
}
```

**Try it**: Plug in your assumptions, see what happens!
