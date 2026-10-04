// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {EffortThresholdVerifier} from "verifiers/EffortThresholdVerifier.sol";
import {IncentiveEngine} from "../src/IncentiveEngine.sol";
import {SpinToken} from "../src/SpinToken.sol";

/// @notice Real HonkVerifier bytecode + real UltraHonk proofs from
/// test/fixtures/effort_proof.json. Build first: FOUNDRY_PROFILE=honk forge build
contract EffortThresholdVerifierHonkTest is Test {
    string internal constant FIXTURE = "test/fixtures/effort_proof.json";

    EffortThresholdVerifier internal wrapper;
    IncentiveEngine internal engine;
    SpinToken internal token;
    address internal honk;

    address internal owner = address(0x1);
    address internal rider;
    bytes32 internal classId;

    bytes[] internal proofs;
    bytes32[][] internal inputsArray;

    event ZKRewardClaimed(
        address indexed rider,
        bytes32 indexed classId,
        uint256 amount,
        uint16 effortScore
    );

    function setUp() public {
        string memory json = vm.readFile(FIXTURE);
        rider = vm.parseJsonAddress(json, ".rider");
        classId = bytes32(vm.parseBytes(string.concat("0x", vm.parseJsonString(json, ".classIdHex"))));

        proofs = new bytes[](2);
        inputsArray = new bytes32[][](2);
        for (uint256 i = 0; i < 2; i++) {
            string memory base = string.concat(".proofs[", vm.toString(i), "]");
            proofs[i] = vm.parseBytes(
                string.concat("0x", vm.parseJsonString(json, string.concat(base, ".proofHex")))
            );
            string[] memory encodedInputs =
                vm.parseJsonStringArray(json, string.concat(base, ".publicInputsHex"));
            inputsArray[i] = new bytes32[](encodedInputs.length);
            for (uint256 j = 0; j < encodedInputs.length; j++) {
                bytes memory raw = vm.parseBytes(string.concat("0x", encodedInputs[j]));
                assertEq(raw.length, 32);
                inputsArray[i][j] = bytes32(raw);
            }
            assertEq(inputsArray[i].length, 7);
        }

        // Deploy the real verifier from the honk artifact (keeps its source
        // out of the via_ir test compilation).
        bytes memory honkBytecode =
            vm.getCode("cache/out/HonkVerifier.sol/HonkVerifier.json");
        address deployed;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            deployed := create(0, add(honkBytecode, 0x20), mload(honkBytecode))
        }
        require(deployed != address(0), "HonkVerifier deploy failed");
        honk = deployed;

        vm.startPrank(owner);
        token = new SpinToken(owner);
        wrapper = new EffortThresholdVerifier(honk);
        engine = new IncentiveEngine(owner, address(token), owner, address(wrapper), owner);

        wrapper.setAuthorizedCaller(address(engine), true);
        token.transferOwnership(address(engine));
        engine.setProtocolFee(0);
        vm.stopPrank();
    }

    function test_RealProof_VerifiedAndMintsExactReward() public {
        // [1, 60, 1000] -> 10 + 90 = 100 SPIN
        vm.prank(rider);
        vm.expectEmit(true, true, false, true);
        emit ZKRewardClaimed(rider, classId, 100e18, 1000);
        engine.submitZKProof(proofs[0], inputsArray[0]);

        assertEq(token.balanceOf(rider), 100e18);
        assertEq(engine.totalClaimed(rider), 100e18);
    }

    function test_RealProof_RejectsReplay() public {
        vm.prank(rider);
        engine.submitZKProof(proofs[0], inputsArray[0]);

        vm.prank(rider);
        vm.expectRevert(EffortThresholdVerifier.ProofAlreadyUsed.selector);
        engine.submitZKProof(proofs[0], inputsArray[0]);
    }

    function test_RealProof_RejectsMutatedPublicOutput() public {
        bytes32[] memory mutated = inputsArray[0];
        mutated[3] = bytes32(uint256(59)); // secondsAbove no longer matches proof

        vm.prank(rider);
        // Tampered public outputs revert inside HonkVerifier (sumcheck).
        vm.expectRevert();
        engine.submitZKProof(proofs[0], mutated);
    }

    function test_RealProofBatch_TwoIndependentProofs() public {
        // Two real proofs: secondsAbove=60 each, batch total 120.
        vm.prank(rider);
        engine.submitZKProofBatch(proofs, inputsArray, 120);

        assertEq(token.balanceOf(rider), 100e18);
        assertEq(engine.totalClaimed(rider), 100e18);
    }
}
