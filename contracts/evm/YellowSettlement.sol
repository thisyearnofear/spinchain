// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
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
    bytes32 channelId;
    bytes32 classId;
    address rider;
    address instructor;
    uint256 timestamp;
    uint256 sequence;
    uint256 accumulatedReward;
    uint16 heartRate;
    uint16 power;
    bytes signature;
}

contract YellowSettlement is EIP712, ReentrancyGuard, Ownable {
    using ECDSA for bytes32;

    // ============ Errors ============
    error ChannelAlreadySettled();
    error InvalidSignatures();
    error InvalidChannel();
    error RewardTooHigh();
    error DailyLimitExceeded();
    error InvalidUpdateChain();
    error EmptyUpdates();

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
    // ============ EIP-712 ============
    // Domain separator includes chainId + verifyingContract via OZ EIP712.
    // This prevents cross-chain and cross-contract replay.

    bytes32 private constant CHANNEL_STATE_TYPEHASH = keccak256(
        "ChannelState(bytes32 channelId,address rider,address instructor,bytes32 classId,uint256 finalReward,uint16 effortScore)"
    );

    bytes32 private constant UPDATE_TYPEHASH = keccak256(
        "SignedUpdate(bytes32 channelId,bytes32 classId,address rider,address instructor,uint256 timestamp,uint256 sequence,uint256 accumulatedReward,uint16 heartRate,uint16 power)"
    );

    constructor(
        address owner_,
        address token_,
        address engine_
    ) EIP712("SpinChainYellowSettlement", "1") Ownable(owner_) {
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
    function batchSettle(
        ChannelState[] calldata states,
        SignedUpdate[][] calldata updatesArray
    ) external nonReentrant {
        if (states.length != updatesArray.length) revert InvalidChannel();

        for (uint i = 0; i < states.length; i++) {
            ChannelState calldata state = states[i];
            SignedUpdate[] calldata updates = updatesArray[i];

            // Skip already settled channels to allow idempotent batching
            if (channels[state.channelId].settled) continue;
            if (state.finalReward > MAX_REWARD_PER_CHANNEL) revert RewardTooHigh();

            if (!_verifyChannelState(state, updates)) revert InvalidSignatures();

            ChannelState storage stored = channels[state.channelId];
            stored.channelId = state.channelId;
            stored.rider = state.rider;
            stored.instructor = state.instructor;
            stored.classId = state.classId;
            stored.finalReward = state.finalReward;
            stored.effortScore = state.effortScore;
            stored.settled = true;

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
    ) internal view returns (bool) {
        // Verify we have updates
        if (updates.length == 0) revert EmptyUpdates();

        // Bind channelId to this contract + chainId + participants + class.
        // This prevents reusing the same signatures across contracts/chains/classes.
        bytes32 expectedChannelId = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                state.rider,
                state.instructor,
                state.classId
            )
        );
        if (state.channelId != expectedChannelId) revert InvalidChannel();

        // Verify final reward matches last update
        SignedUpdate calldata lastUpdate = updates[updates.length - 1];
        if (lastUpdate.accumulatedReward != state.finalReward) revert InvalidUpdateChain();

        // Verify rider + instructor signatures on final state (EIP-712)
        bytes32 stateStructHash = keccak256(
            abi.encode(
                CHANNEL_STATE_TYPEHASH,
                state.channelId,
                state.rider,
                state.instructor,
                state.classId,
                state.finalReward,
                state.effortScore
            )
        );
        bytes32 stateDigest = _hashTypedDataV4(stateStructHash);

        address recoveredRider = stateDigest.recover(state.riderSignature);
        if (recoveredRider != state.rider) return false;

        address recoveredInstructor = stateDigest.recover(state.instructorSignature);
        if (recoveredInstructor != state.instructor) return false;

        // Verify updates are ordered, consistent, and signed by rider
        uint256 prevSequence = 0;
        uint256 prevTimestamp = 0;
        uint256 prevAccumulated = 0;

        for (uint256 i = 0; i < updates.length; i++) {
            SignedUpdate calldata u = updates[i];

            // Updates must correspond to this channel
            if (u.sequence == 0) revert InvalidUpdateChain();
            if (u.channelId != state.channelId) revert InvalidUpdateChain();
            if (u.classId != state.classId) revert InvalidUpdateChain();
            if (u.rider != state.rider) revert InvalidUpdateChain();
            if (u.instructor != state.instructor) revert InvalidUpdateChain();
            if (i == 0) {
                // First update sets the baseline
                prevSequence = u.sequence;
                prevTimestamp = u.timestamp;
                prevAccumulated = u.accumulatedReward;
            } else {
                if (u.sequence <= prevSequence) revert InvalidUpdateChain();
                if (u.timestamp < prevTimestamp) revert InvalidUpdateChain();
                if (u.accumulatedReward < prevAccumulated) revert InvalidUpdateChain();

                prevSequence = u.sequence;
                prevTimestamp = u.timestamp;
                prevAccumulated = u.accumulatedReward;
            }

            // Rider signs each update
            bytes32 updateStructHash = keccak256(
                abi.encode(
                    UPDATE_TYPEHASH,
                    u.channelId,
                    u.classId,
                    u.rider,
                    u.instructor,
                    u.timestamp,
                    u.sequence,
                    u.accumulatedReward,
                    u.heartRate,
                    u.power
                )
            );
            bytes32 updateDigest = _hashTypedDataV4(updateStructHash);
            address recoveredUpdateSigner = updateDigest.recover(u.signature);
            if (recoveredUpdateSigner != state.rider) return false;
        }

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
