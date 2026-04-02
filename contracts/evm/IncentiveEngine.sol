// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TieredRewards} from "./TieredRewards.sol";

interface ISpinClass {
    function hasAttended(address rider) external view returns (bool);
}

interface ISpinToken {
    function mint(address to, uint256 amount) external;
}

interface IEffortThresholdVerifier {
    function verifyAndRecord(bytes calldata proof, bytes32[] calldata publicInputs) external returns (uint16);
}

interface IBiometricOracle {
    function getVerifiedScore(bytes32 classId, address rider) external view returns (uint16);
}

/// @title IncentiveEngine
/// @notice Reward distribution with tier multipliers and Chainlink oracle verification
/// @dev Supports ZK proofs, signed attestations, and Chainlink-verified biometrics
/// @custom:security-contact security@spinchain.xyz
contract IncentiveEngine is Ownable, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;
    using TieredRewards for *;

    // ============ Errors ============
    error NotAttended();
    error AttestationUsed();
    error InvalidSignature();
    error InvalidAmount();
    error AttestationExpired();
    error DailyLimitExceeded();
    error InvalidProof();
    error ThresholdNotMet();
    error InvalidPublicInputs();
    error InconsistentBatchProofs();
    error EmptyBatch();

    // ============ Constants ============
    uint256 public constant ATTESTATION_VALIDITY = 7 days;
    uint256 public constant DAILY_MINT_LIMIT = 1_000_000 * 1e18; // 1M SPIN per day

    // ============ State ============
    ISpinToken public rewardToken;
    IERC20 public spinToken;
    IEffortThresholdVerifier public verifier;
    IBiometricOracle public biometricOracle;
    address public attestationSigner;
    
    // Protocol Fee
    uint256 public protocolFeeBps = 250; // 2.5%
    address public treasury;
    
    mapping(bytes32 => bool) public usedAttestations;
    mapping(uint256 => uint256) public dailyMinted; // day => amount
    mapping(address => uint256) public totalClaimed; // rider => total rewards
    mapping(address => TieredRewards.Tier) public userTiers; // cached tiers
    mapping(bytes32 => bool) public chainlinkClaimsUsed; // classId+rider => claimed

    // ============ Events ============
    event AttestationSignerUpdated(address indexed signer);
    event RewardTokenUpdated(address indexed token);
    event VerifierUpdated(address indexed verifier);
    event BiometricOracleUpdated(address indexed oracle);
    event TreasuryUpdated(address indexed treasury);
    event ProtocolFeeUpdated(uint256 bps);
    event RewardClaimed(address indexed rider, address indexed spinClass, uint256 amount, bytes32 attestationId);
    event ZKRewardClaimed(address indexed rider, bytes32 indexed classId, uint256 amount, uint16 effortScore);
    event ZKBatchRewardClaimed(
        address indexed rider,
        bytes32 indexed classId,
        uint256 amount,
        uint16 effortScore,
        uint32 totalSecondsAbove,
        uint16 proofsVerified
    );
    event ChainlinkRewardClaimed(address indexed rider, bytes32 indexed classId, uint256 amount, uint16 effortScore);
    event TierRewardBoost(address indexed rider, TieredRewards.Tier tier, uint256 baseAmount, uint256 boostedAmount);

    constructor(address owner_, address token_, address signer_, address verifier_, address treasury_) Ownable(owner_) {
        rewardToken = ISpinToken(token_);
        spinToken = IERC20(token_);
        attestationSigner = signer_;
        verifier = IEffortThresholdVerifier(verifier_);
        treasury = treasury_;
    }

    function setAttestationSigner(address signer_) external onlyOwner {
        attestationSigner = signer_;
        emit AttestationSignerUpdated(signer_);
    }

    function setRewardToken(address token_) external onlyOwner {
        rewardToken = ISpinToken(token_);
        spinToken = IERC20(token_);
        emit RewardTokenUpdated(token_);
    }

    function setVerifier(address verifier_) external onlyOwner {
        verifier = IEffortThresholdVerifier(verifier_);
        emit VerifierUpdated(verifier_);
    }

    function setBiometricOracle(address oracle_) external onlyOwner {
        biometricOracle = IBiometricOracle(oracle_);
        emit BiometricOracleUpdated(oracle_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setProtocolFee(uint256 bps) external onlyOwner {
        require(bps <= 1000, "Fee too high"); // Max 10%
        protocolFeeBps = bps;
        emit ProtocolFeeUpdated(bps);
    }

    /// @notice Get user's current tier based on SPIN balance
    function getUserTier(address user) public view returns (TieredRewards.Tier) {
        return TieredRewards.getTier(spinToken.balanceOf(user));
    }

    /// @notice Calculate reward with tier multiplier applied
    function calculateRewardWithTier(uint16 effortScore, address rider) public view returns (uint256) {
        uint256 baseReward = calculateReward(effortScore);
        TieredRewards.Tier tier = getUserTier(rider);
        return TieredRewards.applyMultiplier(baseReward, tier);
    }

    /// @notice Claim rewards via ECDSA attestation (off-chain verification)
    function submitAttestation(
        address spinClass,
        address rider,
        uint256 rewardAmount,
        bytes32 classId,
        bytes32 claimHash,
        uint256 timestamp,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        if (!ISpinClass(spinClass).hasAttended(rider)) revert NotAttended();
        if (rewardAmount == 0) revert InvalidAmount();
        if (block.timestamp > timestamp + ATTESTATION_VALIDITY) revert AttestationExpired();

        bytes32 attestationId = keccak256(
            abi.encodePacked(spinClass, rider, rewardAmount, classId, claimHash, timestamp)
        );
        if (usedAttestations[attestationId]) revert AttestationUsed();
        usedAttestations[attestationId] = true;

        bytes32 message = keccak256(
            abi.encodePacked("SPIN_ATTESTATION", spinClass, rider, rewardAmount, classId, claimHash, timestamp)
        );
        message = MessageHashUtils.toEthSignedMessageHash(message);
        address recovered = ECDSA.recover(message, signature);
        if (recovered != attestationSigner) revert InvalidSignature();

        // Apply tier multiplier
        TieredRewards.Tier tier = getUserTier(rider);
        uint256 boostedAmount = TieredRewards.applyMultiplier(rewardAmount, tier);
        
        _mintWithLimit(rider, boostedAmount);
        totalClaimed[rider] += boostedAmount;
        
        emit RewardClaimed(rider, spinClass, boostedAmount, attestationId);
        if (tier != TieredRewards.Tier.NONE) {
            emit TierRewardBoost(rider, tier, rewardAmount, boostedAmount);
        }
    }

    /// @notice Claim rewards via ZK proof (trustless verification)
    /// @dev rewardAmount is derived on-chain from effortScore — callers cannot inflate it
    function submitZKProof(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external nonReentrant whenNotPaused {
        if (publicInputs.length != 7) revert InvalidPublicInputs();

        // Verify ZK proof - this also records it to prevent replays
        uint16 effortScore = verifier.verifyAndRecord(proof, publicInputs);
        if (effortScore == 0) revert ThresholdNotMet();

        // Extract classId and rider from public inputs
        bytes32 classId = publicInputs[5];
        address rider = address(uint160(uint256(publicInputs[6])));
        
        // Verify the caller is the rider in the proof
        if (msg.sender != rider) revert InvalidSignature();

        // Compute reward on-chain from verified effort score — no caller input trusted
        uint256 baseAmount = calculateReward(effortScore);
        if (baseAmount == 0) revert InvalidAmount();

        // Apply tier multiplier
        TieredRewards.Tier tier = getUserTier(rider);
        uint256 boostedAmount = TieredRewards.applyMultiplier(baseAmount, tier);

        _mintWithLimit(rider, boostedAmount);
        totalClaimed[rider] += boostedAmount;
        
        emit ZKRewardClaimed(rider, classId, boostedAmount, effortScore);
        if (tier != TieredRewards.Tier.NONE) {
            emit TierRewardBoost(rider, tier, baseAmount, boostedAmount);
        }
    }

    function submitZKProofBatch(
        bytes[] calldata proofs,
        bytes32[][] calldata publicInputsArray,
        uint32 minTotalSeconds
    ) external nonReentrant whenNotPaused {
        if (proofs.length == 0 || publicInputsArray.length == 0) revert EmptyBatch();
        if (proofs.length != publicInputsArray.length) revert InvalidPublicInputs();

        bytes32 classId;
        address rider = msg.sender;
        bytes32 threshold;
        uint256 weightedEffortTotal = 0;
        uint32 totalSecondsAbove = 0;

        for (uint256 i = 0; i < proofs.length; i++) {
            bytes32[] calldata publicInputs = publicInputsArray[i];
            if (publicInputs.length != 7) revert InvalidPublicInputs();

            address proofRider = address(uint160(uint256(publicInputs[6])));
            if (proofRider != rider) revert InvalidSignature();

            if (i == 0) {
                classId = publicInputs[5];
                threshold = publicInputs[0];
            } else if (publicInputs[5] != classId || publicInputs[0] != threshold) {
                revert InconsistentBatchProofs();
            }

            uint16 effortScore = verifier.verifyAndRecord(proofs[i], publicInputs);
            uint32 secondsAbove = uint32(uint256(publicInputs[3]));
            totalSecondsAbove += secondsAbove;
            weightedEffortTotal += uint256(effortScore) * uint256(secondsAbove);
        }

        if (totalSecondsAbove < minTotalSeconds || totalSecondsAbove == 0) revert ThresholdNotMet();

        uint16 aggregateEffortScore = uint16(weightedEffortTotal / uint256(totalSecondsAbove));
        uint256 baseAmount = calculateReward(aggregateEffortScore);
        if (baseAmount == 0) revert InvalidAmount();

        TieredRewards.Tier tier = getUserTier(rider);
        uint256 boostedAmount = TieredRewards.applyMultiplier(baseAmount, tier);

        _mintWithLimit(rider, boostedAmount);
        totalClaimed[rider] += boostedAmount;

        emit ZKBatchRewardClaimed(
            rider,
            classId,
            boostedAmount,
            aggregateEffortScore,
            totalSecondsAbove,
            uint16(proofs.length)
        );
        if (tier != TieredRewards.Tier.NONE) {
            emit TierRewardBoost(rider, tier, baseAmount, boostedAmount);
        }
    }

    /// @notice Claim rewards via Chainlink oracle verification (tamper-proof biometrics)
    /// @dev Uses Chainlink Runtime Environment (CRE) to verify off-chain biometric data
    function submitChainlinkProof(
        bytes32 classId
    ) external nonReentrant whenNotPaused {
        if (address(biometricOracle) == address(0)) revert InvalidProof();
        
        // Check if already claimed
        bytes32 claimKey = keccak256(abi.encodePacked(classId, msg.sender));
        if (chainlinkClaimsUsed[claimKey]) revert AttestationUsed();
        
        // Get verified score from Chainlink oracle
        uint16 effortScore = biometricOracle.getVerifiedScore(classId, msg.sender);
        if (effortScore == 0) revert ThresholdNotMet();
        
        chainlinkClaimsUsed[claimKey] = true;

        // Compute reward on-chain from verified effort score
        uint256 baseAmount = calculateReward(effortScore);
        if (baseAmount == 0) revert InvalidAmount();

        // Apply tier multiplier
        TieredRewards.Tier tier = getUserTier(msg.sender);
        uint256 boostedAmount = TieredRewards.applyMultiplier(baseAmount, tier);

        _mintWithLimit(msg.sender, boostedAmount);
        totalClaimed[msg.sender] += boostedAmount;
        
        emit ChainlinkRewardClaimed(msg.sender, classId, boostedAmount, effortScore);
        if (tier != TieredRewards.Tier.NONE) {
            emit TierRewardBoost(msg.sender, tier, baseAmount, boostedAmount);
        }
    }

    /// @notice Calculate base reward based on effort score (no tier multiplier)
    function calculateReward(uint16 effortScore) public pure returns (uint256) {
        // Base reward: 10 SPIN, max: 100 SPIN based on effort
        // effortScore is 0-1000
        uint256 baseReward = 10 * 1e18;
        uint256 bonus = (uint256(effortScore) * 90 * 1e18) / 1000;
        return baseReward + bonus;
    }

    // ============ Internal ============

    function _mintWithLimit(address to, uint256 amount) internal {
        uint256 today = block.timestamp / 1 days;
        if (dailyMinted[today] + amount > DAILY_MINT_LIMIT) revert DailyLimitExceeded();
        
        dailyMinted[today] += amount;

        if (protocolFeeBps > 0 && treasury != address(0)) {
            uint256 fee = (amount * protocolFeeBps) / 10000;
            uint256 riderAmount = amount - fee;
            rewardToken.mint(to, riderAmount);
            rewardToken.mint(treasury, fee);
        } else {
            rewardToken.mint(to, amount);
        }
    }

    // ============ Admin ============

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
