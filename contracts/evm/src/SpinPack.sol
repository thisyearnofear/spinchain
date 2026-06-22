// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SpinPack
/// @notice ERC-1155 multi-token for route IP (Token ID 0) and access tickets (Token ID 1..N)
/// @dev Designed for the SpinChain "Agentic Finance" layer where an AI agent manages liquidity
///      via a Uniswap v4 pool with the DemandSurgeHook.
/// @custom:security-contact security@spinchain.xyz
contract SpinPack is ERC1155, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @dev Token ID 0 is the Master NFT representing route IP ownership
    uint256 public constant MASTER_TOKEN_ID = 0;

    // ============ Errors ============

    error InvalidTokenId();
    error InvalidAmount();
    error NotMasterOwner();
    error InvalidCapacity();
    error SoldOut();
    error InsufficientPayment();
    error AlreadyRedeemed();
    error ClassNotActive();

    // ============ Structs ============

    struct PackState {
        uint128 capacity;
        uint128 sold;
        uint256 startTime;
        uint256 pricePerTicket;
        address paymentToken;
        bool active;
    }

    // ============ State ============

    /// @dev Pack state indexed by token ID (1..N are ticket tokens)
    mapping(uint256 => PackState) public packs;

    /// @dev Track which tickets have been redeemed (address => tokenId => redeemed)
    mapping(address => mapping(uint256 => bool)) public redeemed;

    /// @dev Master token owner (route IP holder)
    address public masterOwner;

    /// @dev Revenue recipient (instructor or agent)
    address public revenueRecipient;

    // ============ Events ============

    event PackCreated(uint256 indexed tokenId, uint128 capacity, uint256 pricePerTicket, address paymentToken);
    event TicketPurchased(uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 totalPrice);
    event TicketRedeemed(uint256 indexed tokenId, address indexed rider);
    event RevenueRecipientUpdated(address indexed recipient);

    // ============ Constructor ============

    constructor(
        string memory uri_,
        address _revenueRecipient
    ) ERC1155(uri_) Ownable(msg.sender) {
        revenueRecipient = _revenueRecipient;
    }

    // ============ Admin ============

    function setURI(string memory newuri) external onlyOwner {
        _setURI(newuri);
    }

    function setRevenueRecipient(address recipient) external onlyOwner {
        revenueRecipient = recipient;
        emit RevenueRecipientUpdated(recipient);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Pack Management ============

    /// @notice Create a new SpinPack with a master NFT (Token ID 0) and ticket tokens
    /// @dev Mints Token ID 0 (Master NFT) to the caller, sets up ticket token pack
    /// @param tokenId The ticket token ID (must be > 0)
    /// @param capacity Maximum number of tickets
    /// @param pricePerTicket Price per ticket in paymentToken
    /// @param paymentToken ERC-20 token used for payment (address(0) = native)
    /// @param startTime When the class starts (unix timestamp)
    function createPack(
        uint256 tokenId,
        uint128 capacity,
        uint256 pricePerTicket,
        address paymentToken,
        uint256 startTime
    ) external onlyOwner {
        if (tokenId == MASTER_TOKEN_ID) revert InvalidTokenId();
        if (capacity == 0) revert InvalidCapacity();

        // Mint master NFT (Token ID 0) to caller if not already minted
        if (balanceOf(msg.sender, MASTER_TOKEN_ID) == 0) {
            _mint(msg.sender, MASTER_TOKEN_ID, 1, "");
            masterOwner = msg.sender;
        }

        packs[tokenId] = PackState({
            capacity: capacity,
            sold: 0,
            startTime: startTime,
            pricePerTicket: pricePerTicket,
            paymentToken: paymentToken,
            active: true
        });

        emit PackCreated(tokenId, capacity, pricePerTicket, paymentToken);
    }

    /// @notice Update pack parameters (only master owner or contract owner)
    function updatePack(
        uint256 tokenId,
        uint128 capacity,
        uint256 pricePerTicket,
        bool active
    ) external {
        if (tokenId == MASTER_TOKEN_ID) revert InvalidTokenId();
        if (msg.sender != owner() && msg.sender != masterOwner) revert NotMasterOwner();

        PackState storage pack = packs[tokenId];
        if (capacity < pack.sold) revert InvalidCapacity();

        pack.capacity = capacity;
        pack.pricePerTicket = pricePerTicket;
        pack.active = active;
    }

    // ============ Ticket Sales ============

    /// @notice Purchase tickets for a pack
    /// @param tokenId The ticket token ID (must be > 0)
    /// @param amount Number of tickets to purchase
    function purchaseTickets(
        uint256 tokenId,
        uint256 amount
    ) external payable whenNotPaused {
        if (tokenId == MASTER_TOKEN_ID) revert InvalidTokenId();
        if (amount == 0) revert InvalidAmount();

        PackState storage pack = packs[tokenId];
        if (!pack.active) revert ClassNotActive();
        if (pack.sold + uint128(amount) > pack.capacity) revert SoldOut();

        uint256 totalPrice = pack.pricePerTicket * amount;

        // Handle payment
        if (pack.paymentToken == address(0)) {
            if (msg.value < totalPrice) revert InsufficientPayment();
            // Forward native payment to revenue recipient
            (bool success, ) = revenueRecipient.call{value: totalPrice}("");
            require(success, "Payment transfer failed");
            // Refund excess
            if (msg.value > totalPrice) {
                (bool refundOk, ) = msg.sender.call{value: msg.value - totalPrice}("");
                require(refundOk, "Refund failed");
            }
        } else {
            IERC20(pack.paymentToken).safeTransferFrom(msg.sender, revenueRecipient, totalPrice);
        }

        // Mint tickets to buyer
        pack.sold += uint128(amount);
        _mint(msg.sender, tokenId, amount, "");

        emit TicketPurchased(tokenId, msg.sender, amount, totalPrice);
    }

    // ============ Redemption ============

    /// @notice Redeem a ticket to check into a class
    /// @param tokenId The ticket token ID
    function redeemTicket(uint256 tokenId) external whenNotPaused {
        if (tokenId == MASTER_TOKEN_ID) revert InvalidTokenId();
        if (balanceOf(msg.sender, tokenId) == 0) revert InvalidTokenId();
        if (redeemed[msg.sender][tokenId]) revert AlreadyRedeemed();

        redeemed[msg.sender][tokenId] = true;
        // Burn the ticket after redemption
        _burn(msg.sender, tokenId, 1);

        emit TicketRedeemed(tokenId, msg.sender);
    }

    // ============ Views ============

    /// @notice Get pack utilization (sold / capacity) in basis points
    function getUtilization(uint256 tokenId) external view returns (uint256) {
        PackState memory pack = packs[tokenId];
        if (pack.capacity == 0) return 0;
        return (uint256(pack.sold) * 10000) / uint256(pack.capacity);
    }

    /// @notice Get remaining tickets for a pack
    function getRemainingTickets(uint256 tokenId) external view returns (uint256) {
        PackState memory pack = packs[tokenId];
        return uint256(pack.capacity) - uint256(pack.sold);
    }

    /// @notice Check if an address has redeemed their ticket for a pack
    function hasRedeemed(address rider, uint256 tokenId) external view returns (bool) {
        return redeemed[rider][tokenId];
    }

    // ============ Overrides ============

    function uri(uint256 tokenId) public view override returns (string memory) {
        if (tokenId == MASTER_TOKEN_ID) {
            return string(abi.encodePacked(super.uri(tokenId), "master"));
        }
        return string(abi.encodePacked(super.uri(tokenId), "ticket"));
    }
}
