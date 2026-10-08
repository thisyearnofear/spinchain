// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AchievementRedeemerV2} from "./redeemer/AchievementRedeemerV2.sol";

/// @title Phase 5 pilot dogfood — one real redeem() on Fuji.
/// @notice Signs a Receipt with the issuer key and redeems it as the
///         recipient (deployer). Proves the on-chain loop end to end:
///         EIP-712 verify → nullifier consume → budget debit → transfer.
///         Replay rejection is checked separately via eth_call.
///
/// Required env:
///   AVALANCHE_PRIVATE_KEY  recipient/deployer key
///   ISSUER_PRIVATE_KEY     pilot issuer key (must match set issuer)
///   REDEEMER_ADDRESS       deployed AchievementRedeemerV2
/// Optional env:
///   DOGFOOD_SESSION_TAG    ride tag -> sessionId (default "dogfood-1")
///
/// Run:
///   forge script src/dogfood-phase5-pilot.s.sol --rpc-url fuji --broadcast
contract DogfoodPhase5Pilot is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("AVALANCHE_PRIVATE_KEY");
        uint256 issuerKey = vm.envUint("ISSUER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address issuer = vm.addr(issuerKey);
        AchievementRedeemerV2 redeemer =
            AchievementRedeemerV2(vm.envAddress("REDEEMER_ADDRESS"));

        string memory tag = vm.envOr("DOGFOOD_SESSION_TAG", string("dogfood-1"));

        AchievementRedeemerV2.Receipt memory r = AchievementRedeemerV2.Receipt({
            recipient: deployer,
            sessionId: keccak256(abi.encodePacked("spinchain.ride.v1:", tag)),
            classId: keccak256("spinchain.class.v1:none"),
            policyHash: keccak256("spinchain.pilot.policy.v1"),
            campaignId: keccak256("spinchain.pilot.rides.v1"),
            amount: 10e18,
            issuedAt: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp + 7 days)
        });

        bytes32 digest = redeemer.receiptDigest(r);
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(issuerKey, digest);
        bytes memory signature = abi.encodePacked(rr, s, v);

        vm.startBroadcast(deployerKey);
        bytes32 nullifier = redeemer.redeem(r, issuer, signature);
        vm.stopBroadcast();

        console.log("session tag  :", tag);
        console.log("recipient    :", deployer);
        console.log("nullifier    :", vm.toString(nullifier));
    }
}
