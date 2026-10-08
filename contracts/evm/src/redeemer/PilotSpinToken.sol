// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title PilotSpinToken — phase-5 testnet pilot asset.
/// @notice Fixed-supply ERC20 minted once to the deployer at construction.
///         Used when PILOT_ASSET is unset so the pilot never depends on the
///         legacy SpinToken (whose mint is locked to the IncentiveEngine).
///         No value; Fuji only.
contract PilotSpinToken is ERC20 {
    constructor(uint256 supply) ERC20("SpinChain Pilot SPIN", "PSPIN") {
        _mint(msg.sender, supply);
    }
}
