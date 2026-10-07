// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AchievementRedeemerV2} from "../src/redeemer/AchievementRedeemerV2.sol";
import {ClaimRegistry} from "../src/redeemer/ClaimRegistry.sol";

contract TestToken is ERC20 {
    constructor() ERC20("Test", "TST") {
        _mint(msg.sender, 1e30);
    }
}

contract Mock1271Issuer is IERC1271 {
    address public immutable signer;

    constructor(address signer_) {
        signer = signer_;
    }

    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4) {
        return ECDSA.recover(hash, signature) == signer ? IERC1271.isValidSignature.selector : bytes4(0xffffffff);
    }
}

contract AchievementRedeemerV2Test is Test {
    ClaimRegistry internal registry;
    AchievementRedeemerV2 internal redeemer;
    TestToken internal token;

    address internal owner = makeAddr("owner");
    address internal guardian = makeAddr("guardian");
    address internal rider = makeAddr("rider");
    address internal relayer = makeAddr("relayer");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant ISSUER_KEY = 0xA11CE;
    uint256 internal constant ISSUER2_KEY = 0xB0B;
    address internal issuer;

    bytes32 internal constant CAMPAIGN = keccak256("campaign-1");
    bytes32 internal constant POLICY = keccak256("policy-v1");
    bytes32 internal constant SESSION = keccak256("session-1");
    bytes32 internal constant CLASS = keccak256("class-1");
    uint64 internal constant LIFETIME = 7 days;
    uint256 internal constant USER_CAP = 100e18;
    uint256 internal constant FUNDING = 1_000e18;

    function setUp() public {
        vm.warp(1_800_000_000);
        issuer = vm.addr(ISSUER_KEY);
        token = new TestToken();
        registry = new ClaimRegistry(owner);
        redeemer = _deployRedeemer();
    }

    function _deployRedeemer() internal returns (AchievementRedeemerV2 r) {
        r = new AchievementRedeemerV2(owner, registry, LIFETIME);
        vm.startPrank(owner);
        registry.setWriter(address(r), true);
        r.setIssuer(issuer, true);
        r.setGuardian(guardian);
        r.setGasPayer(relayer, true);
        r.createCampaign(CAMPAIGN, IERC20(address(token)), POLICY, uint64(block.timestamp), uint64(block.timestamp + 30 days), USER_CAP);
        vm.stopPrank();
        token.approve(address(r), type(uint256).max);
        r.fundCampaign(CAMPAIGN, FUNDING);
    }

    function _receipt(bytes32 sessionId, uint256 amount) internal view returns (AchievementRedeemerV2.Receipt memory) {
        return AchievementRedeemerV2.Receipt({
            recipient: rider,
            sessionId: sessionId,
            classId: CLASS,
            policyHash: POLICY,
            campaignId: CAMPAIGN,
            amount: amount,
            issuedAt: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp + 1 days)
        });
    }

    function _sign(AchievementRedeemerV2 target, AchievementRedeemerV2.Receipt memory r, uint256 key)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(key, target.receiptDigest(r));
        return abi.encodePacked(rr, s, v);
    }

    function _redeemAs(address caller, AchievementRedeemerV2.Receipt memory r) internal returns (bytes32) {
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.prank(caller);
        return redeemer.redeem(r, issuer, sig);
    }

    // ─── Happy paths ───────────────────────────────────────────────

    function test_RedeemByRecipient() public {
        bytes32 n = _redeemAs(rider, _receipt(SESSION, 10e18));
        assertEq(token.balanceOf(rider), 10e18);
        assertEq(n, redeemer.nullifierFor(CAMPAIGN, SESSION));
        assertTrue(registry.isConsumed(n));
        assertEq(registry.consumedBy(n), address(redeemer));
        assertEq(redeemer.remainingBudget(CAMPAIGN), FUNDING - 10e18);
        assertEq(redeemer.redeemedBy(CAMPAIGN, rider), 10e18);
    }

    function test_RedeemByAllowlistedGasPayerPaysRecipient() public {
        _redeemAs(relayer, _receipt(SESSION, 10e18));
        assertEq(token.balanceOf(rider), 10e18);
        assertEq(token.balanceOf(relayer), 0);
    }

    function test_EmitsMinimalSettlementEvidence() public {
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.expectEmit(true, true, true, true, address(redeemer));
        emit AchievementRedeemerV2.Redeemed(redeemer.nullifierFor(CAMPAIGN, SESSION), CAMPAIGN, rider, 10e18, issuer);
        vm.prank(rider);
        redeemer.redeem(r, issuer, sig);
    }

    function test_Erc1271Issuer() public {
        Mock1271Issuer wallet = new Mock1271Issuer(vm.addr(ISSUER2_KEY));
        vm.prank(owner);
        redeemer.setIssuer(address(wallet), true);
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        bytes memory sig = _sign(redeemer, r, ISSUER2_KEY);
        vm.prank(rider);
        redeemer.redeem(r, address(wallet), sig);
        assertEq(token.balanceOf(rider), 10e18);
    }

    // ─── Replay / nullifier ────────────────────────────────────────

    function test_RevertWhen_ReceiptReplayed() public {
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        _redeemAs(rider, r);
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.prank(rider);
        vm.expectRevert(ClaimRegistry.AlreadyConsumed.selector);
        redeemer.redeem(r, issuer, sig);
    }

    function test_RevertWhen_SessionReissuedWithDifferentTerms() public {
        _redeemAs(rider, _receipt(SESSION, 10e18));
        vm.warp(block.timestamp + 1 hours);
        AchievementRedeemerV2.Receipt memory again = _receipt(SESSION, 20e18);
        bytes memory sig = _sign(redeemer, again, ISSUER_KEY);
        vm.prank(rider);
        vm.expectRevert(ClaimRegistry.AlreadyConsumed.selector);
        redeemer.redeem(again, issuer, sig);
    }

    function test_NullifierSurvivesRedeemerMigration() public {
        _redeemAs(rider, _receipt(SESSION, 10e18));
        AchievementRedeemerV2 next = _deployRedeemer();
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        bytes memory sig = _sign(next, r, ISSUER_KEY);
        vm.prank(rider);
        vm.expectRevert(ClaimRegistry.AlreadyConsumed.selector);
        next.redeem(r, issuer, sig);
    }

    function test_RevertWhen_RedeemerNotRegistryWriter() public {
        vm.prank(owner);
        registry.setWriter(address(redeemer), false);
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.prank(rider);
        vm.expectRevert(ClaimRegistry.NotWriter.selector);
        redeemer.redeem(r, issuer, sig);
    }

    // ─── Signature / domain binding ────────────────────────────────

    function test_RevertWhen_SignedForAnotherDeployment() public {
        AchievementRedeemerV2 other = _deployRedeemer();
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        bytes memory sig = _sign(other, r, ISSUER_KEY);
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.InvalidSignature.selector);
        redeemer.redeem(r, issuer, sig);
    }

    function test_RevertWhen_SignedForAnotherChain() public {
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.chainId(block.chainid + 1);
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.InvalidSignature.selector);
        redeemer.redeem(r, issuer, sig);
    }

    function test_RevertWhen_RecipientSwapped() public {
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        r.recipient = stranger;
        vm.prank(stranger);
        vm.expectRevert(AchievementRedeemerV2.InvalidSignature.selector);
        redeemer.redeem(r, issuer, sig);
    }

    function test_RevertWhen_ClassOrAmountTampered() public {
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        r.amount = 50e18;
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.InvalidSignature.selector);
        redeemer.redeem(r, issuer, sig);
        r.amount = 10e18;
        r.classId = keccak256("class-2");
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.InvalidSignature.selector);
        redeemer.redeem(r, issuer, sig);
    }

    function test_RevertWhen_UnknownIssuer() public {
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        bytes memory sig = _sign(redeemer, r, ISSUER2_KEY);
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.UnauthorizedIssuer.selector);
        redeemer.redeem(r, vm.addr(ISSUER2_KEY), sig);
    }

    function test_RevertWhen_SignerDoesNotMatchClaimedIssuer() public {
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        bytes memory sig = _sign(redeemer, r, ISSUER2_KEY);
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.InvalidSignature.selector);
        redeemer.redeem(r, issuer, sig);
    }

    // ─── Signer rotation / governance ──────────────────────────────

    function test_SignerRotation() public {
        address issuer2 = vm.addr(ISSUER2_KEY);
        vm.prank(owner);
        redeemer.setIssuer(issuer2, true);
        vm.prank(guardian);
        redeemer.revokeIssuer(issuer);

        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        bytes memory oldSig = _sign(redeemer, r, ISSUER_KEY);
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.UnauthorizedIssuer.selector);
        redeemer.redeem(r, issuer, oldSig);

        bytes memory newSig = _sign(redeemer, r, ISSUER2_KEY);
        vm.prank(rider);
        redeemer.redeem(r, issuer2, newSig);
        assertEq(token.balanceOf(rider), 10e18);
    }

    function test_RevertWhen_GuardianAddsIssuer() public {
        vm.prank(guardian);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, guardian));
        redeemer.setIssuer(stranger, true);
    }

    function test_RevertWhen_StrangerRevokesIssuer() public {
        vm.prank(stranger);
        vm.expectRevert(AchievementRedeemerV2.NotGuardianOrOwner.selector);
        redeemer.revokeIssuer(issuer);
    }

    function test_OwnershipTransferIsTwoStep() public {
        address next = makeAddr("next");
        vm.prank(owner);
        redeemer.transferOwnership(next);
        assertEq(redeemer.owner(), owner);
        vm.prank(next);
        redeemer.acceptOwnership();
        assertEq(redeemer.owner(), next);
    }

    // ─── Gas payer ─────────────────────────────────────────────────

    function test_RevertWhen_GasPayerNotAllowlisted() public {
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.prank(stranger);
        vm.expectRevert(AchievementRedeemerV2.GasPayerNotAllowed.selector);
        redeemer.redeem(r, issuer, sig);
    }

    // ─── Time bounds ───────────────────────────────────────────────

    function test_RevertWhen_Expired() public {
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.warp(r.expiresAt + 1);
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.ReceiptExpired.selector);
        redeemer.redeem(r, issuer, sig);
    }

    function test_RevertWhen_IssuedInFuture() public {
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        r.issuedAt = uint64(block.timestamp + 1);
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.ReceiptNotYetValid.selector);
        redeemer.redeem(r, issuer, sig);
    }

    function test_RevertWhen_LifetimeTooLong() public {
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        r.expiresAt = r.issuedAt + LIFETIME + 1;
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.LifetimeTooLong.selector);
        redeemer.redeem(r, issuer, sig);
    }

    // ─── Campaign policy / budgets ─────────────────────────────────

    function test_RevertWhen_PolicyMismatch() public {
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        r.policyHash = keccak256("policy-v2");
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.PolicyMismatch.selector);
        redeemer.redeem(r, issuer, sig);
    }

    function test_RevertWhen_CampaignDeactivated() public {
        vm.prank(owner);
        redeemer.setCampaignActive(CAMPAIGN, false);
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.CampaignInactive.selector);
        redeemer.redeem(r, issuer, sig);
    }

    function test_RevertWhen_CampaignEnded() public {
        vm.warp(block.timestamp + 30 days + 1);
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.CampaignInactive.selector);
        redeemer.redeem(r, issuer, sig);
    }

    function test_RevertWhen_UnknownCampaign() public {
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        r.campaignId = keccak256("nope");
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.CampaignInactive.selector);
        redeemer.redeem(r, issuer, sig);
    }

    function test_RevertWhen_CampaignBudgetExceeded() public {
        bytes32 small = keccak256("campaign-small");
        vm.prank(owner);
        redeemer.createCampaign(small, IERC20(address(token)), POLICY, uint64(block.timestamp), uint64(block.timestamp + 1 days), USER_CAP);
        redeemer.fundCampaign(small, 5e18);
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 6e18);
        r.campaignId = small;
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.CampaignBudgetExceeded.selector);
        redeemer.redeem(r, issuer, sig);
    }

    function test_CampaignBudgetsAreIsolated() public {
        bytes32 empty = keccak256("campaign-empty");
        vm.prank(owner);
        redeemer.createCampaign(empty, IERC20(address(token)), POLICY, uint64(block.timestamp), uint64(block.timestamp + 1 days), USER_CAP);
        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 1e18);
        r.campaignId = empty;
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.CampaignBudgetExceeded.selector);
        redeemer.redeem(r, issuer, sig);
    }

    function test_RevertWhen_UserCapExceeded() public {
        _redeemAs(rider, _receipt(keccak256("s1"), 60e18));
        AchievementRedeemerV2.Receipt memory r = _receipt(keccak256("s2"), 41e18);
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.prank(rider);
        vm.expectRevert(AchievementRedeemerV2.UserCapExceeded.selector);
        redeemer.redeem(r, issuer, sig);
        _redeemAs(rider, _receipt(keccak256("s3"), 40e18));
        assertEq(redeemer.redeemedBy(CAMPAIGN, rider), USER_CAP);
    }

    function test_WithdrawUnspentOnlyAfterCampaignStops() public {
        _redeemAs(rider, _receipt(SESSION, 10e18));
        vm.prank(owner);
        vm.expectRevert(AchievementRedeemerV2.CampaignStillLive.selector);
        redeemer.withdrawUnspent(CAMPAIGN, owner);

        vm.startPrank(owner);
        redeemer.setCampaignActive(CAMPAIGN, false);
        redeemer.withdrawUnspent(CAMPAIGN, owner);
        vm.stopPrank();
        assertEq(token.balanceOf(owner), FUNDING - 10e18);
        assertEq(redeemer.remainingBudget(CAMPAIGN), 0);
    }

    // ─── Incident pause ────────────────────────────────────────────

    function test_GuardianPausesOnlyOwnerUnpauses() public {
        vm.prank(guardian);
        redeemer.pause();

        AchievementRedeemerV2.Receipt memory r = _receipt(SESSION, 10e18);
        bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
        vm.prank(rider);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        redeemer.redeem(r, issuer, sig);

        vm.prank(guardian);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, guardian));
        redeemer.unpause();

        vm.prank(owner);
        redeemer.unpause();
        vm.prank(rider);
        redeemer.redeem(r, issuer, sig);
        assertEq(token.balanceOf(rider), 10e18);
    }

    // ─── Invariants (fuzz) ─────────────────────────────────────────

    function testFuzz_CapsAndBudgetNeverExceeded(uint96[8] calldata amounts) public {
        uint256 paid;
        for (uint256 i = 0; i < amounts.length; i++) {
            AchievementRedeemerV2.Receipt memory r = _receipt(keccak256(abi.encode("fuzz", i)), uint256(amounts[i]) % (USER_CAP + 1));
            bytes memory sig = _sign(redeemer, r, ISSUER_KEY);
            vm.prank(rider);
            try redeemer.redeem(r, issuer, sig) {
                paid += r.amount;
            } catch {}
            assertLe(redeemer.redeemedBy(CAMPAIGN, rider), USER_CAP);
        }
        assertEq(token.balanceOf(rider), paid);
        assertEq(redeemer.remainingBudget(CAMPAIGN), FUNDING - paid);
    }
}

contract ClaimRegistryTest is Test {
    ClaimRegistry internal registry;
    address internal owner = makeAddr("owner");
    address internal writer = makeAddr("writer");

    function setUp() public {
        registry = new ClaimRegistry(owner);
        vm.prank(owner);
        registry.setWriter(writer, true);
    }

    function test_ConsumeOnce() public {
        vm.prank(writer);
        registry.consume(keccak256("n"));
        assertTrue(registry.isConsumed(keccak256("n")));
        vm.prank(writer);
        vm.expectRevert(ClaimRegistry.AlreadyConsumed.selector);
        registry.consume(keccak256("n"));
    }

    function test_RevokedWriterKeepsHistory() public {
        vm.prank(writer);
        registry.consume(keccak256("n"));
        vm.prank(owner);
        registry.setWriter(writer, false);
        assertTrue(registry.isConsumed(keccak256("n")));
        vm.prank(writer);
        vm.expectRevert(ClaimRegistry.NotWriter.selector);
        registry.consume(keccak256("m"));
    }

    function test_RevertWhen_NonOwnerSetsWriter() public {
        vm.prank(writer);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, writer));
        registry.setWriter(writer, true);
    }
}
