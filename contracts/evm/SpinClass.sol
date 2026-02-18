// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TieredRewards} from "./TieredRewards.sol";

/// @title SpinClass
/// @notice NFT ticketing with tier discounts (Option B)
/// @dev Enhanced with SPIN holder discounts
/// @custom:security-contact security@spinchain.xyz
contract SpinClass is ERC721, Ownable, ReentrancyGuard, Pausable {
    using TieredRewards for *;

    // ============ Errors ============
    error InvalidTimeRange();
    error InvalidMaxRiders();
    error InvalidPriceRange();
    error SalesClosed();
    error SoldOut();
    error InsufficientPayment();
    error NotTicketOwner();
    error TooEarly();
    error ClassEnded();
    error AlreadyCheckedIn();
    error TreasuryNotSet();
    error TransferFailed();
    error ClassCancelled();
    error ClassNotCancelled();
    error AlreadyRefunded();
    error NotRefundable();
    error TransfersLocked();

    // ============ Structs ============
    struct Pricing {
        uint128 basePrice;
        uint128 maxPrice;
    }
    
    struct TicketInfo {
        uint256 purchasePrice;
        bool refunded;
    }

    // ============ State ============
    string public classMetadata;
    uint256 public startTime;
    uint256 public endTime;
    uint256 public maxRiders;
    Pricing public pricing;
    address public treasury;
    address public incentiveEngine;
    address public spinToken;
    bool public cancelled;

    uint256 public ticketsSold;
    uint256 private nextTokenId = 1;

    mapping(uint256 => bool) public checkedIn;
    mapping(address => bool) public attended;
    mapping(uint256 => TicketInfo) public ticketInfo;

    // ============ Events ============
    event TicketPurchased(address indexed rider, uint256 indexed tokenId, uint256 pricePaid, TieredRewards.Tier tier);
    event CheckedIn(address indexed rider, uint256 indexed tokenId);
    event TreasuryUpdated(address indexed treasury);
    event IncentiveEngineUpdated(address indexed engine);
    event SpinTokenUpdated(address indexed token);
    event RevenueSettled(address indexed treasury, uint256 amount);
    event ClassCancelled(uint256 timestamp);
    event TicketRefunded(address indexed rider, uint256 indexed tokenId, uint256 amount);
    event TransferLocked(uint256 tokenId);
    event InstructorMetadataSet(string key, string value);
    event TierDiscountApplied(address indexed rider, TieredRewards.Tier tier, uint256 originalPrice, uint256 discountedPrice);

    constructor(
        address owner_,
        string memory name_,
        string memory symbol_,
        string memory classMetadata_,
        uint256 startTime_,
        uint256 endTime_,
        uint256 maxRiders_,
        uint256 basePrice_,
        uint256 maxPrice_,
        address treasury_,
        address incentiveEngine_,
        address spinToken_
    ) ERC721(name_, symbol_) Ownable(owner_) {
        if (startTime_ >= endTime_) revert InvalidTimeRange();
        if (maxRiders_ == 0) revert InvalidMaxRiders();
        if (maxPrice_ < basePrice_) revert InvalidPriceRange();
        classMetadata = classMetadata_;
        startTime = startTime_;
        endTime = endTime_;
        maxRiders = maxRiders_;
        pricing = Pricing({basePrice: uint128(basePrice_), maxPrice: uint128(maxPrice_)});
        treasury = treasury_;
        incentiveEngine = incentiveEngine_;
        spinToken = spinToken_;
    }

    /// @notice Calculate current ticket price using exponential bonding curve
    /// @dev Price increases faster as capacity fills
    function currentPrice() public view returns (uint256) {
        if (ticketsSold >= maxRiders) {
            return pricing.maxPrice;
        }
        uint256 spread = pricing.maxPrice - pricing.basePrice;
        if (spread == 0) {
            return pricing.basePrice;
        }
        // Exponential: price increases faster as capacity fills
        uint256 progress = (ticketsSold * 1e18) / maxRiders;
        uint256 exponentialProgress = (progress * progress) / 1e18;
        uint256 variablePart = (spread * exponentialProgress) / 1e18;
        return pricing.basePrice + variablePart;
    }

    /// @notice Calculate price with tier discount for a specific user
    function priceForUser(address user) public view returns (uint256 basePrice, uint256 discountedPrice, TieredRewards.Tier tier) {
        basePrice = currentPrice();
        tier = TieredRewards.getTier(IERC20(spinToken).balanceOf(user));
        discountedPrice = TieredRewards.applyDiscount(basePrice, tier);
        return (basePrice, discountedPrice, tier);
    }

    function purchaseTicket() external payable nonReentrant whenNotPaused returns (uint256 tokenId) {
        if (block.timestamp >= startTime) revert SalesClosed();
        if (ticketsSold >= maxRiders) revert SoldOut();
        if (cancelled) revert ClassCancelled();
        
        (uint256 basePrice, uint256 discountedPrice, TieredRewards.Tier tier) = priceForUser(msg.sender);
        if (msg.value < discountedPrice) revert InsufficientPayment();

        tokenId = nextTokenId;
        nextTokenId++;
        ticketsSold++;

        _safeMint(msg.sender, tokenId);
        
        // Store purchase price for refunds (use discounted price)
        ticketInfo[tokenId] = TicketInfo({
            purchasePrice: discountedPrice,
            refunded: false
        });

        // Refund excess — use call() not transfer() to support smart contract wallets
        if (msg.value > discountedPrice) {
            unchecked {
                uint256 refund = msg.value - discountedPrice;
                (bool ok, ) = payable(msg.sender).call{value: refund}("");
                if (!ok) revert TransferFailed();
            }
        }

        emit TicketPurchased(msg.sender, tokenId, discountedPrice, tier);
        if (tier != TieredRewards.Tier.NONE) {
            emit TierDiscountApplied(msg.sender, tier, basePrice, discountedPrice);
        }
    }

    function checkIn(uint256 tokenId) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTicketOwner();
        if (block.timestamp < startTime) revert TooEarly();
        if (block.timestamp > endTime) revert ClassEnded();
        if (checkedIn[tokenId]) revert AlreadyCheckedIn();
        if (ticketInfo[tokenId].refunded) revert NotRefundable();
        
        checkedIn[tokenId] = true;
        attended[msg.sender] = true;
        emit CheckedIn(msg.sender, tokenId);
    }

    function hasAttended(address rider) external view returns (bool) {
        return attended[rider];
    }

    function setTreasury(address treasury_) external onlyOwner {
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setIncentiveEngine(address engine_) external onlyOwner {
        incentiveEngine = engine_;
        emit IncentiveEngineUpdated(engine_);
    }

    function setSpinToken(address token_) external onlyOwner {
        spinToken = token_;
        emit SpinTokenUpdated(token_);
    }

    function settleRevenue() external nonReentrant onlyOwner {
        if (treasury == address(0)) revert TreasuryNotSet();
        uint256 amount = address(this).balance;
        if (amount == 0) return;
        
        (bool ok, ) = treasury.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit RevenueSettled(treasury, amount);
    }

    // ============ Cancellation & Refunds ============

    /// @notice Cancel the class and enable refunds
    function cancelClass() external onlyOwner {
        if (block.timestamp >= startTime) revert ClassEnded();
        cancelled = true;
        emit ClassCancelled(block.timestamp);
    }

    /// @notice Claim refund for a cancelled class
    function claimRefund(uint256 tokenId) external nonReentrant {
        if (!cancelled) revert ClassNotCancelled();
        if (ownerOf(tokenId) != msg.sender) revert NotTicketOwner();
        
        TicketInfo storage info = ticketInfo[tokenId];
        if (info.refunded) revert AlreadyRefunded();
        
        uint256 refundAmount = info.purchasePrice;
        info.refunded = true;
        
        _burn(tokenId);
        ticketsSold--;
        
        (bool ok, ) = payable(msg.sender).call{value: refundAmount}("");
        if (!ok) revert TransferFailed();
        
        emit TicketRefunded(msg.sender, tokenId, refundAmount);
    }

    // ============ Admin ============

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Set instructor metadata (ENS, avatar, etc.) - emits event for indexing
    function setMetadata(string calldata key, string calldata value) external onlyOwner {
        emit InstructorMetadataSet(key, value);
    }

    // ============ Hooks ============

    /// @notice Prevent transfers after class starts (anti-scalping)
    /// @dev Uses OZ v5 _update hook — replaces deprecated _beforeTokenTransfer
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Only restrict live transfers (not mints where from==0, nor burns where to==0)
        if (from != address(0) && to != address(0)) {
            if (block.timestamp >= startTime) revert TransfersLocked();
        }
        
        return super._update(to, tokenId, auth);
    }
}
