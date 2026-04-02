// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SpinToken} from "./SpinToken.sol";
import {IncentiveEngine} from "./IncentiveEngine.sol";
import {ClassFactory} from "./ClassFactory.sol";
import {UltraVerifier} from "../UltraVerifier.sol";
import {TreasurySplitter} from "./TreasurySplitter.sol";
import {YellowSettlement} from "./YellowSettlement.sol";
import {BiometricOracle} from "./BiometricOracle.sol";

/**
 * @title Production Deploy Script
 * @notice Deploy SpinChain contracts to mainnet with real ZK verifier
 *
 * Prerequisites:
 * 1. Generate UltraVerifier with Barretenberg:
 *    cd circuits/effort_threshold
 *    bb write_vk -b target/effort_threshold.json -o target/vk
 *    bb contract -k target/vk -o ../../contracts/evm/UltraVerifier.sol
 *
 * 2. Set environment variables:
 *    AVALANCHE_PRIVATE_KEY - Deployer private key
 *    CHAINLINK_FORWARDER - Chainlink CRE forwarder address (if using oracle)
 *    WORKFLOW_ID - Chainlink workflow ID (bytes32)
 *
 * 3. Run on Avalanche mainnet:
 *    forge script script/deploy-production.s.sol --rpc-url $AVALANCHE_RPC_URL --broadcast --verify
 */
contract ProductionDeployScript is Script {
    function run() external {
        address deployer = vm.addr(vm.envUint("AVALANCHE_PRIVATE_KEY"));
        vm.startBroadcast(vm.envUint("AVALANCHE_PRIVATE_KEY"));

        console.log("=== PRODUCTION DEPLOYMENT ===");
        console.log("Deployer:", deployer);
        console.log("");

        // UltraVerifier (real Barretenberg-generated verifier)
        // IMPORTANT: Verify VERIFICATION_KEY_INITIALIZED is true in UltraVerifier.sol
        console.log("Deploying UltraVerifier...");
        UltraVerifier ultraVerifier = new UltraVerifier();
        console.log("UltraVerifier:", address(ultraVerifier));
        
        // Verify the verifier is properly initialized
        try ultraVerifier.VERIFICATION_KEY_INITIALIZED() returns (bool initialized) {
            require(initialized, "UltraVerifier not initialized - run bb contract first");
            console.log("Verification key: INITIALIZED");
        } catch {
            console.log("WARNING: Could not verify VK initialization");
        }

        // SpinToken
        console.log("\nDeploying SpinToken...");
        SpinToken spinToken = new SpinToken(deployer);
        console.log("SpinToken:", address(spinToken));

        // IncentiveEngine(owner, token, signer, verifier)
        console.log("\nDeploying IncentiveEngine...");
        IncentiveEngine incentiveEngine = new IncentiveEngine(
            deployer,
            address(spinToken),
            deployer, // Initial signer (attestation oracle)
            address(ultraVerifier),
            deployer
        );
        console.log("IncentiveEngine:", address(incentiveEngine));

        // BiometricOracle(forwarder, workflowId)
        // Optional: Only deploy if Chainlink CRE is configured
        address chainlinkForwarder = vm.envOr("CHAINLINK_FORWARDER", address(0));
        bytes32 workflowId = vm.envOr("WORKFLOW_ID", bytes32(0));
        
        BiometricOracle biometricOracle;
        if (chainlinkForwarder != address(0)) {
            console.log("\nDeploying BiometricOracle...");
            biometricOracle = new BiometricOracle(chainlinkForwarder, workflowId);
            console.log("BiometricOracle:", address(biometricOracle));
            
            console.log("Linking BiometricOracle to IncentiveEngine...");
            incentiveEngine.setBiometricOracle(address(biometricOracle));
        } else {
            console.log("\nSkipping BiometricOracle (Chainlink CRE not configured)");
        }

        // TreasurySplitter(owner, wallets[], bps[], usePullPattern)
        console.log("\nDeploying TreasurySplitter...");
        address[] memory wallets = new address[](1);
        wallets[0] = deployer;
        uint256[] memory bps = new uint256[](1);
        bps[0] = 10000; // 100% to deployer initially (configure later)
        TreasurySplitter treasurySplitter = new TreasurySplitter(deployer, wallets, bps, false);
        console.log("TreasurySplitter:", address(treasurySplitter));

        // YellowSettlement(owner, token, engine)
        console.log("\nDeploying YellowSettlement...");
        YellowSettlement yellowSettlement = new YellowSettlement(
            deployer,
            address(spinToken),
            address(incentiveEngine),
            deployer
        );
        console.log("YellowSettlement:", address(yellowSettlement));

        // ClassFactory
        console.log("\nDeploying ClassFactory...");
        ClassFactory classFactory = new ClassFactory();
        console.log("ClassFactory:", address(classFactory));

        // Transfer SpinToken minting rights to IncentiveEngine
        console.log("\nTransferring SpinToken ownership to IncentiveEngine...");
        spinToken.transferOwnership(address(incentiveEngine));

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT COMPLETE ===");
        console.log("Copy these to .env.local:");
        console.log("");
        console.log("NEXT_PUBLIC_SPIN_TOKEN_ADDRESS=%s", address(spinToken));
        console.log("NEXT_PUBLIC_INCENTIVE_ENGINE_ADDRESS=%s", address(incentiveEngine));
        console.log("NEXT_PUBLIC_CLASS_FACTORY_ADDRESS=%s", address(classFactory));
        console.log("NEXT_PUBLIC_ULTRA_VERIFIER_ADDRESS=%s", address(ultraVerifier));
        console.log("NEXT_PUBLIC_TREASURY_SPLITTER_ADDRESS=%s", address(treasurySplitter));
        console.log("NEXT_PUBLIC_YELLOW_SETTLEMENT_ADDRESS=%s", address(yellowSettlement));
        if (address(biometricOracle) != address(0)) {
            console.log("NEXT_PUBLIC_BIOMETRIC_ORACLE_ADDRESS=%s", address(biometricOracle));
        }
        console.log("");
        console.log("IMPORTANT: Verify UltraVerifier.VERIFICATION_KEY_INITIALIZED == true");
    }
}
