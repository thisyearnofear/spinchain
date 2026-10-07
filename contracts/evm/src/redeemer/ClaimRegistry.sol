// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title ClaimRegistry
/// @notice Semantic replay registry: one consumption per stable nullifier,
///         shared by every redeemer generation so a new verifier or redeemer
///         deployment is never a clean slate for already-redeemed sessions.
/// @dev Writers are redeemer contracts approved by governance. Revoking a
///      writer never un-consumes its nullifiers.
contract ClaimRegistry is Ownable2Step {
    error NotWriter();
    error AlreadyConsumed();

    mapping(address => bool) public isWriter;
    /// @notice Writer that consumed each nullifier (zero = unconsumed).
    mapping(bytes32 => address) public consumedBy;

    event WriterSet(address indexed writer, bool allowed);
    event Consumed(bytes32 indexed nullifier, address indexed writer);

    constructor(address owner_) Ownable(owner_) {}

    function setWriter(address writer, bool allowed) external onlyOwner {
        isWriter[writer] = allowed;
        emit WriterSet(writer, allowed);
    }

    function isConsumed(bytes32 nullifier) external view returns (bool) {
        return consumedBy[nullifier] != address(0);
    }

    function consume(bytes32 nullifier) external {
        if (!isWriter[msg.sender]) revert NotWriter();
        if (consumedBy[nullifier] != address(0)) revert AlreadyConsumed();
        consumedBy[nullifier] = msg.sender;
        emit Consumed(nullifier, msg.sender);
    }
}
