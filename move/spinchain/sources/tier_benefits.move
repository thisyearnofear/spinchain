/// Module: tier_benefits
/// Description: Tier system for SPIN holders on Sui (Option B - Independent)
/// Matches EVM TieredRewards.sol thresholds and multipliers
module spinchain::tier_benefits {
    use sui::event;
    use sui::tx_context::{Self, TxContext};

    // === Constants ===
    // Tier thresholds (9 decimals like SPIN token)
    const BRONZE_THRESHOLD: u64 = 100_000_000_000;      // 100 SPIN
    const SILVER_THRESHOLD: u64 = 500_000_000_000;      // 500 SPIN
    const GOLD_THRESHOLD: u64 = 2_000_000_000_000;      // 2,000 SPIN
    const DIAMOND_THRESHOLD: u64 = 10_000_000_000_000;  // 10,000 SPIN

    // Multipliers (in bps, 100 = 1x)
    const BASE_MULTIPLIER: u64 = 100;
    const BRONZE_MULTIPLIER: u64 = 105;   // 5% bonus
    const SILVER_MULTIPLIER: u64 = 110;   // 10% bonus
    const GOLD_MULTIPLIER: u64 = 118;     // 18% bonus
    const DIAMOND_MULTIPLIER: u64 = 125;  // 25% bonus

    // Discounts (in bps)
    const BRONZE_DISCOUNT_BPS: u64 = 500;   // 5%
    const SILVER_DISCOUNT_BPS: u64 = 1000;  // 10%
    const GOLD_DISCOUNT_BPS: u64 = 1800;    // 18%
    const DIAMOND_DISCOUNT_BPS: u64 = 2500; // 25%

    const BPS_DENOMINATOR: u64 = 10_000;

    // === Errors ===
    const EInvalidTier: u64 = 0;

    // === Enums ===
    public enum Tier has copy, drop, store {
        None,
        Bronze,
        Silver,
        Gold,
        Diamond,
    }

    // === Events ===
    public struct TierAchieved has copy, drop {
        user: address,
        tier: Tier,
        balance: u64,
    }

    public struct TierChecked has copy, drop {
        user: address,
        tier: Tier,
        multiplier: u64,
        discount_bps: u64,
    }

    // === Public Functions ===

    /// Get tier based on SPIN balance
    public fun get_tier(balance: u64): Tier {
        if (balance >= DIAMOND_THRESHOLD) {
            Tier::Diamond
        } else if (balance >= GOLD_THRESHOLD) {
            Tier::Gold
        } else if (balance >= SILVER_THRESHOLD) {
            Tier::Silver
        } else if (balance >= BRONZE_THRESHOLD) {
            Tier::Bronze
        } else {
            Tier::None
        }
    }

    /// Get reward multiplier for tier
    public fun get_multiplier(tier: &Tier): u64 {
        match (*tier) {
            Tier::Diamond => DIAMOND_MULTIPLIER,
            Tier::Gold => GOLD_MULTIPLIER,
            Tier::Silver => SILVER_MULTIPLIER,
            Tier::Bronze => BRONZE_MULTIPLIER,
            Tier::None => BASE_MULTIPLIER,
        }
    }

    /// Get discount bps for tier
    public fun get_discount_bps(tier: &Tier): u64 {
        match (*tier) {
            Tier::Diamond => DIAMOND_DISCOUNT_BPS,
            Tier::Gold => GOLD_DISCOUNT_BPS,
            Tier::Silver => SILVER_DISCOUNT_BPS,
            Tier::Bronze => BRONZE_DISCOUNT_BPS,
            Tier::None => 0,
        }
    }

    /// Apply tier multiplier to reward amount
    public fun apply_multiplier(amount: u64, tier: &Tier): u64 {
        let multiplier = get_multiplier(tier);
        (amount * multiplier) / BASE_MULTIPLIER
    }

    /// Apply tier discount to price
    public fun apply_discount(price: u64, tier: &Tier): u64 {
        let discount_bps = get_discount_bps(tier);
        (price * (BPS_DENOMINATOR - discount_bps)) / BPS_DENOMINATOR
    }

    /// Get tier name as string for display
    public fun get_tier_name(tier: &Tier): vector<u8> {
        match (*tier) {
            Tier::Diamond => b"Diamond",
            Tier::Gold => b"Gold",
            Tier::Silver => b"Silver",
            Tier::Bronze => b"Bronze",
            Tier::None => b"None",
        }
    }

    /// Get threshold for tier
    public fun get_threshold(tier: &Tier): u64 {
        match (*tier) {
            Tier::Diamond => DIAMOND_THRESHOLD,
            Tier::Gold => GOLD_THRESHOLD,
            Tier::Silver => SILVER_THRESHOLD,
            Tier::Bronze => BRONZE_THRESHOLD,
            Tier::None => 0,
        }
    }

    /// Check and emit tier achievement event
    public fun check_and_emit_tier(user: address, balance: u64, ctx: &TxContext) {
        let tier = get_tier(balance);
        
        event::emit(TierChecked {
            user,
            tier,
            multiplier: get_multiplier(&tier),
            discount_bps: get_discount_bps(&tier),
        });

        // Only emit achievement if above None
        if (tier != Tier::None) {
            event::emit(TierAchieved {
                user,
                tier,
                balance,
            });
        }
    }

    // === View Functions ===

    public fun bronze_threshold(): u64 { BRONZE_THRESHOLD }
    public fun silver_threshold(): u64 { SILVER_THRESHOLD }
    public fun gold_threshold(): u64 { GOLD_THRESHOLD }
    public fun diamond_threshold(): u64 { DIAMOND_THRESHOLD }
}
