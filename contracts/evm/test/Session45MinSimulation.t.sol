// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IncentiveEngine} from "../src/IncentiveEngine.sol";
import {SpinToken} from "../src/SpinToken.sol";

/// @title 45-Minute Session Simulation
/// @notice Simulates a realistic 45-min ride with 9 chunked ZK proofs (5-min each)
/// @dev Run: forge test --match-contract Session45MinSimulation -vvv --gas-report

contract SessionMockVerifier {
    mapping(bytes32 => bool) public usedProofs;

    function verifyAndRecord(bytes calldata proof, bytes32[] calldata publicInputs)
        external
        returns (uint16 effortScore)
    {
        bytes32 proofHash = keccak256(proof);
        require(!usedProofs[proofHash], "replay");
        usedProofs[proofHash] = true;
        effortScore = uint16(uint256(publicInputs[4]));
    }
}

contract Session45MinSimulation is Test {
    IncentiveEngine internal engine;
    SpinToken internal token;
    SessionMockVerifier internal verifier;

    address internal owner = address(0x1);
    address internal rider = address(0x2);
    address internal treasury = address(0x3);
    bytes32 internal classId = keccak256("session-45min");

    // Fuji block gas limit: 8M (C-Chain)
    uint256 constant FUJI_BLOCK_GAS_LIMIT = 8_000_000;

    function setUp() public {
        vm.startPrank(owner);
        token = new SpinToken(owner);
        verifier = new SessionMockVerifier();
        engine = new IncentiveEngine(owner, address(token), owner, address(verifier), treasury);
        token.transferOwnership(address(engine));
        engine.setProtocolFee(0);
        vm.stopPrank();
    }

    /// @notice Simulate a 45-min ride with realistic effort zones:
    ///   Chunks 1-2: warmup (effort 400-500, HR ~120-140)
    ///   Chunks 3-6: endurance/threshold (effort 600-800, HR ~150-170)
    ///   Chunks 7-8: sprint intervals (effort 850-950, HR ~175-185)
    ///   Chunk 9: cooldown (effort 500, HR ~130)
    function test_45MinSession_BatchSubmission() public {
        uint16[9] memory effortScores = [400, 500, 650, 700, 750, 800, 900, 950, 500];
        uint32[9] memory secondsAbove = [uint32(180), 240, 300, 300, 300, 300, 300, 300, 120];

        bytes[] memory proofs = new bytes[](9);
        bytes32[][] memory inputsArray = new bytes32[][](9);

        for (uint256 i = 0; i < 9; i++) {
            proofs[i] = abi.encodePacked(uint256(5000 + i));
            inputsArray[i] = _inputs(
                150,           // threshold HR
                300,           // min duration per chunk (5 min)
                true,          // threshold met
                secondsAbove[i],
                effortScores[i],
                classId,
                rider
            );
        }

        uint256 gasBefore = gasleft();
        vm.prank(rider);
        engine.submitZKProofBatch(proofs, inputsArray, 2340); // total seconds above threshold
        uint256 gasUsed = gasBefore - gasleft();

        // Calculate expected weighted average effort
        uint256 weightedSum = 0;
        uint256 totalSeconds = 0;
        for (uint256 i = 0; i < 9; i++) {
            weightedSum += uint256(effortScores[i]) * secondsAbove[i];
            totalSeconds += secondsAbove[i];
        }
        uint16 avgEffort = uint16(weightedSum / totalSeconds);
        uint256 expectedReward = engine.calculateReward(avgEffort);

        uint256 actualBalance = token.balanceOf(rider);
        uint256 actualClaimed = engine.totalClaimed(rider);

        console2.log("=== 45-Min Session Results ===");
        console2.log("Avg effort score:", avgEffort);
        console2.log("Expected reward:", expectedReward);
        console2.log("Actual balance:", actualBalance);
        console2.log("Total claimed:", actualClaimed);
        console2.log("Gas used:", gasUsed);
        console2.log("Block gas headroom:", FUJI_BLOCK_GAS_LIMIT - gasUsed);

        assertEq(actualBalance, expectedReward, "Reward should match calculated amount");
        assertEq(actualClaimed, expectedReward, "Total claimed should match");
        assertLt(gasUsed, FUJI_BLOCK_GAS_LIMIT, "Must fit within Fuji block gas limit");
        assertGt(avgEffort, 600, "Avg effort should be in endurance zone for this profile");
    }

    /// @notice Test submitting chunks individually (9 separate txs) vs batch (1 tx)
    /// @dev Individual submissions mint per-chunk rewards; batch mints weighted-average reward.
    ///      Gas comparison is the key metric here, not reward equality.
    function test_45MinSession_IndividualVsBatch_GasComparison() public {
        uint16[9] memory effortScores = [400, 500, 650, 700, 750, 800, 900, 950, 500];

        // --- Individual submissions ---
        uint256 individualGasTotal = 0;
        for (uint256 i = 0; i < 9; i++) {
            bytes memory proof = abi.encodePacked(uint256(7000 + i));
            bytes32[] memory inputs = _inputs(150, 300, true, 300, effortScores[i], classId, rider);

            uint256 gasBefore = gasleft();
            vm.prank(rider);
            engine.submitZKProof(proof, inputs);
            individualGasTotal += (gasBefore - gasleft());
        }

        uint256 individualBalance = token.balanceOf(rider);

        // --- Batch submission (fresh rider) ---
        address rider2 = address(0x4);
        bytes[] memory proofs = new bytes[](9);
        bytes32[][] memory inputsArray = new bytes32[][](9);

        for (uint256 i = 0; i < 9; i++) {
            proofs[i] = abi.encodePacked(uint256(8000 + i));
            inputsArray[i] = _inputs(150, 300, true, 300, effortScores[i], classId, rider2);
        }

        uint256 gasBeforeBatch = gasleft();
        vm.prank(rider2);
        engine.submitZKProofBatch(proofs, inputsArray, 2700);
        uint256 batchGas = gasBeforeBatch - gasleft();

        uint256 batchBalance = token.balanceOf(rider2);

        console2.log("=== Individual vs Batch ===");
        console2.log("Individual (9 txs) gas:", individualGasTotal);
        console2.log("Batch (1 tx) gas:", batchGas);
        console2.log("Gas savings:", individualGasTotal - batchGas);
        console2.log("Gas savings %:", (individualGasTotal - batchGas) * 100 / individualGasTotal);
        console2.log("Individual reward:", individualBalance);
        console2.log("Batch reward:", batchBalance);

        // Batch should be significantly cheaper than 9 individual submissions
        assertLt(batchGas, individualGasTotal, "Batch should use less gas than individual");

        // Both should mint positive rewards
        assertGt(individualBalance, 0, "Individual should earn rewards");
        assertGt(batchBalance, 0, "Batch should earn rewards");

        // Batch gas savings should be at least 20%
        uint256 savingsPct = (individualGasTotal - batchGas) * 100 / individualGasTotal;
        assertGe(savingsPct, 20, "Batch should save at least 20% gas vs individual");
    }

    /// @notice Test that a 45-min session with low effort (below threshold) is rejected
    function test_45MinSession_BelowThreshold_Reverts() public {
        bytes[] memory proofs = new bytes[](3);
        bytes32[][] memory inputsArray = new bytes32[][](3);

        for (uint256 i = 0; i < 3; i++) {
            proofs[i] = abi.encodePacked(uint256(9000 + i));
            inputsArray[i] = _inputs(150, 300, false, 0, 200, classId, rider); // threshold not met
        }

        vm.prank(rider);
        vm.expectRevert();
        engine.submitZKProofBatch(proofs, inputsArray, 0);
    }

    /// @notice Test gas headroom for worst case: 12 chunks at max effort
    function test_WorstCase_12Chunks_BlockLimit() public {
        bytes[] memory proofs = new bytes[](12);
        bytes32[][] memory inputsArray = new bytes32[][](12);

        for (uint256 i = 0; i < 12; i++) {
            proofs[i] = abi.encodePacked(uint256(10000 + i));
            inputsArray[i] = _inputs(150, 300, true, 300, 1000, classId, rider); // max effort
        }

        uint256 gasBefore = gasleft();
        vm.prank(rider);
        engine.submitZKProofBatch(proofs, inputsArray, 3600);
        uint256 gasUsed = gasBefore - gasleft();

        console2.log("=== Worst Case 12 Chunks ===");
        console2.log("Gas used:", gasUsed);
        console2.log("Block limit:", FUJI_BLOCK_GAS_LIMIT);
        console2.log("Headroom:", FUJI_BLOCK_GAS_LIMIT - gasUsed);
        console2.log("Headroom %:", (FUJI_BLOCK_GAS_LIMIT - gasUsed) * 100 / FUJI_BLOCK_GAS_LIMIT);

        assertLt(gasUsed, FUJI_BLOCK_GAS_LIMIT, "12-chunk batch must fit in Fuji block");
    }

    function _inputs(
        uint16 threshold_,
        uint32 minDuration,
        bool thresholdMet,
        uint32 secondsAbove,
        uint16 effortScore,
        bytes32 classId_,
        address rider_
    ) internal pure returns (bytes32[] memory inputs) {
        inputs = new bytes32[](7);
        inputs[0] = bytes32(uint256(threshold_));
        inputs[1] = bytes32(uint256(minDuration));
        inputs[2] = thresholdMet ? bytes32(uint256(1)) : bytes32(0);
        inputs[3] = bytes32(uint256(secondsAbove));
        inputs[4] = bytes32(uint256(effortScore));
        inputs[5] = classId_;
        inputs[6] = bytes32(uint256(uint160(rider_)));
    }
}
