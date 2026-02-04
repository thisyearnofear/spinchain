// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/BaseHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {BeforeSwapParams, AfterSwapParams} from "v4-core/interfaces/IHooks.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";

/// @title DemandSurgeHook
/// @notice A Uniswap v4 Hook that adjusts swap fees based on class inventory and time-to-start.
/// @dev Designed for the SpinChain "Agentic Finance" layer where an AI agent manages liquidity.
contract DemandSurgeHook is BaseHook {
    using CurrencyLibrary for Currency;

    // --- State ---

    struct ClassState {
        uint256 totalTickets;
        uint256 ticketsSold;
        uint256 startTime;
    }

    // Mapping from Ticket Token (Currency) to Class Metadata
    mapping(Currency => ClassState) public classStates;

    address public agent; // The AI Agent (Coach Atlas) allowed to update state

    // --- Errors ---
    error NotAgent();
    error ClassNotFound();

    // --- Modifiers ---
    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(IPoolManager _poolManager, address _agent) BaseHook(_poolManager) {
        agent = _agent;
    }

    // --- Permissions ---

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true, // Key for dynamic pricing
            afterSwap: true,  // For rebates/logging
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // --- Agent Interface ---

    /// @notice Updates the inventory state of a class associated with a specific currency.
    /// @dev The Agent (Coach Atlas) calls this based on off-chain indexing of the SpinClass ERC721.
    function updateClassState(
        Currency currency,
        uint256 totalTickets,
        uint256 ticketsSold,
        uint256 startTime
    ) external onlyAgent {
        classStates[currency] = ClassState({
            totalTickets: totalTickets,
            ticketsSold: ticketsSold,
            startTime: startTime
        });
    }

    // --- Hook Logic ---

    function beforeSwap(
        address,
        PoolKey calldata key,
        BeforeSwapParams calldata,
        bytes calldata
    ) external view override returns (bytes4, BeforeSwapDelta, uint24) {
        // 1. Identify Class State from Currency (Ticketing Token)
        // We assume the ticket token is one of the currencies in the pool.
        ClassState memory state = classStates[key.currency1];
        if (state.totalTickets == 0) {
            state = classStates[key.currency0];
        }

        // If no class state found, return 0 to use the Pool's static fee (or 0 override if intended)
        if (state.totalTickets == 0) {
             return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        // 2. Calculate Metrics
        uint256 utilization = (state.ticketsSold * 100) / state.totalTickets;

        uint256 timeRemaining = 0;
        if (state.startTime > block.timestamp) {
            timeRemaining = state.startTime - block.timestamp;
        }

        // 3. Determine Dynamic Fee (in pips: 10000 = 1%)
        // Standard Fee base
        uint24 fee = 3000; // 0.30%

        if (utilization > 95) {
            // EXTREME SCARCITY: Last tickets
            fee = 50000; // 5.00%
        } else if (utilization > 80 && timeRemaining < 2 hours) {
            // SURGE: High demand + Imminent start
            fee = 10000; // 1.00%
        } else if (utilization < 30 && timeRemaining < 24 hours) {
             // FIRE SALE: Low demand + Imminent start
             fee = 500; // 0.05%
        }

        // Return with fee override
        // Note: The pool must be initialized with the dynamic fee capability for this to take effect.
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee);
    }

    function afterSwap(
        address,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) external override returns (bytes4, int128) {
        // Future Logic: Check for Membership NFT and issue rebate if applicable
        return (BaseHook.afterSwap.selector, 0);
    }
}
