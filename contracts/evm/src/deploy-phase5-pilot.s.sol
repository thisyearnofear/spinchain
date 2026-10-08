// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ClaimRegistry} from "./redeemer/ClaimRegistry.sol";
import {AchievementRedeemerV2} from "./redeemer/AchievementRedeemerV2.sol";
import {PilotSpinToken} from "./redeemer/PilotSpinToken.sol";

/// @title Phase 5 pilot deployment (Fuji testnet)
/// @notice Deploys ClaimRegistry + AchievementRedeemerV2, wires roles, and
///         creates + funds a bounded pilot campaign. Testnet only — the pilot
///         asset defaults to a freshly deployed PilotSpinToken (no value).
///
/// Required env:
///   AVALANCHE_PRIVATE_KEY   deployer/owner key
///   ISSUER_ADDRESS          address of the app's issuer signing key
/// Optional env:
///   GUARDIAN_ADDRESS        incident responder (default: deployer)
///   GAS_PAYER_ADDRESS       allowlisted relayer (default: none)
///   PILOT_ASSET             campaign ERC-20 (default: deploy fresh PilotSpinToken;
///                           when set, the deployer must already hold >= PILOT_FUND_AMOUNT —
///                           Fuji SpinToken's mint is locked to the IncentiveEngine)
///   PILOT_CAMPAIGN_ID       bytes32 (default: keccak256("spinchain.pilot.rides.v1"))
///   PILOT_POLICY_HASH       bytes32 (default: keccak256("spinchain.pilot.policy.v1"))
///   PILOT_FUND_AMOUNT       default 1_000e18; per-user cap fixed 100e18
///
/// Run:
///   forge script src/deploy-phase5-pilot.s.sol --rpc-url fuji --broadcast --verify
contract DeployPhase5Pilot is Script {
    uint64 internal constant RECEIPT_LIFETIME = 7 days;
    uint64 internal constant CAMPAIGN_DAYS = 90 days;
    uint256 internal constant PER_USER_CAP = 100e18;

    function run() external {
        uint256 deployerKey = vm.envUint("AVALANCHE_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address issuer = vm.envAddress("ISSUER_ADDRESS");
        address guardian = vm.envOr("GUARDIAN_ADDRESS", deployer);
        address gasPayer = vm.envOr("GAS_PAYER_ADDRESS", address(0));
        address suppliedAsset = vm.envOr("PILOT_ASSET", address(0));
        bytes32 campaignId = vm.envOr("PILOT_CAMPAIGN_ID", keccak256("spinchain.pilot.rides.v1"));
        bytes32 policyHash = vm.envOr("PILOT_POLICY_HASH", keccak256("spinchain.pilot.policy.v1"));
        uint256 fundAmount = vm.envOr("PILOT_FUND_AMOUNT", uint256(1_000e18));

        require(issuer != address(0), "ISSUER_ADDRESS required");

        vm.startBroadcast(deployerKey);

        ClaimRegistry registry = new ClaimRegistry(deployer);
        AchievementRedeemerV2 redeemer =
            new AchievementRedeemerV2(deployer, registry, RECEIPT_LIFETIME);
        registry.setWriter(address(redeemer), true);

        redeemer.setIssuer(issuer, true);
        redeemer.setGuardian(guardian);
        if (gasPayer != address(0)) {
            redeemer.setGasPayer(gasPayer, true);
        }

        // Asset: supplied ERC-20 (deployer must hold the balance) or a fresh
        // pilot token minted to the deployer with 4x headroom for refills.
        IERC20 asset;
        if (suppliedAsset != address(0)) {
            asset = IERC20(suppliedAsset);
        } else {
            asset = IERC20(address(new PilotSpinToken(fundAmount * 4)));
        }

        redeemer.createCampaign(
            campaignId,
            asset,
            policyHash,
            uint64(block.timestamp),
            uint64(block.timestamp + CAMPAIGN_DAYS),
            PER_USER_CAP
        );

        asset.approve(address(redeemer), fundAmount);
        redeemer.fundCampaign(campaignId, fundAmount);

        vm.stopBroadcast();

        console.log("=== Phase 5 pilot deployment ===");
        console.log("ClaimRegistry:      ", address(registry));
        console.log("AchievementRedeemerV2:", address(redeemer));
        console.log("campaignId          :", vm.toString(campaignId));
        console.log("policyHash          :", vm.toString(policyHash));
        console.log("asset               :", address(asset));
        console.log("issuer              :", issuer);
        console.log("guardian            :", guardian);
        console.log("gasPayer            :", gasPayer);
        console.log("funded              :", fundAmount);
    }
}
