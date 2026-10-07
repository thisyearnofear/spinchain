// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ClaimRegistry} from "../src/redeemer/ClaimRegistry.sol";
import {AchievementRedeemerV2} from "../src/redeemer/AchievementRedeemerV2.sol";

interface IUltraVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

contract BenchToken is ERC20 {
    constructor() ERC20("Bench", "BNCH") {
        _mint(msg.sender, 1_000_000e18);
    }
}

/// @title Phase 5 real-verifier + redeemer gas benchmark
/// @notice Replaces the legacy mock-verifier figures with real measurements:
///         HonkVerifier.verify on the committed effort fixture, and a full
///         AchievementRedeemerV2.redeem call. Run:
///         FOUNDRY_PROFILE=honk forge build --skip test --skip script
///         forge test --match-contract Phase5Benchmark -vv
/// @dev Requires the honk artifact to be built first (same pattern as
///      EffortThresholdVerifierHonk.t.sol).
contract Phase5Benchmark is Test {
    string internal constant FIXTURE = "test/fixtures/effort_proof.json";

    address internal owner = makeAddr("owner");
    address internal rider = makeAddr("rider");
    uint256 internal constant ISSUER_KEY = 0xA11CE;
    address internal issuer;

    bytes32 internal constant CAMPAIGN = keccak256("spinchain.pilot.rides.v1");
    bytes32 internal constant POLICY = keccak256("spinchain.pilot.policy.v1");

    BenchToken internal token;
    ClaimRegistry internal registry;
    AchievementRedeemerV2 internal redeemer;
    address internal honk;
    bytes internal proof;
    bytes32[] internal inputs;

    function setUp() public {
        vm.warp(1_800_000_000);
        issuer = vm.addr(ISSUER_KEY);

        // Real HonkVerifier bytecode (built under the honk profile).
        bytes memory honkBytecode =
            vm.getCode("cache/out/HonkVerifier.sol/HonkVerifier.json");
        address deployed;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            deployed := create(0, add(honkBytecode, 0x20), mload(honkBytecode))
        }
        require(deployed != address(0), "HonkVerifier deploy failed");
        honk = deployed;

        string memory json = vm.readFile(FIXTURE);
        proof = vm.parseBytes(
            string.concat("0x", vm.parseJsonString(json, ".proofs[0].proofHex"))
        );
        string[] memory encoded =
            vm.parseJsonStringArray(json, ".proofs[0].publicInputsHex");
        // The wrapper-level input list is 7 entries; the Noir verifier itself
        // consumes only inputs[2..5] (NOIR_PUBLIC_INPUTS = 3, see
        // _proofInputsForNoir in verifiers/EffortThresholdVerifier.sol).
        inputs = new bytes32[](3);
        for (uint256 i = 0; i < 3; i++) {
            inputs[i] = bytes32(vm.parseBytes(string.concat("0x", encoded[i + 2])));
        }

        token = new BenchToken();
        registry = new ClaimRegistry(owner);
        redeemer = new AchievementRedeemerV2(owner, registry, 7 days);
        vm.startPrank(owner);
        registry.setWriter(address(redeemer), true);
        redeemer.setIssuer(issuer, true);
        redeemer.createCampaign(
            CAMPAIGN,
            IERC20(address(token)),
            POLICY,
            uint64(block.timestamp),
            uint64(block.timestamp + 90 days),
            100e18
        );
        vm.stopPrank();
        token.approve(address(redeemer), 1_000e18);
        redeemer.fundCampaign(CAMPAIGN, 1_000e18);
    }

    function test_RealHonkVerifier_Gas() public {
        uint256 g0 = gasleft();
        bool ok = IUltraVerifier(honk).verify(proof, inputs);
        uint256 used = g0 - gasleft();
        assertTrue(ok);
        console2.log("HonkVerifier.verify (real proof):", used);
    }

    function test_Redeem_Gas() public {
        AchievementRedeemerV2.Receipt memory r = AchievementRedeemerV2.Receipt({
            recipient: rider,
            sessionId: keccak256("bench-session"),
            classId: keccak256("bench-class"),
            policyHash: POLICY,
            campaignId: CAMPAIGN,
            amount: 10e18,
            issuedAt: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp + 1 days)
        });
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(ISSUER_KEY, redeemer.receiptDigest(r));
        bytes memory sig = abi.encodePacked(rr, s, v);

        vm.prank(rider);
        uint256 g0 = gasleft();
        bytes32 n = redeemer.redeem(r, issuer, sig);
        uint256 used = g0 - gasleft();
        assertTrue(registry.isConsumed(n));
        console2.log("AchievementRedeemerV2.redeem (cold):", used);
    }
}
