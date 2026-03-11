# Yellow Network Integration: Real-Time Reward Settlement

SpinChain integrates with **Yellow Network** to provide high-fidelity, real-time reward accrual for riders. This integration leverages Yellow's state channel technology to enable micro-rewards without the overhead of on-chain gas fees for every telemetry update.

## Core Architecture

The integration follows a **State Channel** pattern where workout telemetry and reward accrual happen off-chain and are settled on-chain at the end of a session.

### 1. Off-Chain Accrual (Nitro RPC)
- **ClearNode**: SpinChain connects to a Yellow **ClearNode** via WebSockets.
- **Nitro SDK**: Uses `@erc7824/nitrolite` for managing state channel sessions.
- **Real-time Updates**: As a rider pedals, telemetry (Power, Heart Rate, Cadence) is packaged into signed state updates and sent to the ClearNode.
- **Reward Calculation**: Rewards (SPIN tokens) are calculated in real-time based on effort and duration, updating the channel state every few seconds.

### 2. Participant Co-signing (EIP-712)
To ensure the integrity of the rewards, both participants must authorize the final session state:
- **Rider**: Signs the final state upon completing the ride.
- **Instructor**: Reviews and co-signs the session via the **Instructor Settlement Hub**.
- **Security**: Uses EIP-712 typed data signing to ensure users know exactly what they are authorizing.

### 3. On-Chain Settlement (Avalanche Fuji)
Once co-signed, the rewards are minted on the blockchain:
- **Batch Settlement**: Instructors can batch multiple co-signed sessions into a single transaction.
- **Gas Efficiency**: Batching reduces gas costs by up to 85% compared to individual settlements.
- **Proof Verification**: The settlement contract on Avalanche verifies the signatures of both the rider and instructor before minting SPIN tokens.

## User Experience Features

### For Riders: The Reward Ticker
- **Real-time Feedback**: A live ticker in the HUD shows SPIN tokens accumulating as they ride.
- **Stream Status**: Visual indicators show the health of the connection to the ClearNode.
- **Instant Finality**: The ride summary shows the final accrued reward immediately after the session.

### For Instructors: Settlement Hub
- **Queue Management**: A dedicated dashboard for viewing pending rider sessions.
- **One-Click Settle**: Integration with **ERC-7715** allows instructors to grant session-based permissions for automatic co-signing.
- **Efficiency Stats**: Visualizes gas savings achieved through batching.

## Technical Implementation Details

- **Transport**: WebSocket (`wss://`) connection to ClearNode.
- **Signing**: 
    - **Ephemeral Session Keys**: Used for high-frequency Nitro RPC updates (stored in `localStorage`).
    - **Wallet Signing**: Used for the final EIP-712 settlement state.
- **Contracts**: `YellowSettlement.sol` on Avalanche Fuji handles the verification and minting logic.

## Why Yellow?
By using Yellow's state channels, SpinChain achieves:
1. **Zero-Latency Rewards**: Users see their balance grow every second.
2. **Zero-Cost Telemetry**: High-resolution workout data is verified without gas.
3. **Decentralized Trust**: Rewards are only minted when both the athlete and the coach agree on the performance.


