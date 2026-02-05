// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SpinClass} from "./SpinClass.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @custom:security-contact security@spinchain.xyz
contract ClassFactory is Ownable {
    // ============ Errors ============
    error InvalidTimeRange();
    error InvalidMaxRiders();
    error InvalidPriceRange();
    error ZeroTreasury();
    error ClassNotFound();

    // ============ State ============
    mapping(address => bool) public isSpinClass;
    mapping(bytes32 => address) public classById;
    mapping(address => address[]) public classesByInstructor;
    address[] public allClasses;
    
    // ============ Events ============
    event ClassCreated(
        address indexed instructor,
        address indexed spinClass,
        bytes32 indexed classId,
        uint256 startTime,
        uint256 endTime,
        uint256 maxRiders
    );

    constructor() Ownable(msg.sender) {}

    /// @notice Create a new SpinClass with validation
    function createClass(
        string calldata name,
        string calldata symbol,
        string calldata classMetadata,
        uint256 startTime,
        uint256 endTime,
        uint256 maxRiders,
        uint128 basePrice,
        uint128 maxPrice,
        address treasury,
        address incentiveEngine
    ) external returns (address spinClass) {
        // Input validation
        if (startTime >= endTime) revert InvalidTimeRange();
        if (maxRiders == 0) revert InvalidMaxRiders();
        if (maxPrice < basePrice) revert InvalidPriceRange();
        if (treasury == address(0)) revert ZeroTreasury();

        SpinClass instance = new SpinClass(
            msg.sender,
            name,
            symbol,
            classMetadata,
            startTime,
            endTime,
            maxRiders,
            basePrice,
            maxPrice,
            treasury,
            incentiveEngine
        );

        spinClass = address(instance);
        bytes32 classId = keccak256(
            abi.encodePacked(spinClass, msg.sender, startTime, endTime, maxRiders)
        );

        // Register the class
        isSpinClass[spinClass] = true;
        classById[classId] = spinClass;
        classesByInstructor[msg.sender].push(spinClass);
        allClasses.push(spinClass);

        emit ClassCreated(msg.sender, spinClass, classId, startTime, endTime, maxRiders);
    }

    // ============ View Functions ============

    /// @notice Get all classes created by an instructor
    function getClassesByInstructor(address instructor) external view returns (address[] memory) {
        return classesByInstructor[instructor];
    }

    /// @notice Get total number of classes created
    function getClassCount() external view returns (uint256) {
        return allClasses.length;
    }

    /// @notice Get paginated list of all classes
    function getClasses(uint256 offset, uint256 limit) external view returns (address[] memory) {
        uint256 end = offset + limit;
        if (end > allClasses.length) end = allClasses.length;
        if (offset >= allClasses.length) return new address[](0);
        
        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allClasses[i];
        }
        return result;
    }

    /// @notice Verify if an address is a legitimate SpinClass
    function verifyClass(address classAddress) external view returns (bool) {
        return isSpinClass[classAddress];
    }
}
