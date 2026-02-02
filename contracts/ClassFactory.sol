// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SpinClass} from "./SpinClass.sol";

contract ClassFactory {
    event ClassCreated(
        address indexed instructor,
        address indexed spinClass,
        bytes32 indexed classId,
        uint256 startTime,
        uint256 endTime,
        uint256 maxRiders
    );

    function createClass(
        string calldata name,
        string calldata symbol,
        string calldata classMetadata,
        uint256 startTime,
        uint256 endTime,
        uint256 maxRiders,
        uint256 basePrice,
        uint256 maxPrice,
        address treasury,
        address incentiveEngine
    ) external returns (address spinClass) {
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

        bytes32 classId = keccak256(
            abi.encodePacked(address(instance), msg.sender, startTime, endTime, maxRiders)
        );

        emit ClassCreated(msg.sender, address(instance), classId, startTime, endTime, maxRiders);
        return address(instance);
    }
}
