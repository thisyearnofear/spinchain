// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SpinClass is ERC721, Ownable, ReentrancyGuard {
    struct Pricing {
        uint256 basePrice;
        uint256 maxPrice;
    }

    string public classMetadata;
    uint256 public startTime;
    uint256 public endTime;
    uint256 public maxRiders;
    Pricing public pricing;
    address public treasury;
    address public incentiveEngine;

    uint256 public ticketsSold;
    uint256 private nextTokenId = 1;

    mapping(uint256 => bool) public checkedIn;
    mapping(address => bool) public attended;

    event TicketPurchased(address indexed rider, uint256 indexed tokenId, uint256 pricePaid);
    event CheckedIn(address indexed rider, uint256 indexed tokenId);
    event TreasuryUpdated(address indexed treasury);
    event IncentiveEngineUpdated(address indexed engine);
    event RevenueSettled(address indexed treasury, uint256 amount);

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
        require(startTime_ < endTime_, "invalid time");
        require(maxRiders_ > 0, "max riders");
        require(maxPrice_ >= basePrice_, "price range");
        classMetadata = classMetadata_;
        startTime = startTime_;
        endTime = endTime_;
        maxRiders = maxRiders_;
        pricing = Pricing({basePrice: basePrice_, maxPrice: maxPrice_});
        treasury = treasury_;
        incentiveEngine = incentiveEngine_;
    }

    function currentPrice() public view returns (uint256) {
        if (ticketsSold >= maxRiders) {
            return pricing.maxPrice;
        }
        uint256 spread = pricing.maxPrice - pricing.basePrice;
        if (spread == 0) {
            return pricing.basePrice;
        }
        uint256 variablePart = (spread * ticketsSold) / maxRiders;
        return pricing.basePrice + variablePart;
    }

    function purchaseTicket() external payable nonReentrant returns (uint256 tokenId) {
        require(block.timestamp < startTime, "sales closed");
        require(ticketsSold < maxRiders, "sold out");
        uint256 price = currentPrice();
        require(msg.value >= price, "insufficient payment");

        tokenId = nextTokenId;
        nextTokenId += 1;
        ticketsSold += 1;

        _safeMint(msg.sender, tokenId);

        if (msg.value > price) {
            unchecked {
                payable(msg.sender).transfer(msg.value - price);
            }
        }

        emit TicketPurchased(msg.sender, tokenId, price);
    }

    function checkIn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "not ticket owner");
        require(block.timestamp >= startTime, "too early");
        require(block.timestamp <= endTime, "class ended");
        require(!checkedIn[tokenId], "already checked in");
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

    function settleRevenue() external nonReentrant {
        require(treasury != address(0), "treasury not set");
        uint256 amount = address(this).balance;
        require(amount > 0, "no balance");
        (bool ok, ) = treasury.call{value: amount}("");
        require(ok, "transfer failed");
        emit RevenueSettled(treasury, amount);
    }
}
