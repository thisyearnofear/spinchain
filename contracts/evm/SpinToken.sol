// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title SpinToken
/// @notice ERC-20 SPIN token for Avalanche (Option B - Independent deployment)
/// @dev Part of dual-chain tokenomics: 50M supply on AVAX, 50M on Sui
/// @custom:security-contact security@spinchain.xyz
contract SpinToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    // ============ Errors ============
    error InvalidAmount();
    error ZeroAddress();

    // ============ Events ============
    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);
    event BuybackBurned(uint256 buybackAmount, uint256 burnedAmount, uint256 rewardAmount);

    // ============ Tokenomics Constants ============
    uint256 public constant MAX_SUPPLY = 50_000_000 * 1e18; // 50M SPIN on AVAX
    uint256 public constant BUYBACK_BURN_BPS = 2000; // 20% of buyback burned
    uint256 public constant BUYBACK_REWARD_BPS = 8000; // 80% to rewards

    // ============ State ============
    uint256 public totalBurned;
    uint256 public totalBuyback;

    constructor(address owner_) 
        ERC20("SpinToken", "SPIN") 
        Ownable(owner_)
        ERC20Permit("SpinToken") 
    {}

    /// @notice Mint new SPIN tokens (only owner - IncentiveEngine)
    /// @dev Enforces max supply cap for AVAX chain
    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (totalSupply() + amount > MAX_SUPPLY) revert InvalidAmount();
        
        _mint(to, amount);
        emit Minted(to, amount);
    }

    /// @notice Burn tokens (any holder can burn their own)
    function burn(uint256 amount) public override {
        super.burn(amount);
        totalBurned += amount;
        emit Burned(msg.sender, amount);
    }

    /// @notice Burn tokens from an approved address
    function burnFrom(address account, uint256 amount) public override {
        super.burnFrom(account, amount);
        totalBurned += amount;
        emit Burned(account, amount);
    }

    /// @notice Treasury buyback burn - called after LI.FI swap
    /// @param buybackAmount Total SPIN acquired from buyback
    /// @dev 20% burned, 80% sent to rewards pool (off-chain via LI.FI)
    function recordBuybackBurn(uint256 buybackAmount) external onlyOwner {
        if (buybackAmount == 0) revert InvalidAmount();
        
        uint256 burnAmount = (buybackAmount * BUYBACK_BURN_BPS) / 10_000;
        uint256 rewardAmount = (buybackAmount * BUYBACK_REWARD_BPS) / 10_000;
        
        totalBuyback += buybackAmount;
        totalBurned += burnAmount;
        
        // Burn the 20% portion
        _burn(address(this), burnAmount);
        
        emit BuybackBurned(buybackAmount, burnAmount, rewardAmount);
    }

    // ============ View Functions ============
    
    /// @notice Get circulating supply (total - burned)
    function circulatingSupply() external view returns (uint256) {
        return totalSupply() - totalBurned;
    }

    /// @notice Get remaining mintable supply
    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }
}
