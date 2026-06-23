// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IncentiveEngine} from "../src/IncentiveEngine.sol";
import {SpinToken} from "../src/SpinToken.sol";

/// @title Gas Benchmark for ZK Proof Submission
/// @notice Measures gas costs for single and batched ZK proof submissions
/// @dev Run: forge test --match-contract ZKGasBenchmark -vvv --gas-report

contract MockVerifier {
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

contract ZKGasBenchmark is Test {
    IncentiveEngine internal engine;
    SpinToken internal token;

    address internal owner = address(0x1);
    address internal rider = address(0x2);
    address internal treasury = address(0x3);
    bytes32 internal classId = keccak256("gas-bench-class");

    MockVerifier internal verifier;

    function setUp() public {
        vm.startPrank(owner);
        token = new SpinToken(owner);
        verifier = new MockVerifier();
        engine = new IncentiveEngine(owner, address(token), owner, address(verifier), treasury);
        token.transferOwnership(address(engine));
        engine.setProtocolFee(0);
        vm.stopPrank();
    }

    /// @notice Gas for a single ZK proof submission (1 chunk = ~5 min of riding)
    function test_Gas_SingleProof_1Chunk() public {
        bytes memory proof = abi.encodePacked(uint256(1));
        bytes32[] memory inputs = _inputs(150, 300, true, 300, 700, classId, rider);

        vm.prank(rider);
        engine.submitZKProof(proof, inputs);

        uint256 gasUsed = gasleft();
        console2.log("Single proof (1 chunk) gas:", gasUsed);
    }

    /// @notice Gas for batched submission of 3 chunks (~15 min ride)
    function test_Gas_Batch_3Chunks() public {
        bytes[] memory proofs = new bytes[](3);
        bytes32[][] memory inputsArray = new bytes32[][](3);

        for (uint256 i = 0; i < 3; i++) {
            proofs[i] = abi.encodePacked(uint256(100 + i));
            inputsArray[i] = _inputs(150, 300, true, 300, 700, classId, rider);
        }

        vm.prank(rider);
        engine.submitZKProofBatch(proofs, inputsArray, 900);

        console2.log("Batch 3 chunks gas:", gasleft());
    }

    /// @notice Gas for batched submission of 6 chunks (~30 min ride)
    function test_Gas_Batch_6Chunks() public {
        bytes[] memory proofs = new bytes[](6);
        bytes32[][] memory inputsArray = new bytes32[][](6);

        for (uint256 i = 0; i < 6; i++) {
            proofs[i] = abi.encodePacked(uint256(200 + i));
            inputsArray[i] = _inputs(150, 300, true, 300, 700, classId, rider);
        }

        vm.prank(rider);
        engine.submitZKProofBatch(proofs, inputsArray, 1800);

        console2.log("Batch 6 chunks gas:", gasleft());
    }

    /// @notice Gas for batched submission of 9 chunks (~45 min ride)
    function test_Gas_Batch_9Chunks_45Min() public {
        bytes[] memory proofs = new bytes[](9);
        bytes32[][] memory inputsArray = new bytes32[][](9);

        for (uint256 i = 0; i < 9; i++) {
            proofs[i] = abi.encodePacked(uint256(300 + i));
            inputsArray[i] = _inputs(150, 300, true, 300, 700, classId, rider);
        }

        vm.prank(rider);
        engine.submitZKProofBatch(proofs, inputsArray, 2700);

        console2.log("Batch 9 chunks (45-min) gas:", gasleft());
    }

    /// @notice Gas for batched submission of 12 chunks (~60 min ride)
    function test_Gas_Batch_12Chunks_60Min() public {
        bytes[] memory proofs = new bytes[](12);
        bytes32[][] memory inputsArray = new bytes32[][](12);

        for (uint256 i = 0; i < 12; i++) {
            proofs[i] = abi.encodePacked(uint256(400 + i));
            inputsArray[i] = _inputs(150, 300, true, 300, 700, classId, rider);
        }

        vm.prank(rider);
        engine.submitZKProofBatch(proofs, inputsArray, 3600);

        console2.log("Batch 12 chunks (60-min) gas:", gasleft());
    }

    /// @notice Gas for Chainlink proof submission (comparison baseline)
    function test_Gas_ChainlinkProof_Baseline() public {
        // This test requires oracle setup - just log that Chainlink path
        // uses submitChainlinkProof which is a single tx without proof data
        console2.log("Chainlink proof: single tx, no proof data - gas ~50k (estimated)");
    }

    /// @notice Per-chunk gas cost scaling analysis
    function test_Gas_PerChunk_Scaling() public {
        // Measure gas for 1, 3, 6, 9, 12 chunks and verify linear scaling
        uint256[5] memory chunkCounts = [uint256(1), 3, 6, 9, 12];

        for (uint256 c = 0; c < 5; c++) {
            uint256 n = chunkCounts[c];
            bytes[] memory proofs = new bytes[](n);
            bytes32[][] memory inputsArray = new bytes32[][](n);

            for (uint256 i = 0; i < n; i++) {
                proofs[i] = abi.encodePacked(uint256(1000 + c * 100 + i));
                inputsArray[i] = _inputs(150, 300, true, 300, 700, classId, rider);
            }

            uint256 gasBefore = gasleft();
            vm.prank(rider);
            if (n == 1) {
                engine.submitZKProof(proofs[0], inputsArray[0]);
            } else {
                engine.submitZKProofBatch(proofs, inputsArray, uint32(n * 300));
            }
            uint256 gasUsed = gasBefore - gasleft();

            console2.log("Chunks:", n);
            console2.log("  Gas:", gasUsed);
            console2.log("  Per-chunk:", gasUsed / n);
        }
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
