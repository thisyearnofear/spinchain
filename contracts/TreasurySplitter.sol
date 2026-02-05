// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @custom:security-contact security@spinchain.xyz
contract TreasurySplitter is Ownable, ReentrancyGuard, Pausable {
    // ============ Errors ============
    error LengthMismatch();
    error NoRecipients();
    error ZeroWallet();
    error ZeroBps();
    error BpsMustTotal10000();
    error NoBalance();
    error TransferFailed();
    error NothingToWithdraw();
    error InvalidMode();

    // ============ Structs ============
    struct Recipient {
        address wallet;
        uint96 bps; // Reduced to uint96 to pack with address (20 + 12 = 32 bytes)
    }

    // ============ State ============
    Recipient[] public recipients;
    uint256 public totalBps;
    bool public usePullPattern; // If true, recipients withdraw instead of push
    
    mapping(address => uint256) public pendingWithdrawals;

    // ============ Events ============
    event RecipientsUpdated();
    event Payout(address indexed to, uint256 amount);
    event WithdrawalReady(address indexed to, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event ModeChanged(bool usePullPattern);

    constructor(address owner_, address[] memory wallets, uint256[] memory bps, bool usePullPattern_) Ownable(owner_) {
        _setRecipients(wallets, bps);
        usePullPattern = usePullPattern_;
    }

    receive() external payable {}

    function recipientCount() external view returns (uint256) {
        return recipients.length;
    }

    function setRecipients(address[] calldata wallets, uint256[] calldata bps) external onlyOwner {
        _setRecipients(wallets, bps);
        emit RecipientsUpdated();
    }

    /// @notice Distribute funds to recipients (push or pull mode)
    function distribute() external nonReentrant whenNotPaused {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoBalance();
        
        uint256 length = recipients.length;
        
        if (usePullPattern) {
            // Pull pattern: accumulate pending withdrawals
            for (uint256 i = 0; i < length; i++) {
                Recipient memory recipient = recipients[i];
                uint256 amount = (balance * recipient.bps) / totalBps;
                if (amount > 0) {
                    pendingWithdrawals[recipient.wallet] += amount;
                    emit WithdrawalReady(recipient.wallet, amount);
                }
            }
        } else {
            // Push pattern: send directly (less safe)
            for (uint256 i = 0; i < length; i++) {
                Recipient memory recipient = recipients[i];
                uint256 amount = (balance * recipient.bps) / totalBps;
                if (amount > 0) {
                    (bool ok, ) = recipient.wallet.call{value: amount}("");
                    if (!ok) revert TransferFailed();
                    emit Payout(recipient.wallet, amount);
                }
            }
        }
    }

    /// @notice Withdraw pending funds (pull pattern)
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        
        pendingWithdrawals[msg.sender] = 0;
        
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        
        emit Withdrawn(msg.sender, amount);
    }

    function _setRecipients(address[] memory wallets, uint256[] memory bps) internal {
        if (wallets.length != bps.length) revert LengthMismatch();
        if (wallets.length == 0) revert NoRecipients();
        
        delete recipients;
        totalBps = 0;
        
        for (uint256 i = 0; i < wallets.length; i++) {
            if (wallets[i] == address(0)) revert ZeroWallet();
            if (bps[i] == 0) revert ZeroBps();
            recipients.push(Recipient({wallet: wallets[i], bps: uint96(bps[i])}));
            totalBps += bps[i];
        }
        if (totalBps != 10_000) revert BpsMustTotal10000();
    }

    // ============ Admin ============

    function setMode(bool usePullPattern_) external onlyOwner {
        usePullPattern = usePullPattern_;
        emit ModeChanged(usePullPattern_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
