// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @custom:security-contact security@spinchain.xyz
contract SpinToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    // ============ Errors ============
    error InvalidAmount();
    error ZeroAddress();

    // ============ Events ============
    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);

    constructor(address owner_) 
        ERC20("SpinToken", "SPIN") 
        Ownable(owner_)
        ERC20Permit("SpinToken") 
    {}

    /// @notice Mint new SPIN tokens (only owner - IncentiveEngine)
    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        _mint(to, amount);
        emit Minted(to, amount);
    }

    /// @notice Burn tokens (any holder can burn their own)
    function burn(uint256 amount) public override {
        super.burn(amount);
        emit Burned(msg.sender, amount);
    }

    /// @notice Burn tokens from an approved address
    function burnFrom(address account, uint256 amount) public override {
        super.burnFrom(account, amount);
        emit Burned(account, amount);
    }
}
