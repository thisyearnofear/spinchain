// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

interface IDeployedWrapper {
    function noirVerifier() external view returns (address);
    function verifyProof(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

interface IHonk {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

/// @notice Tripwire for the known-broken Fuji `EffortThresholdVerifier`.
///
/// The deployed wrapper forwards the wrong public-input slice to Honk, so it
/// reverts with Honk's `PublicInputsLengthWrong()` on real proofs that the
/// deployed Honk verifier itself accepts. This runs the exact deployed runtime
/// bytecode (test/fixtures/fuji_deployed_verifiers.json) against the committed
/// fixture proofs, offline. If a test here starts failing, the deployment or
/// the fixture changed: update OPERATIONS.md/ARCHITECTURE.md, not this test.
///
/// Set FUJI_RPC_URL to additionally confirm the snapshot still matches the
/// chain. That check is read-only and skipped by default.
contract EffortThresholdVerifierFujiTripwireTest is Test {
    string internal constant DEPLOYED = "test/fixtures/fuji_deployed_verifiers.json";
    string internal constant PROOFS = "test/fixtures/effort_proof.json";

    /// HonkVerifier `PublicInputsLengthWrong()` — the revert seen on-chain 2026-10-04.
    bytes4 internal constant PUBLIC_INPUTS_LENGTH_WRONG = 0xfa066593;
    uint256 internal constant NOIR_PUBLIC_INPUTS = 3;
    uint256 internal constant NOIR_INPUT_OFFSET = 2;

    address internal wrapperAddr;
    address internal honkAddr;
    bytes32 internal wrapperCodeHash;
    bytes32 internal honkCodeHash;

    bytes[] internal proofs;
    bytes32[][] internal inputsArray;

    function setUp() public {
        string memory deployed = vm.readFile(DEPLOYED);
        wrapperAddr = vm.parseJsonAddress(deployed, ".wrapper.address");
        honkAddr = vm.parseJsonAddress(deployed, ".honk.address");
        wrapperCodeHash = bytes32(_hexField(deployed, ".wrapper.codeHashHex"));
        honkCodeHash = bytes32(_hexField(deployed, ".honk.codeHashHex"));

        bytes memory wrapperCode = _hexField(deployed, ".wrapper.codeHex");
        bytes memory honkCode = _hexField(deployed, ".honk.codeHex");
        assertEq(keccak256(wrapperCode), wrapperCodeHash, "wrapper snapshot does not match its recorded hash");
        assertEq(keccak256(honkCode), honkCodeHash, "honk snapshot does not match its recorded hash");

        vm.etch(wrapperAddr, wrapperCode);
        vm.etch(honkAddr, honkCode);
        // Storage as read on Fuji: slot 0 = owner (+ packed paused=false),
        // slot 1 = noirVerifier.
        vm.store(wrapperAddr, bytes32(uint256(0)), bytes32(uint256(uint160(vm.parseJsonAddress(deployed, ".wrapper.owner")))));
        vm.store(wrapperAddr, bytes32(uint256(1)), bytes32(uint256(uint160(honkAddr))));

        string memory json = vm.readFile(PROOFS);
        proofs = new bytes[](2);
        inputsArray = new bytes32[][](2);
        for (uint256 i = 0; i < 2; i++) {
            string memory base = string.concat(".proofs[", vm.toString(i), "]");
            proofs[i] = vm.parseBytes(string.concat("0x", vm.parseJsonString(json, string.concat(base, ".proofHex"))));
            string[] memory encoded = vm.parseJsonStringArray(json, string.concat(base, ".publicInputsHex"));
            inputsArray[i] = new bytes32[](encoded.length);
            for (uint256 j = 0; j < encoded.length; j++) {
                inputsArray[i][j] = bytes32(vm.parseBytes(string.concat("0x", encoded[j])));
            }
            assertEq(inputsArray[i].length, 7);
        }
    }

    function _hexField(string memory json, string memory key) internal pure returns (bytes memory) {
        return vm.parseBytes(string.concat("0x", vm.parseJsonString(json, key)));
    }

    function _noirSlice(bytes32[] memory full) internal pure returns (bytes32[] memory out) {
        out = new bytes32[](NOIR_PUBLIC_INPUTS);
        for (uint256 i = 0; i < NOIR_PUBLIC_INPUTS; i++) {
            out[i] = full[i + NOIR_INPUT_OFFSET];
        }
    }

    function test_DeployedWrapperPointsAtDeployedHonk() public view {
        assertEq(IDeployedWrapper(wrapperAddr).noirVerifier(), honkAddr);
    }

    function test_DeployedHonkAcceptsFixtureProofs() public view {
        for (uint256 i = 0; i < proofs.length; i++) {
            assertTrue(IHonk(honkAddr).verify(proofs[i], _noirSlice(inputsArray[i])));
        }
    }

    function test_DeployedWrapperRejectsFixtureProofs() public {
        for (uint256 i = 0; i < proofs.length; i++) {
            vm.expectRevert(PUBLIC_INPUTS_LENGTH_WRONG);
            IDeployedWrapper(wrapperAddr).verifyProof(proofs[i], inputsArray[i]);
        }
    }

    /// Opt-in, read-only: the snapshot above is still what Fuji serves.
    function test_SnapshotMatchesFuji() public {
        string memory rpc = vm.envOr("FUJI_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        assertEq(wrapperAddr.codehash, wrapperCodeHash, "Fuji wrapper changed: re-check the broken-wrapper docs");
        assertEq(honkAddr.codehash, honkCodeHash, "Fuji Honk verifier changed");
        assertEq(IDeployedWrapper(wrapperAddr).noirVerifier(), honkAddr);
    }
}
