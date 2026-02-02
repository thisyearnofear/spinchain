// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface ISpinClass {
    function hasAttended(address rider) external view returns (bool);
}

interface ISpinToken {
    function mint(address to, uint256 amount) external;
}

contract IncentiveEngine is Ownable {
    using ECDSA for bytes32;

    ISpinToken public rewardToken;
    address public attestationSigner;

    mapping(bytes32 => bool) public usedAttestations;

    event AttestationSignerUpdated(address indexed signer);
    event RewardTokenUpdated(address indexed token);
    event RewardClaimed(address indexed rider, address indexed spinClass, uint256 amount, bytes32 attestationId);

    constructor(address owner_, address token_, address signer_) Ownable(owner_) {
        rewardToken = ISpinToken(token_);
        attestationSigner = signer_;
    }

    function setAttestationSigner(address signer_) external onlyOwner {
        attestationSigner = signer_;
        emit AttestationSignerUpdated(signer_);
    }

    function setRewardToken(address token_) external onlyOwner {
        rewardToken = ISpinToken(token_);
        emit RewardTokenUpdated(token_);
    }

    function submitAttestation(
        address spinClass,
        address rider,
        uint256 rewardAmount,
        bytes32 classId,
        bytes32 claimHash,
        uint256 timestamp,
        bytes calldata signature
    ) external {
        require(ISpinClass(spinClass).hasAttended(rider), "not attended");

        bytes32 attestationId = keccak256(
            abi.encodePacked(spinClass, rider, rewardAmount, classId, claimHash, timestamp)
        );
        require(!usedAttestations[attestationId], "attestation used");
        usedAttestations[attestationId] = true;

        bytes32 message = keccak256(
            abi.encodePacked("SPIN_ATTESTATION", spinClass, rider, rewardAmount, classId, claimHash, timestamp)
        ).toEthSignedMessageHash();
        address recovered = message.recover(signature);
        require(recovered == attestationSigner, "invalid signature");

        rewardToken.mint(rider, rewardAmount);
        emit RewardClaimed(rider, spinClass, rewardAmount, attestationId);
    }
}
