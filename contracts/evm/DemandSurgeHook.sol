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
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title DemandSurgeHook
/// @notice A Uniswap v4 Hook that adjusts swap fees based on class inventory and time-to-start.
/// @dev Designed for the SpinChain "Agentic Finance" layer where an AI agent manages liquidity.
/// @custom:security-contact security@spinchain.xyz
contract DemandSurgeHook is BaseHook, Ownable {
    using CurrencyLibrary for Currency;

    // ============ Errors ============
    error NotAgent();
    error ClassNotFound();
    error InvalidTimeRange();
    error InvalidCapacity();

    // ============ Structs ============
    struct ClassState {
        uint128 totalTickets;
        uint128 ticketsSold;
        uint256 startTime;
    }

    // ============ State ============
    mapping(Currency => ClassState) public classStates;
    mapping(address => bool) public authorizedAgents;
    address public defaultAgent;

    // ============ Events ============
    event ClassStateUpdated(Currency indexed currency, uint128 totalTickets, uint128 ticketsSold, uint256 startTime);
    event AgentUpdated(address indexed agent, bool authorized);
    event DefaultAgentUpdated(address indexed agent);

    // ============ Modifiers ============
    modifier onlyAgent() {
        if (!authorizedAgents[msg.sender] && msg.sender != defaultAgent) revert NotAgent();
        _;
    }

    constructor(IPoolManager _poolManager, address _agent) BaseHook(_poolManager) Ownable(msg.sender) {
        defaultAgent = _agent;
        authorizedAgents[_agent] = true;
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
    function updateClassState(
        Currency currency,
        uint128 totalTickets,
        uint128 ticketsSold,
        uint256 startTime
    ) external onlyAgent {
        if (totalTickets == 0) revert InvalidCapacity();
        if (ticketsSold > totalTickets) revert InvalidCapacity();
        
        classStates[currency] = ClassState({
            totalTickets: totalTickets,
            ticketsSold: ticketsSold,
            startTime: startTime
        });
        
        emit ClassStateUpdated(currency, totalTickets, ticketsSold, startTime);
    }

    // --- Hook Logic ---

    /// @notice Calculate dynamic fee based on class state
    function beforeSwap(
        address,
        PoolKey calldata key,
        BeforeSwapParams calldata params,
        bytes calldata
    ) external view override returns (bytes4, BeforeSwapDelta, uint24) {
        // Identify Class State from Currency
        ClassState memory state = classStates[key.currency1];
        if (state.totalTickets == 0) {
            state = classStates[key.currency0];
        }

        // No class state found - use pool's static fee
        if (state.totalTickets == 0) {
             return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        // Calculate Metrics
        uint256 utilization = (uint256(state.ticketsSold) * 100) / state.totalTickets;

        uint256 timeRemaining = 0;
        if (state.startTime > block.timestamp) {
            timeRemaining = state.startTime - block.timestamp;
        }

        // Determine Dynamic Fee (in pips: 10000 = 1%)
        uint24 fee = _calculateFee(utilization, timeRemaining);

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee);
    }

    /// @notice Calculate fee based on utilization and time
    function _calculateFee(uint256 utilization, uint256 timeRemaining) internal pure returns (uint24) {
        // Standard fee base: 0.30%
        uint24 fee = 3000;

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

        return fee;
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

    // ============ Admin ============

    function setAgentAuthorization(address agent, bool authorized) external onlyOwner {
        authorizedAgents[agent] = authorized;
        emit AgentUpdated(agent, authorized);
    }

    function setDefaultAgent(address agent) external onlyOwner {
        defaultAgent = agent;
        emit DefaultAgentUpdated(agent);
    }
}
