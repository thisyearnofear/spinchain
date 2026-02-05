// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @custom:security-contact security@spinchain.xyz
contract SpinClass is ERC721, Ownable, ReentrancyGuard, Pausable {
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
    bool public cancelled;

    uint256 public ticketsSold;
    uint256 private nextTokenId = 1;

    mapping(uint256 => bool) public checkedIn;
    mapping(address => bool) public attended;
    mapping(uint256 => TicketInfo) public ticketInfo;

    // ============ Events ============
    event TicketPurchased(address indexed rider, uint256 indexed tokenId, uint256 pricePaid);
    event CheckedIn(address indexed rider, uint256 indexed tokenId);
    event TreasuryUpdated(address indexed treasury);
    event IncentiveEngineUpdated(address indexed engine);
    event RevenueSettled(address indexed treasury, uint256 amount);
    event ClassCancelled(uint256 timestamp);
    event TicketRefunded(address indexed rider, uint256 indexed tokenId, uint256 amount);
    event TransferLocked(uint256 tokenId);
    event InstructorMetadataSet(string key, string value);

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
        address incentiveEngine_
    ) ERC721(name_, symbol_) Ownable(owner_) {
        if (startTime_ >= endTime_) revert InvalidTimeRange();
        if (maxRiders_ == 0) revert InvalidMaxRiders();
        if (maxPrice_ < basePrice_) revert InvalidPriceRange();
        classMetadata = classMetadata_;
        startTime = startTime_;
        endTime = endTime_;
        maxRiders = maxRiders_;
        pricing = Pricing({basePrice: basePrice_, maxPrice: maxPrice_});
        treasury = treasury_;
        incentiveEngine = incentiveEngine_;
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

    function purchaseTicket() external payable nonReentrant whenNotPaused returns (uint256 tokenId) {
        if (block.timestamp >= startTime) revert SalesClosed();
        if (ticketsSold >= maxRiders) revert SoldOut();
        if (cancelled) revert ClassCancelled(); // Can't buy if cancelled
        
        uint256 price = currentPrice();
        if (msg.value < price) revert InsufficientPayment();

        tokenId = nextTokenId;
        nextTokenId++;
        ticketsSold++;

        _safeMint(msg.sender, tokenId);
        
        // Store purchase price for refunds
        ticketInfo[tokenId] = TicketInfo({
            purchasePrice: price,
            refunded: false
        });

        if (msg.value > price) {
            unchecked {
                payable(msg.sender).transfer(msg.value - price);
            }
        }

        emit TicketPurchased(msg.sender, tokenId, price);
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

    /// @notice Prevent transfers after class starts (optional anti-scalping)
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal override {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        
        // Only check transfers (not mints/burns)
        if (from != address(0) && to != address(0)) {
            // Allow transfers only before class starts
            if (block.timestamp >= startTime) revert TransfersLocked();
        }
    }
}
