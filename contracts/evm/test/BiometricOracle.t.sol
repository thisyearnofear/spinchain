// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {BiometricOracle} from "../BiometricOracle.sol";
import {IncentiveEngine} from "../IncentiveEngine.sol";
import {SpinToken} from "../SpinToken.sol";
import {MockUltraVerifier} from "../MockUltraVerifier.sol";

contract BiometricOracleTest is Test {
    BiometricOracle public oracle;
    IncentiveEngine public engine;
    SpinToken public token;
    MockUltraVerifier public verifier;

    address public owner = address(0x1);
    address public rider = address(0x2);
    address public creForwarder = address(0x3);
    bytes32 public workflowId = keccak256("workflow-v1");
    bytes32 public classId = keccak256("class-001");

    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy stack
        token = new SpinToken(owner);
        verifier = new MockUltraVerifier();
        engine = new IncentiveEngine(owner, address(token), owner, address(verifier));
        oracle = new BiometricOracle(creForwarder, workflowId);
        
        // Setup permissions
        token.transferOwnership(address(engine));
        engine.setBiometricOracle(address(oracle));
        
        vm.stopPrank();
    }

    function test_RequestVerification() public {
        vm.startPrank(rider);
        
        bytes32 requestId = oracle.requestVerification(classId, 150, 30);
        
        (
            address reqRider,
            bytes32 reqClassId,
            uint256 timestamp,
            uint16 threshold,
            uint16 duration,
            bool fulfilled,
            bool verified
        ) = oracle.requests(requestId);

        assertEq(reqRider, rider);
        assertEq(reqClassId, classId);
        assertEq(threshold, 150);
        assertEq(duration, 30);
        assertFalse(fulfilled);
        assertFalse(verified);
        
        vm.stopPrank();
    }

    function test_FulfillReport() public {
        vm.startPrank(rider);
        bytes32 requestId = oracle.requestVerification(classId, 150, 30);
        vm.stopPrank();

        // Simulate CRE fulfillment
        vm.startPrank(creForwarder);
        oracle.fulfillCREReport(requestId, workflowId, true, 850);
        vm.stopPrank();

        (,,,,, bool fulfilled, bool verified) = oracle.requests(requestId);
        assertTrue(fulfilled);
        assertTrue(verified);
        assertEq(oracle.getVerifiedScore(classId, rider), 850);
    }

    function test_ClaimRewardViaChainlink() public {
        // 1. Request
        vm.prank(rider);
        bytes32 requestId = oracle.requestVerification(classId, 150, 30);

        // 2. Fulfill
        vm.prank(creForwarder);
        oracle.fulfillCREReport(requestId, workflowId, true, 900);

        // 3. Claim
        vm.prank(rider);
        engine.submitChainlinkProof(classId);

        // 4. Verify
        uint256 balance = token.balanceOf(rider);
        assertGt(balance, 0);
        console2.log("Rider reward balance:", balance);
        
        // Base reward for 900 score: 10 + (900 * 90 / 1000) = 10 + 81 = 91 SPIN
        assertEq(balance, 91 * 1e18);
    }

    function test_Fail_UnauthorizedForwarder() public {
        vm.prank(rider);
        bytes32 requestId = oracle.requestVerification(classId, 150, 30);

        vm.prank(address(0xdead));
        vm.expectRevert(BiometricOracle.UnauthorizedForwarder.selector);
        oracle.fulfillCREReport(requestId, workflowId, true, 850);
    }

    function test_Fail_UnauthorizedWorkflow() public {
        vm.prank(rider);
        bytes32 requestId = oracle.requestVerification(classId, 150, 30);

        vm.prank(creForwarder);
        vm.expectRevert(BiometricOracle.UnauthorizedWorkflow.selector);
        oracle.fulfillCREReport(requestId, keccak256("wrong-workflow"), true, 850);
    }
}
