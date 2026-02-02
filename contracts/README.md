# SpinChain Contracts (Remix-Friendly)

## Files
- `SpinToken.sol`: ERC-20 reward token, mintable by the incentive engine.
- `IncentiveEngine.sol`: Verifies signed attestations and mints rewards.
- `SpinClass.sol`: ERC-721 ticket contract with attendance + revenue settlement.
- `TreasurySplitter.sol`: Simple revenue splitter (basis points, total = 10,000).
- `ClassFactory.sol`: Deploys new `SpinClass` instances.

## Deployment Order (Suggested)
1. Deploy `SpinToken` with `owner = your wallet`.
2. Deploy `IncentiveEngine` with:
   - `owner = your wallet`
   - `token = SpinToken address`
   - `signer = attestation signer address` (your backend/app signer for MVP)
3. Deploy `TreasurySplitter` with recipients + bps (must sum to 10,000).
4. Deploy `ClassFactory`.
5. Use `ClassFactory.createClass(...)` to deploy classes.

## Minimal MVP Flow
1. Rider buys a ticket via `SpinClass.purchaseTicket()` (pays ETH).
2. Rider checks in via `SpinClass.checkIn(tokenId)`.
3. App signs an attestation offchain.
4. Call `IncentiveEngine.submitAttestation(...)` to mint rewards.
5. Instructor calls `SpinClass.settleRevenue()` to forward ETH to the splitter.
6. Call `TreasurySplitter.distribute()` to pay recipients.

## Attestation Signing (MVP)
Sign the following payload with the `attestationSigner` key:
```
keccak256(
  abi.encodePacked(
    "SPIN_ATTESTATION",
    spinClass,
    rider,
    rewardAmount,
    classId,
    claimHash,
    timestamp
  )
)
```
Then submit the signature to `submitAttestation`.

## Notes
- All ZK proofs are stubbed as signed attestations for MVP.
- The `classMetadata` field can hold an IPFS CID or JSON metadata URL.
