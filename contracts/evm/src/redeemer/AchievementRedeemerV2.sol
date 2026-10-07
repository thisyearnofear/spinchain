// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ClaimRegistry} from "./ClaimRegistry.sol";

/// @title AchievementRedeemerV2
/// @notice Bounded, funded redeemer for issuer-signed ride receipts (phase 4).
///         Trust statement: a redemption means "an authorized SpinChain issuer
///         approved this session under this policy" — nothing more. A later ZK
///         envelope can bind a proof to the same Receipt fields and nullifier.
/// @dev Design + tests only; not deployed. Economics (amounts, budgets, caps)
///      are campaign parameters set by governance, not constants here.
contract AchievementRedeemerV2 is EIP712, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice EIP-712 typed receipt. `amount` is issuer-signed and bounded by
    ///         the campaign budget and per-user cap.
    struct Receipt {
        address recipient;
        bytes32 sessionId;
        bytes32 classId;
        bytes32 policyHash;
        bytes32 campaignId;
        uint256 amount;
        uint64 issuedAt;
        uint64 expiresAt;
    }

    struct Campaign {
        IERC20 asset;
        bytes32 policyHash;
        uint64 startsAt;
        uint64 endsAt;
        uint256 perUserCap;
        uint256 funded;
        uint256 spent;
        bool active;
    }

    bytes32 public constant RECEIPT_TYPEHASH = keccak256(
        "Receipt(address recipient,bytes32 sessionId,bytes32 classId,bytes32 policyHash,bytes32 campaignId,uint256 amount,uint64 issuedAt,uint64 expiresAt)"
    );
    /// @notice Domain tag for nullifiers; independent of contract address,
    ///         signature, or proof bytes so it survives redeemer migrations.
    bytes32 public constant NULLIFIER_DOMAIN = keccak256("spinchain.achievement.nullifier.v1");

    ClaimRegistry public immutable registry;
    /// @notice Max signed lifetime (expiresAt - issuedAt) of any receipt.
    uint64 public immutable maxReceiptLifetime;

    /// @notice Incident responder: may pause and revoke issuers, never add them.
    address public guardian;
    mapping(address => bool) public isIssuer;
    mapping(address => bool) public isGasPayer;
    mapping(bytes32 => Campaign) public campaigns;
    mapping(bytes32 => mapping(address => uint256)) public redeemedBy;

    error ZeroAddress();
    error InvalidLifetime();
    error NotGuardianOrOwner();
    error CampaignExists();
    error UnknownCampaign();
    error CampaignInactive();
    error CampaignStillLive();
    error InvalidCampaignWindow();
    error GasPayerNotAllowed();
    error InvalidReceipt();
    error ReceiptNotYetValid();
    error ReceiptExpired();
    error LifetimeTooLong();
    error PolicyMismatch();
    error UnauthorizedIssuer();
    error InvalidSignature();
    error CampaignBudgetExceeded();
    error UserCapExceeded();

    event GuardianSet(address indexed guardian);
    event IssuerSet(address indexed issuer, bool allowed, address indexed by);
    event GasPayerSet(address indexed gasPayer, bool allowed);
    event CampaignCreated(bytes32 indexed campaignId, address indexed asset, bytes32 policyHash, uint64 startsAt, uint64 endsAt, uint256 perUserCap);
    event CampaignActiveSet(bytes32 indexed campaignId, bool active);
    event CampaignFunded(bytes32 indexed campaignId, address indexed from, uint256 amount);
    event CampaignWithdrawn(bytes32 indexed campaignId, address indexed to, uint256 amount);
    /// @notice Minimal settlement evidence: no session, class, or telemetry data.
    event Redeemed(bytes32 indexed nullifier, bytes32 indexed campaignId, address indexed recipient, uint256 amount, address issuer);

    modifier onlyGuardianOrOwner() {
        if (msg.sender != guardian && msg.sender != owner()) revert NotGuardianOrOwner();
        _;
    }

    constructor(address owner_, ClaimRegistry registry_, uint64 maxReceiptLifetime_)
        EIP712("SpinChain AchievementRedeemer", "2")
        Ownable(owner_)
    {
        if (address(registry_) == address(0)) revert ZeroAddress();
        if (maxReceiptLifetime_ == 0) revert InvalidLifetime();
        registry = registry_;
        maxReceiptLifetime = maxReceiptLifetime_;
    }

    // ─── Governance ────────────────────────────────────────────────

    function setGuardian(address guardian_) external onlyOwner {
        guardian = guardian_;
        emit GuardianSet(guardian_);
    }

    /// @notice Signer rotation: add or remove an issuer (EOA or ERC-1271).
    function setIssuer(address issuer, bool allowed) external onlyOwner {
        if (issuer == address(0)) revert ZeroAddress();
        isIssuer[issuer] = allowed;
        emit IssuerSet(issuer, allowed, msg.sender);
    }

    /// @notice Incident path: guardian can pull a compromised issuer immediately.
    function revokeIssuer(address issuer) external onlyGuardianOrOwner {
        isIssuer[issuer] = false;
        emit IssuerSet(issuer, false, msg.sender);
    }

    function setGasPayer(address gasPayer, bool allowed) external onlyOwner {
        isGasPayer[gasPayer] = allowed;
        emit GasPayerSet(gasPayer, allowed);
    }

    function pause() external onlyGuardianOrOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── Campaigns ─────────────────────────────────────────────────

    function createCampaign(
        bytes32 campaignId,
        IERC20 asset,
        bytes32 policyHash,
        uint64 startsAt,
        uint64 endsAt,
        uint256 perUserCap
    ) external onlyOwner {
        if (address(asset) == address(0)) revert ZeroAddress();
        if (address(campaigns[campaignId].asset) != address(0)) revert CampaignExists();
        if (endsAt <= startsAt) revert InvalidCampaignWindow();
        campaigns[campaignId] = Campaign({
            asset: asset,
            policyHash: policyHash,
            startsAt: startsAt,
            endsAt: endsAt,
            perUserCap: perUserCap,
            funded: 0,
            spent: 0,
            active: true
        });
        emit CampaignCreated(campaignId, address(asset), policyHash, startsAt, endsAt, perUserCap);
    }

    function setCampaignActive(bytes32 campaignId, bool active) external onlyOwner {
        if (address(campaigns[campaignId].asset) == address(0)) revert UnknownCampaign();
        campaigns[campaignId].active = active;
        emit CampaignActiveSet(campaignId, active);
    }

    /// @notice Sponsors pre-fund a campaign; redemptions can never exceed it.
    function fundCampaign(bytes32 campaignId, uint256 amount) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        if (address(c.asset) == address(0)) revert UnknownCampaign();
        uint256 before = c.asset.balanceOf(address(this));
        c.asset.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = c.asset.balanceOf(address(this)) - before;
        c.funded += received;
        emit CampaignFunded(campaignId, msg.sender, received);
    }

    /// @notice Return unspent funds once a campaign is deactivated or ended.
    function withdrawUnspent(bytes32 campaignId, address to) external onlyOwner nonReentrant {
        Campaign storage c = campaigns[campaignId];
        if (address(c.asset) == address(0)) revert UnknownCampaign();
        if (c.active && block.timestamp <= c.endsAt) revert CampaignStillLive();
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = c.funded - c.spent;
        c.funded = c.spent;
        c.asset.safeTransfer(to, amount);
        emit CampaignWithdrawn(campaignId, to, amount);
    }

    function remainingBudget(bytes32 campaignId) external view returns (uint256) {
        Campaign storage c = campaigns[campaignId];
        return c.funded - c.spent;
    }

    // ─── Redemption ────────────────────────────────────────────────

    /// @notice Stable semantic nullifier: one redemption per (campaign, session).
    function nullifierFor(bytes32 campaignId, bytes32 sessionId) public pure returns (bytes32) {
        return keccak256(abi.encode(NULLIFIER_DOMAIN, campaignId, sessionId));
    }

    function receiptDigest(Receipt calldata r) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    RECEIPT_TYPEHASH,
                    r.recipient,
                    r.sessionId,
                    r.classId,
                    r.policyHash,
                    r.campaignId,
                    r.amount,
                    r.issuedAt,
                    r.expiresAt
                )
            )
        );
    }

    /// @notice Redeem a receipt. Callable by the recipient or an allowlisted
    ///         gas payer; funds always go to `r.recipient`.
    function redeem(Receipt calldata r, address issuer, bytes calldata signature)
        external
        whenNotPaused
        nonReentrant
        returns (bytes32 nullifier)
    {
        if (msg.sender != r.recipient && !isGasPayer[msg.sender]) revert GasPayerNotAllowed();
        if (r.recipient == address(0) || r.amount == 0) revert InvalidReceipt();
        if (r.issuedAt > block.timestamp) revert ReceiptNotYetValid();
        if (block.timestamp > r.expiresAt) revert ReceiptExpired();
        if (r.expiresAt - r.issuedAt > maxReceiptLifetime) revert LifetimeTooLong();

        Campaign storage c = campaigns[r.campaignId];
        if (!c.active || block.timestamp < c.startsAt || block.timestamp > c.endsAt) revert CampaignInactive();
        if (r.policyHash != c.policyHash) revert PolicyMismatch();

        if (!isIssuer[issuer]) revert UnauthorizedIssuer();
        if (!SignatureChecker.isValidSignatureNow(issuer, receiptDigest(r), signature)) revert InvalidSignature();

        if (c.funded - c.spent < r.amount) revert CampaignBudgetExceeded();
        uint256 userTotal = redeemedBy[r.campaignId][r.recipient] + r.amount;
        if (userTotal > c.perUserCap) revert UserCapExceeded();

        nullifier = nullifierFor(r.campaignId, r.sessionId);
        registry.consume(nullifier);

        c.spent += r.amount;
        redeemedBy[r.campaignId][r.recipient] = userTotal;
        c.asset.safeTransfer(r.recipient, r.amount);

        emit Redeemed(nullifier, r.campaignId, r.recipient, r.amount, issuer);
    }
}
