// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IncentiveEngine} from "../src/IncentiveEngine.sol";
import {SpinToken} from "../src/SpinToken.sol";

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

    // ─── Single Proof Tests ──────────────────────────────────────────────────

    function test_SubmitZKProof_MintsReward() public {
        bytes memory proof = abi.encodePacked(uint256(42));
        bytes32[] memory publicInputs = _publicInputs(threshold, 1, true, 60, 700, classId, rider);

        vm.prank(rider);
        engine.submitZKProof(proof, publicInputs);

        uint256 expectedReward = engine.calculateReward(700);
        assertEq(token.balanceOf(rider), expectedReward);
        assertEq(engine.totalClaimed(rider), expectedReward);
    }

    function test_SubmitZKProof_RevertsOnReplay() public {
        bytes memory proof = abi.encodePacked(uint256(99));
        bytes32[] memory publicInputs = _publicInputs(threshold, 1, true, 60, 700, classId, rider);

        vm.prank(rider);
        engine.submitZKProof(proof, publicInputs);

        vm.prank(rider);
        vm.expectRevert(TestEffortThresholdVerifier.ProofAlreadyUsed.selector);
        engine.submitZKProof(proof, publicInputs);
    }

    function test_SubmitZKProof_RevertsWhenCallerIsNotRider() public {
        bytes memory proof = abi.encodePacked(uint256(77));
        bytes32[] memory publicInputs = _publicInputs(threshold, 1, true, 60, 700, classId, rider);

        vm.prank(address(0xDEAD));
        vm.expectRevert(IncentiveEngine.InvalidSignature.selector);
        engine.submitZKProof(proof, publicInputs);
    }

    function test_SubmitZKProof_RevertsOnInvalidPublicInputsLength() public {
        bytes memory proof = abi.encodePacked(uint256(55));
        bytes32[] memory badInputs = new bytes32[](3); // Wrong length (should be 7)

        vm.prank(rider);
        vm.expectRevert(IncentiveEngine.InvalidPublicInputs.selector);
        engine.submitZKProof(proof, badInputs);
    }

    function test_SubmitZKProof_RevertsWhenThresholdNotMet() public {
        bytes memory proof = abi.encodePacked(uint256(33));
        bytes32[] memory publicInputs = _publicInputs(threshold, 1, false, 10, 200, classId, rider);

        vm.prank(rider);
        vm.expectRevert(TestEffortThresholdVerifier.ThresholdNotMet.selector);
        engine.submitZKProof(proof, publicInputs);
    }

    function test_SubmitZKProof_DifferentProofsMintSeparately() public {
        bytes memory proof1 = abi.encodePacked(uint256(101));
        bytes memory proof2 = abi.encodePacked(uint256(102));
        bytes32[] memory inputs1 = _publicInputs(threshold, 1, true, 60, 500, classId, rider);
        bytes32[] memory inputs2 = _publicInputs(threshold, 1, true, 60, 800, classId, rider);

        vm.prank(rider);
        engine.submitZKProof(proof1, inputs1);
        uint256 balanceAfter1 = token.balanceOf(rider);

        vm.prank(rider);
        engine.submitZKProof(proof2, inputs2);
        uint256 balanceAfter2 = token.balanceOf(rider);

        uint256 reward1 = engine.calculateReward(500);
        uint256 reward2 = engine.calculateReward(800);
        assertEq(balanceAfter1, reward1);
        assertEq(balanceAfter2, reward1 + reward2);
    }

    function test_SubmitZKProof_RevertsWhenVerifierNotConfigured() public {
        SpinToken isolatedToken;
        IncentiveEngine engineWithoutVerifier;

        vm.startPrank(owner);
        isolatedToken = new SpinToken(owner);
        engineWithoutVerifier = new IncentiveEngine(owner, address(isolatedToken), owner, address(0), treasury);
        isolatedToken.transferOwnership(address(engineWithoutVerifier));
        engineWithoutVerifier.setProtocolFee(0);
        vm.stopPrank();

        bytes memory proof = abi.encodePacked(uint256(123));
        bytes32[] memory publicInputs = _publicInputs(threshold, 1, true, 60, 700, classId, rider);

        vm.prank(rider);
        vm.expectRevert(IncentiveEngine.VerifierNotConfigured.selector);
        engineWithoutVerifier.submitZKProof(proof, publicInputs);
    }

    function test_SubmitZKProofBatch_RevertsWhenVerifierNotConfigured() public {
        SpinToken isolatedToken;
        IncentiveEngine engineWithoutVerifier;

        vm.startPrank(owner);
        isolatedToken = new SpinToken(owner);
        engineWithoutVerifier = new IncentiveEngine(owner, address(isolatedToken), owner, address(0), treasury);
        isolatedToken.transferOwnership(address(engineWithoutVerifier));
        engineWithoutVerifier.setProtocolFee(0);
        vm.stopPrank();

        bytes[] memory proofs = new bytes[](1);
        proofs[0] = abi.encodePacked(uint256(321));

        bytes32[][] memory publicInputsArray = new bytes32[][](1);
        publicInputsArray[0] = _publicInputs(threshold, 1, true, 60, 700, classId, rider);

        vm.prank(rider);
        vm.expectRevert(IncentiveEngine.VerifierNotConfigured.selector);
        engineWithoutVerifier.submitZKProofBatch(proofs, publicInputsArray, 60);
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
