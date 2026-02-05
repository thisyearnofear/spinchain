// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ISpinClass {
    function hasAttended(address rider) external view returns (bool);
}

interface ISpinToken {
    function mint(address to, uint256 amount) external;
}

interface IEffortThresholdVerifier {
    function verifyAndRecord(bytes calldata proof, bytes32[] calldata publicInputs) external returns (uint16);
}

/// @custom:security-contact security@spinchain.xyz
contract IncentiveEngine is Ownable, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    // ============ Errors ============
    error NotAttended();
    error AttestationUsed();
    error InvalidSignature();
    error InvalidAmount();
    error AttestationExpired();
    error DailyLimitExceeded();
    error InvalidProof();
    error ThresholdNotMet();

    // ============ Constants ============
    uint256 public constant ATTESTATION_VALIDITY = 7 days;
    uint256 public constant DAILY_MINT_LIMIT = 1_000_000 * 1e18; // 1M SPIN per day

    // ============ State ============
    ISpinToken public rewardToken;
    IEffortThresholdVerifier public verifier;
    address public attestationSigner;
    
    mapping(bytes32 => bool) public usedAttestations;
    mapping(uint256 => uint256) public dailyMinted; // day => amount
    mapping(address => uint256) public totalClaimed; // rider => total rewards

    // ============ Events ============
    event AttestationSignerUpdated(address indexed signer);
    event RewardTokenUpdated(address indexed token);
    event VerifierUpdated(address indexed verifier);
    event RewardClaimed(address indexed rider, address indexed spinClass, uint256 amount, bytes32 attestationId);
    event ZKRewardClaimed(address indexed rider, bytes32 indexed classId, uint256 amount, uint16 effortScore);

    constructor(address owner_, address token_, address signer_, address verifier_) Ownable(owner_) {
        rewardToken = ISpinToken(token_);
        attestationSigner = signer_;
        verifier = IEffortThresholdVerifier(verifier_);
    }

    function setAttestationSigner(address signer_) external onlyOwner {
        attestationSigner = signer_;
        emit AttestationSignerUpdated(signer_);
    }

    function setRewardToken(address token_) external onlyOwner {
        rewardToken = ISpinToken(token_);
        emit RewardTokenUpdated(token_);
    }

    function setVerifier(address verifier_) external onlyOwner {
        verifier = IEffortThresholdVerifier(verifier_);
        emit VerifierUpdated(verifier_);
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
        ).toEthSignedMessageHash();
        address recovered = message.recover(signature);
        if (recovered != attestationSigner) revert InvalidSignature();

        _mintWithLimit(rider, rewardAmount);
        totalClaimed[rider] += rewardAmount;
        
        emit RewardClaimed(rider, spinClass, rewardAmount, attestationId);
    }

    /// @notice Claim rewards via ZK proof (trustless verification)
    function submitZKProof(
        bytes calldata proof,
        bytes32[] calldata publicInputs,
        uint256 rewardAmount
    ) external nonReentrant whenNotPaused {
        if (rewardAmount == 0) revert InvalidAmount();
        
        // Verify ZK proof - this also records it to prevent replays
        uint16 effortScore = verifier.verifyAndRecord(proof, publicInputs);
        if (effortScore == 0) revert ThresholdNotMet();

        // Extract classId and rider from public inputs
        bytes32 classId = publicInputs[5];
        address rider = address(uint160(uint256(publicInputs[6])));
        
        // Verify the caller is the rider in the proof
        if (msg.sender != rider) revert InvalidSignature();

        _mintWithLimit(rider, rewardAmount);
        totalClaimed[rider] += rewardAmount;
        
        emit ZKRewardClaimed(rider, classId, rewardAmount, effortScore);
    }

    /// @notice Calculate reward based on effort score
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
        rewardToken.mint(to, amount);
    }

    // ============ Admin ============

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
