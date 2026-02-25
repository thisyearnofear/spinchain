// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {TieredRewards} from "./TieredRewards.sol";

/// @title SpinClass
/// @notice NFT ticketing with stablecoin payments and instructor revenue splits
/// @dev Supports both human and AI agent instructors with 70-90% revenue share
/// @custom:security-contact security@spinchain.xyz
contract SpinClass is ERC721, Ownable, ReentrancyGuard, Pausable {
    using TieredRewards for *;
    using SafeERC20 for IERC20;

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
    error InvalidPaymentToken();
    error InvalidInstructorShare();
    error UnsupportedPaymentMethod();

    // ============ Structs ============
    struct Pricing {
        uint128 basePrice;
        uint128 maxPrice;
    }
    
    struct TicketInfo {
        uint256 purchasePrice;
        bool refunded;
        bool paidInStable; // Track payment method for refunds
    }

    // ============ State ============
    string public classMetadata;
    uint256 public startTime;
    uint256 public endTime;
    uint256 public maxRiders;
    Pricing public pricing;
    address public instructor; // Human or AI agent wallet
    address public treasury; // Protocol treasury (5-10% fee)
    address public incentiveEngine;
    address public spinToken;
    bool public cancelled;
    
    // Stablecoin payment support
    IERC20 public paymentToken; // USDT/USDC address (address(0) = native AVAX)
    uint16 public instructorShareBps; // Instructor revenue share in basis points (7000-9000 = 70-90%)
    uint256 public instructorBalance; // Accumulated instructor revenue
    uint256 public protocolBalance; // Accumulated protocol fees

    uint256 public ticketsSold;
    uint256 private nextTokenId = 1;

    mapping(uint256 => bool) public checkedIn;
    mapping(address => bool) public attended;
    mapping(uint256 => TicketInfo) public ticketInfo;

    // ============ Events ============
    event TicketPurchased(address indexed rider, uint256 indexed tokenId, uint256 pricePaid, TieredRewards.Tier tier, bool paidInStable);
    event CheckedIn(address indexed rider, uint256 indexed tokenId);
    event TreasuryUpdated(address indexed treasury);
    event IncentiveEngineUpdated(address indexed engine);
    event SpinTokenUpdated(address indexed token);
    event RevenueSettled(address indexed treasury, uint256 amount);
    event ClassCancelled(uint256 timestamp);
    event TicketRefunded(address indexed rider, uint256 indexed tokenId, uint256 amount, bool inStable);
    event TransferLocked(uint256 tokenId);
    event InstructorMetadataSet(string key, string value);
    event TierDiscountApplied(address indexed rider, TieredRewards.Tier tier, uint256 originalPrice, uint256 discountedPrice);
    event InstructorPaid(address indexed instructor, uint256 amount, bool inStable);
    event ProtocolFeePaid(address indexed treasury, uint256 amount, bool inStable);
    event PaymentTokenUpdated(address indexed token);
    event InstructorShareUpdated(uint16 shareBps);

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
        address instructor_,
        address treasury_,
        address incentiveEngine_,
        address spinToken_,
        address paymentToken_,
        uint16 instructorShareBps_
    ) ERC721(name_, symbol_) Ownable(owner_) {
        if (startTime_ >= endTime_) revert InvalidTimeRange();
        if (maxRiders_ == 0) revert InvalidMaxRiders();
        if (maxPrice_ < basePrice_) revert InvalidPriceRange();
        if (instructorShareBps_ < 7000 || instructorShareBps_ > 9000) revert InvalidInstructorShare();
        
        classMetadata = classMetadata_;
        startTime = startTime_;
        endTime = endTime_;
        maxRiders = maxRiders_;
        pricing = Pricing({basePrice: uint128(basePrice_), maxPrice: uint128(maxPrice_)});
        instructor = instructor_;
        treasury = treasury_;
        incentiveEngine = incentiveEngine_;
        spinToken = spinToken_;
        paymentToken = IERC20(paymentToken_); // address(0) = native AVAX
        instructorShareBps = instructorShareBps_;
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

    /// @notice Purchase ticket with native AVAX (legacy support)
    function purchaseTicket() external payable nonReentrant whenNotPaused returns (uint256 tokenId) {
        if (address(paymentToken) != address(0)) revert UnsupportedPaymentMethod();
        return _purchaseTicket(msg.sender, false);
    }

    /// @notice Purchase ticket with stablecoin (USDT/USDC)
    /// @param amount Amount of stablecoin to pay (must be >= discounted price)
    function purchaseTicketStable(uint256 amount) external nonReentrant whenNotPaused returns (uint256 tokenId) {
        if (address(paymentToken) == address(0)) revert InvalidPaymentToken();
        
        (uint256 basePrice, uint256 discountedPrice, TieredRewards.Tier tier) = priceForUser(msg.sender);
        if (amount < discountedPrice) revert InsufficientPayment();
        
        // Transfer stablecoin from buyer
        paymentToken.safeTransferFrom(msg.sender, address(this), discountedPrice);
        
        // Split revenue: instructor share + protocol fee
        uint256 instructorAmount = (discountedPrice * instructorShareBps) / 10_000;
        uint256 protocolAmount = discountedPrice - instructorAmount;
        
        instructorBalance += instructorAmount;
        protocolBalance += protocolAmount;
        
        tokenId = nextTokenId;
        nextTokenId++;
        ticketsSold++;

        _safeMint(msg.sender, tokenId);
        
        ticketInfo[tokenId] = TicketInfo({
            purchasePrice: discountedPrice,
            refunded: false,
            paidInStable: true
        });

        emit TicketPurchased(msg.sender, tokenId, discountedPrice, tier, true);
        if (tier != TieredRewards.Tier.NONE) {
            emit TierDiscountApplied(msg.sender, tier, basePrice, discountedPrice);
        }
    }

    /// @notice Internal ticket purchase logic for native AVAX
    function _purchaseTicket(address buyer, bool isStable) internal returns (uint256 tokenId) {
        if (block.timestamp >= startTime) revert SalesClosed();
        if (ticketsSold >= maxRiders) revert SoldOut();
        if (cancelled) revert ClassCancelled();
        
        (uint256 basePrice, uint256 discountedPrice, TieredRewards.Tier tier) = priceForUser(buyer);
        if (msg.value < discountedPrice) revert InsufficientPayment();

        // Split revenue: instructor share + protocol fee
        uint256 instructorAmount = (discountedPrice * instructorShareBps) / 10_000;
        uint256 protocolAmount = discountedPrice - instructorAmount;
        
        instructorBalance += instructorAmount;
        protocolBalance += protocolAmount;

        tokenId = nextTokenId;
        nextTokenId++;
        ticketsSold++;

        _safeMint(buyer, tokenId);
        
        ticketInfo[tokenId] = TicketInfo({
            purchasePrice: discountedPrice,
            refunded: false,
            paidInStable: isStable
        });

        // Refund excess AVAX
        if (msg.value > discountedPrice) {
            unchecked {
                uint256 refund = msg.value - discountedPrice;
                (bool ok, ) = payable(buyer).call{value: refund}("");
                if (!ok) revert TransferFailed();
            }
        }

        emit TicketPurchased(buyer, tokenId, discountedPrice, tier, isStable);
        if (tier != TieredRewards.Tier.NONE) {
            emit TierDiscountApplied(buyer, tier, basePrice, discountedPrice);
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

    /// @notice Instructor (human or AI agent) withdraws their revenue share
    function withdrawInstructorRevenue() external nonReentrant {
        uint256 amount = instructorBalance;
        if (amount == 0) return;
        
        instructorBalance = 0;
        
        if (address(paymentToken) != address(0)) {
            // Stablecoin payment
            paymentToken.safeTransfer(instructor, amount);
            emit InstructorPaid(instructor, amount, true);
        } else {
            // Native AVAX payment
            (bool ok, ) = payable(instructor).call{value: amount}("");
            if (!ok) revert TransferFailed();
            emit InstructorPaid(instructor, amount, false);
        }
    }

    /// @notice Protocol withdraws fee share to treasury
    function withdrawProtocolFees() external nonReentrant onlyOwner {
        if (treasury == address(0)) revert TreasuryNotSet();
        uint256 amount = protocolBalance;
        if (amount == 0) return;
        
        protocolBalance = 0;
        
        if (address(paymentToken) != address(0)) {
            // Stablecoin payment
            paymentToken.safeTransfer(treasury, amount);
            emit ProtocolFeePaid(treasury, amount, true);
        } else {
            // Native AVAX payment
            (bool ok, ) = treasury.call{value: amount}("");
            if (!ok) revert TransferFailed();
            emit ProtocolFeePaid(treasury, amount, false);
        }
    }

    /// @notice Legacy revenue settlement (deprecated - use withdrawInstructorRevenue + withdrawProtocolFees)
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
        bool isStable = info.paidInStable;
        info.refunded = true;
        
        _burn(tokenId);
        ticketsSold--;
        
        if (isStable) {
            // Refund in stablecoin
            paymentToken.safeTransfer(msg.sender, refundAmount);
        } else {
            // Refund in native AVAX
            (bool ok, ) = payable(msg.sender).call{value: refundAmount}("");
            if (!ok) revert TransferFailed();
        }
        
        emit TicketRefunded(msg.sender, tokenId, refundAmount, isStable);
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

    /// @notice Update payment token (owner only, before sales start)
    function setPaymentToken(address token_) external onlyOwner {
        if (ticketsSold > 0) revert SalesClosed();
        paymentToken = IERC20(token_);
        emit PaymentTokenUpdated(token_);
    }

    /// @notice Update instructor revenue share (owner only, before sales start)
    function setInstructorShare(uint16 shareBps_) external onlyOwner {
        if (ticketsSold > 0) revert SalesClosed();
        if (shareBps_ < 7000 || shareBps_ > 9000) revert InvalidInstructorShare();
        instructorShareBps = shareBps_;
        emit InstructorShareUpdated(shareBps_);
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
