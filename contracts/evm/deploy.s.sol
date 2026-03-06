// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SpinToken} from "./SpinToken.sol";
import {IncentiveEngine} from "./IncentiveEngine.sol";
import {ClassFactory} from "./ClassFactory.sol";
import {MockUltraVerifier} from "./MockUltraVerifier.sol";
import {TreasurySplitter} from "./TreasurySplitter.sol";
import {YellowSettlement} from "./YellowSettlement.sol";

contract DeployScript is Script {
    function run() external {
        address deployer = vm.addr(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));

        // MockUltraVerifier (no-op verifier safe for testnet)
        console.log("Deploying MockUltraVerifier...");
        MockUltraVerifier mockUltraVerifier = new MockUltraVerifier();
        console.log("MockUltraVerifier:", address(mockUltraVerifier));

        // SpinToken
        console.log("Deploying SpinToken...");
        SpinToken spinToken = new SpinToken(deployer);
        console.log("SpinToken:", address(spinToken));

        // IncentiveEngine(owner, token, signer, verifier)
        console.log("Deploying IncentiveEngine...");
        IncentiveEngine incentiveEngine = new IncentiveEngine(
            deployer,
            address(spinToken),
            deployer,
            address(mockUltraVerifier)
        );
        console.log("IncentiveEngine:", address(incentiveEngine));

        // TreasurySplitter(owner, wallets[], bps[], usePullPattern)
        console.log("Deploying TreasurySplitter...");
        address[] memory wallets = new address[](1);
        wallets[0] = deployer;
        uint256[] memory bps = new uint256[](1);
        bps[0] = 10000;
        TreasurySplitter treasurySplitter = new TreasurySplitter(deployer, wallets, bps, false);
        console.log("TreasurySplitter:", address(treasurySplitter));

        // YellowSettlement(owner, token, engine)
        console.log("Deploying YellowSettlement...");
        YellowSettlement yellowSettlement = new YellowSettlement(
            deployer,
            address(spinToken),
            address(incentiveEngine)
        );
        console.log("YellowSettlement:", address(yellowSettlement));

        // ClassFactory
        console.log("Deploying ClassFactory...");
        ClassFactory classFactory = new ClassFactory();
        console.log("ClassFactory:", address(classFactory));

        // Transfer SpinToken minting rights to IncentiveEngine
        console.log("Transferring SpinToken ownership to IncentiveEngine...");
        spinToken.transferOwnership(address(incentiveEngine));

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT COMPLETE ===");
        console.log("NEXT_PUBLIC_SPIN_TOKEN_ADDRESS=", address(spinToken));
        console.log("NEXT_PUBLIC_INCENTIVE_ENGINE_ADDRESS=", address(incentiveEngine));
        console.log("NEXT_PUBLIC_CLASS_FACTORY_ADDRESS=", address(classFactory));
        console.log("NEXT_PUBLIC_MOCK_ULTRA_VERIFIER_ADDRESS=", address(mockUltraVerifier));
        console.log("NEXT_PUBLIC_TREASURY_SPLITTER_ADDRESS=", address(treasurySplitter));
        console.log("NEXT_PUBLIC_YELLOW_SETTLEMENT_ADDRESS=", address(yellowSettlement));
    }
}