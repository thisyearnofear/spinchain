// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title BiometricOracle
/// @notice Chainlink Functions oracle for verifying off-chain biometric data
/// @dev Validates heart rate, power, cadence from BLE devices without exposing raw data
/// @custom:security-contact security@spinchain.xyz
contract BiometricOracle is FunctionsClient, Ownable {
    using FunctionsRequest for FunctionsRequest.Request;

    // ============ Errors ============
    error UnexpectedRequestID(bytes32 requestId);
    error InvalidThreshold();
    error InvalidDuration();
    error VerificationFailed();

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
    bytes32 public donId;
    uint64 public subscriptionId;
    uint32 public gasLimit;
    
    mapping(bytes32 => VerificationRequest) public requests;
    mapping(address => bytes32[]) public riderRequests;
    mapping(bytes32 => uint16) public verifiedEffortScores; // classId+rider => score

    // ============ Events ============
    event VerificationRequested(bytes32 indexed requestId, address indexed rider, bytes32 indexed classId);
    event VerificationFulfilled(bytes32 indexed requestId, bool verified, uint16 effortScore);
    event ConfigUpdated(bytes32 donId, uint64 subscriptionId, uint32 gasLimit);

    constructor(
        address router_,
        bytes32 donId_,
        uint64 subscriptionId_,
        uint32 gasLimit_
    ) FunctionsClient(router_) Ownable(msg.sender) {
        donId = donId_;
        subscriptionId = subscriptionId_;
        gasLimit = gasLimit_;
    }

    /// @notice Request biometric verification via Chainlink Functions
    /// @param classId Unique class identifier
    /// @param encryptedData Encrypted telemetry data (heart rate, power, cadence)
    /// @param threshold Minimum effort threshold (e.g., HR > 150)
    /// @param duration Duration in minutes
    /// @return requestId Chainlink request ID
    function requestVerification(
        bytes32 classId,
        bytes calldata encryptedData,
        uint16 threshold,
        uint16 duration
    ) external returns (bytes32 requestId) {
        if (threshold == 0) revert InvalidThreshold();
        if (duration == 0) revert InvalidDuration();

        // Build Chainlink Functions request
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(_getVerificationSource());
        req.addSecretsReference(encryptedData);
        
        // Send request
        requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donId
        );

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
        
        emit VerificationRequested(requestId, msg.sender, classId);
    }

    /// @notice Chainlink callback - fulfills verification request
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        VerificationRequest storage req = requests[requestId];
        if (req.timestamp == 0) revert UnexpectedRequestID(requestId);
        
        req.fulfilled = true;

        if (err.length > 0) {
            req.verified = false;
            emit VerificationFulfilled(requestId, false, 0);
            return;
        }

        // Decode response: (bool verified, uint16 effortScore)
        (bool verified, uint16 effortScore) = abi.decode(response, (bool, uint16));
        
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

    /// @notice Update Chainlink configuration
    function updateConfig(
        bytes32 donId_,
        uint64 subscriptionId_,
        uint32 gasLimit_
    ) external onlyOwner {
        donId = donId_;
        subscriptionId = subscriptionId_;
        gasLimit = gasLimit_;
        emit ConfigUpdated(donId_, subscriptionId_, gasLimit_);
    }

    /// @notice JavaScript source code for Chainlink Functions
    /// @dev Validates biometric data meets threshold without exposing raw values
    function _getVerificationSource() internal pure returns (string memory) {
        return
            "const threshold = parseInt(args[0]);"
            "const duration = parseInt(args[1]);"
            "const telemetryData = JSON.parse(secrets.encryptedData);"
            ""
            "let qualifyingMinutes = 0;"
            "let totalEffort = 0;"
            ""
            "for (const point of telemetryData) {"
            "  if (point.heartRate >= threshold) {"
            "    qualifyingMinutes++;"
            "    totalEffort += point.heartRate + (point.power || 0) * 0.5;"
            "  }"
            "}"
            ""
            "const verified = qualifyingMinutes >= duration;"
            "const effortScore = Math.min(1000, Math.floor(totalEffort / telemetryData.length));"
            ""
            "return Functions.encodeUint256(verified ? 1 : 0) + Functions.encodeUint256(effortScore);";
    }
}
