// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TreasurySplitter is Ownable, ReentrancyGuard {
    struct Recipient {
        address wallet;
        uint256 bps;
    }

    Recipient[] public recipients;
    uint256 public totalBps;

    event RecipientsUpdated();
    event Payout(address indexed to, uint256 amount);

    constructor(address owner_, address[] memory wallets, uint256[] memory bps) Ownable(owner_) {
        _setRecipients(wallets, bps);
    }

    receive() external payable {}

    function recipientCount() external view returns (uint256) {
        return recipients.length;
    }

    function setRecipients(address[] calldata wallets, uint256[] calldata bps) external onlyOwner {
        _setRecipients(wallets, bps);
        emit RecipientsUpdated();
    }

    function distribute() external nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "no balance");
        uint256 length = recipients.length;
        for (uint256 i = 0; i < length; i++) {
            Recipient memory recipient = recipients[i];
            uint256 amount = (balance * recipient.bps) / totalBps;
            if (amount > 0) {
                (bool ok, ) = recipient.wallet.call{value: amount}("");
                require(ok, "transfer failed");
                emit Payout(recipient.wallet, amount);
            }
        }
    }

    function _setRecipients(address[] memory wallets, uint256[] memory bps) internal {
        require(wallets.length == bps.length, "length mismatch");
        require(wallets.length > 0, "no recipients");
        delete recipients;
        totalBps = 0;
        for (uint256 i = 0; i < wallets.length; i++) {
            require(wallets[i] != address(0), "zero wallet");
            require(bps[i] > 0, "zero bps");
            recipients.push(Recipient({wallet: wallets[i], bps: bps[i]}));
            totalBps += bps[i];
        }
        require(totalBps == 10_000, "bps must total 10000");
    }
}
