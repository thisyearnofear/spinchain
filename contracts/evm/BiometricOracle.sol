// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title BiometricOracle
/// @notice Chainlink Runtime Environment (CRE) oracle for verifying off-chain biometric data
/// @dev Migrated from Functions to CRE for enhanced privacy and consensus-verified computation
/// @custom:security-contact security@spinchain.xyz
contract BiometricOracle is Ownable {
    // ============ Errors ============
    error UnexpectedRequestID(bytes32 requestId);
    error InvalidThreshold();
    error InvalidDuration();
    error VerificationFailed();
    error UnauthorizedForwarder();
    error UnauthorizedWorkflow();

    // ============ Structs ============
    struct VerificationRequest {
        address rider;
        bytes32 classId;
        uint256 timestamp;
        uint16 threshold; // e.g., 150 bpm
        uint16 duration; // minutes
        bool fulfilled;
        bool verified;
    }

    // ============ State ============
    address public creForwarder;
    bytes32 public authorizedWorkflowId;
    
    mapping(bytes32 => VerificationRequest) public requests;
    mapping(address => bytes32[]) public riderRequests;
    mapping(bytes32 => uint16) public verifiedEffortScores; // classId+rider => score

    // ============ Events ============
    event VerificationRequested(
        bytes32 indexed requestId, 
        address indexed rider, 
        bytes32 indexed classId,
        uint16 threshold,
        uint16 duration
    );
    event VerificationFulfilled(bytes32 indexed requestId, bool verified, uint16 effortScore);
    event CREConfigUpdated(address forwarder, bytes32 workflowId);

    constructor(
        address creForwarder_,
        bytes32 workflowId_
    ) Ownable(msg.sender) {
        creForwarder = creForwarder_;
        authorizedWorkflowId = workflowId_;
    }

    /// @notice Request biometric verification via CRE
    /// @dev Emits an event that the CRE workflow trigger monitors
    /// @param classId Unique class identifier
    /// @param threshold Minimum effort threshold (e.g., HR > 150)
    /// @param duration Duration in minutes
    /// @return requestId Generated request ID
    function requestVerification(
        bytes32 classId,
        uint16 threshold,
        uint16 duration
    ) external returns (bytes32 requestId) {
        if (threshold == 0) revert InvalidThreshold();
        if (duration == 0) revert InvalidDuration();

        requestId = keccak256(abi.encodePacked(msg.sender, classId, block.timestamp));

        // Store request metadata
        requests[requestId] = VerificationRequest({
            rider: msg.sender,
            classId: classId,
            timestamp: block.timestamp,
            threshold: threshold,
            duration: duration,
            fulfilled: false,
            verified: false
        });

        riderRequests[msg.sender].push(requestId);
        
        emit VerificationRequested(requestId, msg.sender, classId, threshold, duration);
    }

    /// @notice CRE callback - fulfills verification request
    /// @param requestId The original request ID
    /// @param workflowId The ID of the workflow that generated this report
    /// @param verified Whether the biometric criteria were met
    /// @param effortScore Calculated effort score (0-1000)
    function fulfillCREReport(
        bytes32 requestId,
        bytes32 workflowId,
        bool verified,
        uint16 effortScore
    ) external {
        if (msg.sender != creForwarder) revert UnauthorizedForwarder();
        if (workflowId != authorizedWorkflowId) revert UnauthorizedWorkflow();

        VerificationRequest storage req = requests[requestId];
        if (req.timestamp == 0) revert UnexpectedRequestID(requestId);
        if (req.fulfilled) return; // Prevent double fulfillment
        
        req.fulfilled = true;
        req.verified = verified;
        
        if (verified) {
            bytes32 key = keccak256(abi.encodePacked(req.classId, req.rider));
            verifiedEffortScores[key] = effortScore;
        }

        emit VerificationFulfilled(requestId, verified, effortScore);
    }

    /// @notice Get verification result for a rider in a class
    function getVerifiedScore(bytes32 classId, address rider) external view returns (uint16) {
        bytes32 key = keccak256(abi.encodePacked(classId, rider));
        return verifiedEffortScores[key];
    }

    /// @notice Get all verification requests for a rider
    function getRiderRequests(address rider) external view returns (bytes32[] memory) {
        return riderRequests[rider];
    }

    /// @notice Update CRE configuration
    function updateConfig(
        address creForwarder_,
        bytes32 workflowId_
    ) external onlyOwner {
        creForwarder = creForwarder_;
        authorizedWorkflowId = workflowId_;
        emit CREConfigUpdated(creForwarder_, workflowId_);
    }
}
