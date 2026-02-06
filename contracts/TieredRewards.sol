// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TieredRewards
/// @notice Tier system for SPIN holders - shared library for EVM contracts
/// @dev Part of Option B - Independent tokens on AVAX and Sui
/// @custom:security-contact security@spinchain.xyz
library TieredRewards {
    // ============ Tier Constants ============
    uint256 public constant BRONZE_THRESHOLD = 100 * 1e18;
    uint256 public constant SILVER_THRESHOLD = 500 * 1e18;
    uint256 public constant GOLD_THRESHOLD = 2_000 * 1e18;
    uint256 public constant DIAMOND_THRESHOLD = 10_000 * 1e18;

    uint256 public constant BRONZE_MULTIPLIER = 105; // 5% bonus
    uint256 public constant SILVER_MULTIPLIER = 110; // 10% bonus
    uint256 public constant GOLD_MULTIPLIER = 118; // 18% bonus
    uint256 public constant DIAMOND_MULTIPLIER = 125; // 25% bonus
    uint256 public constant BASE_MULTIPLIER = 100;

    // ============ Tier Enum ============
    enum Tier { NONE, BRONZE, SILVER, GOLD, DIAMOND }

    // ============ Events ============
    event TierAchieved(address indexed user, Tier tier, uint256 balance);

    // ============ Functions ============

    /// @notice Determine tier based on SPIN balance
    function getTier(uint256 spinBalance) internal pure returns (Tier) {
        if (spinBalance >= DIAMOND_THRESHOLD) return Tier.DIAMOND;
        if (spinBalance >= GOLD_THRESHOLD) return Tier.GOLD;
        if (spinBalance >= SILVER_THRESHOLD) return Tier.SILVER;
        if (spinBalance >= BRONZE_THRESHOLD) return Tier.BRONZE;
        return Tier.NONE;
    }

    /// @notice Get reward multiplier for a tier (in bps)
    function getMultiplier(Tier tier) internal pure returns (uint256) {
        if (tier == Tier.DIAMOND) return DIAMOND_MULTIPLIER;
        if (tier == Tier.GOLD) return GOLD_MULTIPLIER;
        if (tier == Tier.SILVER) return SILVER_MULTIPLIER;
        if (tier == Tier.BRONZE) return BRONZE_MULTIPLIER;
        return BASE_MULTIPLIER;
    }

    /// @notice Get class discount for a tier (in bps)
    function getDiscountBps(Tier tier) internal pure returns (uint256) {
        // Discounts: Bronze 5%, Silver 10%, Gold 18%, Diamond 25%
        if (tier == Tier.DIAMOND) return 2500;
        if (tier == Tier.GOLD) return 1800;
        if (tier == Tier.SILVER) return 1000;
        if (tier == Tier.BRONZE) return 500;
        return 0;
    }

    /// @notice Apply tier multiplier to reward amount
    function applyMultiplier(uint256 baseAmount, Tier tier) internal pure returns (uint256) {
        return (baseAmount * getMultiplier(tier)) / BASE_MULTIPLIER;
    }

    /// @notice Apply tier discount to class price
    function applyDiscount(uint256 basePrice, Tier tier) internal pure returns (uint256) {
        uint256 discountBps = getDiscountBps(tier);
        return (basePrice * (10_000 - discountBps)) / 10_000;
    }

    /// @notice Get tier name for display
    function getTierName(Tier tier) internal pure returns (string memory) {
        if (tier == Tier.DIAMOND) return "Diamond";
        if (tier == Tier.GOLD) return "Gold";
        if (tier == Tier.SILVER) return "Silver";
        if (tier == Tier.BRONZE) return "Bronze";
        return "None";
    }

    /// @notice Get threshold for a tier
    function getThreshold(Tier tier) internal pure returns (uint256) {
        if (tier == Tier.DIAMOND) return DIAMOND_THRESHOLD;
        if (tier == Tier.GOLD) return GOLD_THRESHOLD;
        if (tier == Tier.SILVER) return SILVER_THRESHOLD;
        if (tier == Tier.BRONZE) return BRONZE_THRESHOLD;
        return 0;
    }
}
