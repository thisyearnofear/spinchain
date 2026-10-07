// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ClaimRegistry} from "./redeemer/ClaimRegistry.sol";
import {AchievementRedeemerV2} from "./redeemer/AchievementRedeemerV2.sol";

interface IMintableERC20 is IERC20 {
    function mint(address to, uint256 amount) external;
}

/// @title Phase 5 pilot deployment (Fuji testnet)
/// @notice Deploys ClaimRegistry + AchievementRedeemerV2, wires roles, and
///         creates + funds a bounded pilot campaign. Testnet only — the pilot
///         asset defaults to the already-deployed Fuji SpinToken (no value).
///
/// Required env:
///   AVALANCHE_PRIVATE_KEY   deployer/owner key (owns Fuji SpinToken)
///   ISSUER_ADDRESS          address of the app's issuer signing key
/// Optional env:
///   GUARDIAN_ADDRESS        incident responder (default: deployer)
///   GAS_PAYER_ADDRESS       allowlisted relayer (default: none)
///   PILOT_ASSET             campaign ERC-20 (default: Fuji SpinToken)
///   PILOT_CAMPAIGN_ID       bytes32 (default: keccak256("spinchain.pilot.rides.v1"))
///   PILOT_POLICY_HASH       bytes32 (default: keccak256("spinchain.pilot.policy.v1"))
///   PILOT_FUND_AMOUNT       default 1_000e18; per-user cap fixed 100e18
///
/// Run:
///   forge script src/deploy-phase5-pilot.s.sol --rpc-url fuji --broadcast --verify
contract DeployPhase5Pilot is Script {
    address internal constant FUJI_SPIN = 0xA2DA94dE3AB8a90D62A1b1897E0e96DBda0F494f;
    uint64 internal constant RECEIPT_LIFETIME = 7 days;
    uint64 internal constant CAMPAIGN_DAYS = 90 days;
    uint256 internal constant PER_USER_CAP = 100e18;

    function run() external {
        uint256 deployerKey = vm.envUint("AVALANCHE_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address issuer = vm.envAddress("ISSUER_ADDRESS");
        address guardian = vm.envOr("GUARDIAN_ADDRESS", deployer);
        address gasPayer = vm.envOr("GAS_PAYER_ADDRESS", address(0));
        address asset = vm.envOr("PILOT_ASSET", FUJI_SPIN);
        bytes32 campaignId = vm.envOr("PILOT_CAMPAIGN_ID", keccak256("spinchain.pilot.rides.v1"));
        bytes32 policyHash = vm.envOr("PILOT_POLICY_HASH", keccak256("spinchain.pilot.policy.v1"));
        uint256 fundAmount = vm.envOr("PILOT_FUND_AMOUNT", uint256(1_000e18));

        require(issuer != address(0), "ISSUER_ADDRESS required");
        require(asset != address(0), "PILOT_ASSET required");

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

        redeemer.createCampaign(
            campaignId,
            IERC20(asset),
            policyHash,
            uint64(block.timestamp),
            uint64(block.timestamp + CAMPAIGN_DAYS),
            PER_USER_CAP
        );

        // Fund from the deployer's mint rights on the pilot asset.
        IMintableERC20(asset).mint(deployer, fundAmount);
        IERC20(asset).approve(address(redeemer), fundAmount);
        redeemer.fundCampaign(campaignId, fundAmount);

        vm.stopBroadcast();

        console.log("=== Phase 5 pilot deployment ===");
        console.log("ClaimRegistry:      ", address(registry));
        console.log("AchievementRedeemerV2:", address(redeemer));
        console.log("campaignId          :", vm.toString(campaignId));
        console.log("policyHash          :", vm.toString(policyHash));
        console.log("asset               :", asset);
        console.log("issuer              :", issuer);
        console.log("guardian            :", guardian);
        console.log("gasPayer            :", gasPayer);
        console.log("funded              :", fundAmount);
    }
}
