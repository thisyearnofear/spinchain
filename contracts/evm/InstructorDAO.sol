// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title InstructorDAO
 * @notice Governance structure for the SpinChain protocol instructors.
 * @dev Manages protocol fees, route standards, and shared incentive pools.
 */
contract InstructorDAO is Ownable {
    // ============ Errors ============
    error AlreadyProposed();
    error NotAProposedRoute();
    error VotingClosed();
    error InsufficientBalance();

    // ============ Structs ============
    struct Proposal {
        address instructor;
        string routeCid;
        uint256 votes;
        bool approved;
        uint256 endTime;
    }

    // ============ State ============
    IERC20 public governanceToken;
    uint256 public proposalDuration = 3 days;
    uint256 public approvalThreshold = 1000 * 1e18; // SPIN tokens voted for a route

    mapping(bytes32 => Proposal) public proposals;
    mapping(address => bool) public isInstructor;
    uint256 public totalInstructors;

    // ============ Events ============
    event RouteProposed(bytes32 indexed proposalId, address instructor, string routeCid);
    event RouteApproved(bytes32 indexed proposalId, string routeCid);
    event VoteCast(bytes32 indexed proposalId, address voter, uint256 amount);
    event InstructorAdded(address indexed instructor);

    constructor(address governanceToken_) Ownable(msg.sender) {
        governanceToken = IERC20(governanceToken_);
    }

    function addInstructor(address instructor) external onlyOwner {
        if (!isInstructor[instructor]) {
            isInstructor[instructor] = true;
            totalInstructors++;
            emit InstructorAdded(instructor);
        }
    }

    /**
     * @notice Propose a new route for the protocol library.
     */
    function proposeRoute(string calldata routeCid) external returns (bytes32) {
        require(isInstructor[msg.sender], "Only instructors can propose");
        bytes32 proposalId = keccak256(abi.encodePacked(routeCid, msg.sender, block.timestamp));
        
        proposals[proposalId] = Proposal({
            instructor: msg.sender,
            routeCid: routeCid,
            votes: 0,
            approved: false,
            endTime: block.timestamp + proposalDuration
        });

        emit RouteProposed(proposalId, msg.sender, routeCid);
        return proposalId;
    }

    /**
     * @notice Vote for a proposed route using SPIN governance tokens.
     */
    function vote(bytes32 proposalId, uint256 amount) external {
        Proposal storage proposal = proposals[proposalId];
        if (block.timestamp > proposal.endTime) revert VotingClosed();
        if (proposal.instructor == address(0)) revert NotAProposedRoute();

        // Transfer tokens to DAO (locked for voting)
        if (!governanceToken.transferFrom(msg.sender, address(this), amount)) revert InsufficientBalance();

        proposal.votes += amount;
        emit VoteCast(proposalId, msg.sender, amount);

        if (proposal.votes >= approvalThreshold && !proposal.approved) {
            proposal.approved = true;
            emit RouteApproved(proposalId, proposal.routeCid);
        }
    }

    /**
     * @notice Collect protocol fees from sessions (placeholder logic).
     */
    function distributeFees(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "Mismatched arrays");
        for (uint256 i = 0; i < recipients.length; i++) {
            governanceToken.transfer(recipients[i], amounts[i]);
        }
    }
}
