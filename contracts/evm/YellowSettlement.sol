// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title YellowSettlement
 * @notice Settlement contract for Yellow state channel rewards
 * @dev Integrates with IncentiveEngine for reward distribution
 * 
 * Core Principles:
 * - CLEAN: Minimal contract, delegates reward logic to IncentiveEngine
 * - MODULAR: Can be used standalone or as part of reward system
 * - DRY: Reuses existing reward calculation and minting logic
 */

interface ISpinToken {
    function mint(address to, uint256 amount) external;
}

interface IIncentiveEngine {
    function calculateReward(uint16 effortScore) external pure returns (uint256);
}

/**
 * @notice Final state of a Yellow reward channel
 */
struct ChannelState {
    bytes32 channelId;
    address rider;
    address instructor;
    bytes32 classId;
    uint256 finalReward;
    uint16 effortScore; // 0-1000
    bytes riderSignature;
    bytes instructorSignature;
    bool settled;
}

/**
 * @notice Signed reward update from streaming session
 */
struct SignedUpdate {
    uint256 timestamp;
    uint256 sequence;
    uint256 accumulatedReward;
    uint16 heartRate;
    uint16 power;
    bytes signature;
}

contract YellowSettlement is ReentrancyGuard, Ownable {
    using ECDSA for bytes32;

    // ============ Errors ============
    error ChannelAlreadySettled();
    error InvalidSignatures();
    error InvalidChannel();
    error RewardTooHigh();
    error DailyLimitExceeded();

    // ============ Constants ============
    uint256 public constant DAILY_MINT_LIMIT = 1_000_000 * 1e18; // 1M SPIN per day
    uint256 public constant MAX_REWARD_PER_CHANNEL = 1000 * 1e18; // 1000 SPIN max per class

    // ============ State ============
    ISpinToken public rewardToken;
    IIncentiveEngine public incentiveEngine;
    
    mapping(bytes32 => ChannelState) public channels;
    mapping(uint256 => uint256) public dailyMinted; // day => amount
    mapping(address => uint256) public totalSettled; // rider => total rewards

    // ============ Events ============
    event ChannelSettled(
        bytes32 indexed channelId,
        address indexed rider,
        address indexed instructor,
        uint256 reward,
        uint16 effortScore
    );
    event RewardTokenUpdated(address indexed token);
    event IncentiveEngineUpdated(address indexed engine);

    // ============ Constructor ============
    constructor(
        address owner_,
        address token_,
        address engine_
    ) Ownable(owner_) {
        rewardToken = ISpinToken(token_);
        incentiveEngine = IIncentiveEngine(engine_);
    }

    // ============ Admin ============
    function setRewardToken(address token_) external onlyOwner {
        rewardToken = ISpinToken(token_);
        emit RewardTokenUpdated(token_);
    }

    function setIncentiveEngine(address engine_) external onlyOwner {
        incentiveEngine = IIncentiveEngine(engine_);
        emit IncentiveEngineUpdated(engine_);
    }

    // ============ Settlement ============

    /**
     * @notice Settle rewards from a Yellow state channel
     * @param state Final signed state from the channel
     * @param updates Array of signed updates proving effort
     */
    function settleChannel(
        ChannelState calldata state,
        SignedUpdate[] calldata updates
    ) external nonReentrant {
        // Validate channel not already settled
        if (channels[state.channelId].settled) revert ChannelAlreadySettled();
        
        // Validate reward amount
        if (state.finalReward > MAX_REWARD_PER_CHANNEL) revert RewardTooHigh();

        // Verify signatures
        if (!_verifyChannelState(state, updates)) revert InvalidSignatures();

        // Mark as settled
        ChannelState storage stored = channels[state.channelId];
        stored.channelId = state.channelId;
        stored.rider = state.rider;
        stored.instructor = state.instructor;
        stored.classId = state.classId;
        stored.finalReward = state.finalReward;
        stored.effortScore = state.effortScore;
        stored.settled = true;

        // Mint rewards
        _mintWithLimit(state.rider, state.finalReward);
        totalSettled[state.rider] += state.finalReward;

        emit ChannelSettled(
            state.channelId,
            state.rider,
            state.instructor,
            state.finalReward,
            state.effortScore
        );
    }

    /**
     * @notice Batch settle multiple channels (for instructor efficiency)
     * @param states Array of channel states to settle
     * @dev Each rider's reward is minted directly to their address, not to this contract.
     */
    function batchSettle(ChannelState[] calldata states) external nonReentrant {
        for (uint i = 0; i < states.length; i++) {
            ChannelState calldata state = states[i];
            
            if (channels[state.channelId].settled) continue;
            if (state.finalReward > MAX_REWARD_PER_CHANNEL) continue;
            
            // Store settlement
            channels[state.channelId] = state;
            channels[state.channelId].settled = true;
            
            totalSettled[state.rider] += state.finalReward;
            
            // Mint directly to the rider, not to address(this)
            _mintWithLimit(state.rider, state.finalReward);
            
            emit ChannelSettled(
                state.channelId,
                state.rider,
                state.instructor,
                state.finalReward,
                state.effortScore
            );
        }
    }

    // ============ View Functions ============

    /**
     * @notice Check if a channel has been settled
     */
    function isSettled(bytes32 channelId) external view returns (bool) {
        return channels[channelId].settled;
    }

    /**
     * @notice Get total rewards settled for a rider
     */
    function getTotalSettled(address rider) external view returns (uint256) {
        return totalSettled[rider];
    }

    /**
     * @notice Calculate expected reward from effort score
     */
    function calculateExpectedReward(uint16 effortScore) external view returns (uint256) {
        return incentiveEngine.calculateReward(effortScore);
    }

    // ============ Internal ============

    /**
     * @notice Verify channel state signatures
     * @dev In production, verifies both rider and instructor signatures
     * For demo, simplified verification
     */
    function _verifyChannelState(
        ChannelState calldata state,
        SignedUpdate[] calldata updates
    ) internal pure returns (bool) {
        // Verify we have updates
        if (updates.length == 0) return false;

        // Verify final reward matches last update
        SignedUpdate memory lastUpdate = updates[updates.length - 1];
        if (lastUpdate.accumulatedReward != state.finalReward) return false;

        // Verify rider signature on final state
        bytes32 messageHash = keccak256(abi.encodePacked(
            state.channelId,
            state.rider,
            state.instructor,
            state.finalReward,
            state.effortScore
        ));
        
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address recoveredRider = ethSignedMessageHash.recover(state.riderSignature);
        
        if (recoveredRider != state.rider) return false;

        // TODO: Verify instructor signature in production
        // TODO: Verify all intermediate updates form valid chain

        return true;
    }

    function _mintWithLimit(address to, uint256 amount) internal {
        uint256 today = block.timestamp / 1 days;
        if (dailyMinted[today] + amount > DAILY_MINT_LIMIT) {
            revert DailyLimitExceeded();
        }
        
        dailyMinted[today] += amount;
        rewardToken.mint(to, amount);
    }
}
