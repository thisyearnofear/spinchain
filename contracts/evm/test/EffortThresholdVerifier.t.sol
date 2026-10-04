// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {
    EffortThresholdVerifier,
    IUltraVerifier
} from "verifiers/EffortThresholdVerifier.sol";

/// @notice Strict fake: only accepts exactly [1, 60, 1000].
contract StrictNoirVerifierFake is IUltraVerifier {
    bytes32[] public expected;
    bool public nextResult = true;

    constructor(bytes32[] memory _expected) {
        expected = _expected;
    }

    function setExpected(bytes32[] memory _expected) external {
        expected = _expected;
    }

    function setResult(bool _result) external {
        nextResult = _result;
    }

    function verify(bytes calldata, bytes32[] calldata publicInputs)
        external
        view
        override
        returns (bool)
    {
        require(publicInputs.length == expected.length, "wrong input count");
        for (uint256 i = 0; i < expected.length; i++) {
            require(publicInputs[i] == expected[i], "input mismatch");
        }
        return nextResult;
    }
}

contract EffortThresholdVerifierTest is Test {
    EffortThresholdVerifier internal wrapper;
    StrictNoirVerifierFake internal fake;

    address internal owner = address(0x1);
    address internal engine = address(0x2);
    address internal rider = address(0xF1);
    bytes32 internal classId = keccak256("class-001");

    bytes32[] internal inputs7;

    function _expectedOutputs() internal pure returns (bytes32[] memory) {
        bytes32[] memory outputs = new bytes32[](3);
        outputs[0] = bytes32(uint256(1));
        outputs[1] = bytes32(uint256(60));
        outputs[2] = bytes32(uint256(1000));
        return outputs;
    }

    function setUp() public {
        vm.startPrank(owner);
        fake = new StrictNoirVerifierFake(_expectedOutputs());
        wrapper = new EffortThresholdVerifier(address(fake));
        wrapper.setAuthorizedCaller(engine, true);
        vm.stopPrank();

        inputs7 = wrapper.encodePublicInputs(150, 30, true, 60, 1000, classId, rider);
    }

    function test_VerifyProof_ForwardsExactlyThreeOutputs() public view {
        assertTrue(wrapper.verifyProof(hex"01", inputs7));
    }

    function test_VerifyAndRecord_SucceedsAndStores() public {
        vm.prank(engine);
        uint16 effortScore = wrapper.verifyAndRecord(hex"01", inputs7);
        assertEq(effortScore, 1000);
        assertTrue(wrapper.isProofUsed(keccak256(hex"01")));

        EffortThresholdVerifier.VerifiedProof memory details =
            wrapper.getProofDetails(keccak256(hex"01"));
        assertEq(details.rider, rider);
        assertEq(details.classId, classId);
        assertEq(details.secondsAbove, 60);
        assertEq(details.effortScore, 1000);
    }

    function test_VerifyAndRecord_RejectsReplay() public {
        vm.startPrank(engine);
        wrapper.verifyAndRecord(hex"01", inputs7);
        vm.expectRevert(EffortThresholdVerifier.ProofAlreadyUsed.selector);
        wrapper.verifyAndRecord(hex"01", inputs7);
        vm.stopPrank();
    }

    function test_VerifyProof_RevertsWhenThresholdNotMet() public {
        // Teach the fake the false outputs so the wrapper's own check fires.
        bytes32[] memory falseOutputs = new bytes32[](3);
        falseOutputs[0] = bytes32(uint256(0));
        falseOutputs[1] = bytes32(uint256(10));
        falseOutputs[2] = bytes32(uint256(200));
        fake.setExpected(falseOutputs);

        bytes32[] memory badInputs =
            wrapper.encodePublicInputs(150, 30, false, 10, 200, classId, rider);

        vm.expectRevert(EffortThresholdVerifier.ThresholdNotMet.selector);
        wrapper.verifyProof(hex"02", badInputs);
    }

    function test_VerifyProof_RevertsWhenVerifierRejects() public {
        fake.setResult(false);
        vm.expectRevert(EffortThresholdVerifier.InvalidProof.selector);
        wrapper.verifyProof(hex"01", inputs7);
    }

    function test_VerifyProof_RevertsOnWrongInputCount() public {
        bytes32[] memory shortInputs = new bytes32[](3);
        vm.expectRevert(EffortThresholdVerifier.InvalidPublicInputs.selector);
        wrapper.verifyProof(hex"01", shortInputs);
    }
}
