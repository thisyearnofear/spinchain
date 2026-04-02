// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IncentiveEngine} from "../IncentiveEngine.sol";
import {SpinToken} from "../SpinToken.sol";

contract TestEffortThresholdVerifier {
    error ProofAlreadyUsed();
    error InvalidPublicInputs();
    error ThresholdNotMet();

    mapping(bytes32 => bool) public usedProofs;

    function verifyAndRecord(bytes calldata proof, bytes32[] calldata publicInputs)
        external
        returns (uint16 effortScore)
    {
        if (publicInputs.length != 7) revert InvalidPublicInputs();

        bytes32 proofHash = keccak256(proof);
        if (usedProofs[proofHash]) revert ProofAlreadyUsed();

        bool thresholdMet = publicInputs[2] != bytes32(0);
        if (!thresholdMet) revert ThresholdNotMet();

        usedProofs[proofHash] = true;
        effortScore = uint16(uint256(publicInputs[4]));
    }
}

contract ZKBatchRewardsTest is Test {
    IncentiveEngine internal engine;
    SpinToken internal token;
    TestEffortThresholdVerifier internal verifier;

    address internal owner = address(0x1);
    address internal rider = address(0x2);
    address internal treasury = address(0x3);
    bytes32 internal classId = keccak256("class-001");
    uint16 internal threshold = 150;

    function setUp() public {
        vm.startPrank(owner);

        token = new SpinToken(owner);
        verifier = new TestEffortThresholdVerifier();
        engine = new IncentiveEngine(owner, address(token), owner, address(verifier), treasury);

        token.transferOwnership(address(engine));
        engine.setProtocolFee(0);

        vm.stopPrank();
    }

    function test_SubmitZKProofBatch_MintsAggregateReward() public {
        bytes[] memory proofs = new bytes[](2);
        proofs[0] = abi.encodePacked(uint256(1));
        proofs[1] = abi.encodePacked(uint256(2));

        bytes32[][] memory publicInputsArray = new bytes32[][](2);
        publicInputsArray[0] = _publicInputs(threshold, 1, true, 30, 600, classId, rider);
        publicInputsArray[1] = _publicInputs(threshold, 1, true, 45, 800, classId, rider);

        vm.prank(rider);
        engine.submitZKProofBatch(proofs, publicInputsArray, 60);

        uint16 aggregateEffort = uint16(((600 * 30) + (800 * 45)) / 75);
        uint256 expectedReward = engine.calculateReward(aggregateEffort);

        assertEq(token.balanceOf(rider), expectedReward);
        assertEq(engine.totalClaimed(rider), expectedReward);
    }

    function test_SubmitZKProofBatch_RevertsOnReplay() public {
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = abi.encodePacked(uint256(11));

        bytes32[][] memory publicInputsArray = new bytes32[][](1);
        publicInputsArray[0] = _publicInputs(threshold, 1, true, 60, 700, classId, rider);

        vm.prank(rider);
        engine.submitZKProofBatch(proofs, publicInputsArray, 60);

        vm.prank(rider);
        vm.expectRevert(TestEffortThresholdVerifier.ProofAlreadyUsed.selector);
        engine.submitZKProofBatch(proofs, publicInputsArray, 60);
    }

    function test_SubmitZKProofBatch_RevertsOnInconsistentBatch() public {
        bytes[] memory proofs = new bytes[](2);
        proofs[0] = abi.encodePacked(uint256(21));
        proofs[1] = abi.encodePacked(uint256(22));

        bytes32[][] memory publicInputsArray = new bytes32[][](2);
        publicInputsArray[0] = _publicInputs(threshold, 1, true, 30, 650, classId, rider);
        publicInputsArray[1] =
            _publicInputs(threshold + 1, 1, true, 30, 650, keccak256("class-002"), rider);

        vm.prank(rider);
        vm.expectRevert(IncentiveEngine.InconsistentBatchProofs.selector);
        engine.submitZKProofBatch(proofs, publicInputsArray, 60);
    }

    function _publicInputs(
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
