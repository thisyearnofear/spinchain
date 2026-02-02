# SpinChain Architecture: The Dual-Engine Protocol

> **Vision**: A privacy-first fitness OS that combines the liquidity depth of EVM with the parallel execution speed of Sui Move.

## 1. Executive Summary: The Hybrid Thesis

SpinChain is not just a dApp; it is a cross-chain protocol designed to solve the "Frequency Mismatch" problem in crypto-fitness.

*   **Financial events** (buying a ticket, claiming a reward) are **Low Frequency / High Value**. They belong on a robust settlement layer with deep DeFi liquidity (Avalanche C-Chain / Base).
*   **Fitness events** (heart rate updates, cadence changes, route position) are **High Frequency / Low Value**. They require sub-second latency and parallel processing to scale to thousands of live riders. They belong on a high-throughput execution layer (Sui).

By bridging these two worlds, we create a system where **Human Riders** get privacy and performance, while **AI Agents** get the speed and programmatic control they need to manage classes autonomously.

---

## 2. The Architecture Matrix

| Layer | Chain / Tech | Role | Key Primitives |
| :--- | :--- | :--- | :--- |
| **Settlement** | **Avalanche C-Chain** | **Identity & Finance** | • **ENS**: Sovereign Identity for Agents<br>• **Uniswap v4**: Liquidity Hooks for $SPIN<br>• **ERC-721**: Verified Attendance Tickets |
| **Execution** | **Sui (Move)** | **Telemetry & Physics** | • **Dynamic Objects**: Evolving "Rider" stats<br>• **PTBs**: Atomic Agent decisions<br>• **zkLogin**: Web2-like onboarding |
| **Storage** | **Walrus** | **World State** | • **Blobs**: 3D Route Assets (GLTF/GPX)<br>• **Logs**: Unaltered biometric history (10GB+) |

---

## 3. Layer 1: The Settlement Engine (Avalanche C-Chain)

This layer handles the "Business Logic" of the class. It is the vault where value settles.

### A. Identity & Reputation (ENS)
*   **Human**: Users link their wallet to an ENS name.
*   **AI Agents**: Every AI Instructor (e.g., `coach-atlas.eth`) owns its identity. Reputation scores (class ratings) are attested to this ENS name, making the agent's "Brand" portable across chains.

### B. Liquidity (Uniswap v4)
*   **Agentic Finance**: AI Instructors don't just teach; they manage their own P&L.
*   **Hooks**: We use custom Hooks to dynamically adjust liquidity fees based on class demand. If a class is full, the Agent can "surge" the swap fee for the required ticket token, capturing more value for the DAO.

### C. Access Control (SpinClass.sol)
*   Standard ERC-721 ticketing with bonding curve pricing.
*   Payment splitting logic (Instructor / Platform / Sponsor).

---

## 4. Layer 2: The Performance Engine (Sui)

This layer acts as the "Nervous System" of the application. It processes raw inputs into verified outputs.

### A. Parallel Execution (The "Lobby" Problem)
*   **Challenge**: On EVM, 1,000 riders updating their heart rate simultaneously would spike gas and cause failed transactions.
*   **Sui Solution**: Each rider is an independent **Object**. Updating Rider A does not block Rider B. This allows for real-time, lag-free leaderboards.

### B. Dynamic Fields (The "Evolving Rider")
*   Instead of minting a new NFT for every achievement, we use Sui's **Dynamic Object Fields**.
*   **Mechanism**: A rider's profile is a parent object. As they pedal, "Effort Points" and "XP" are attached as child fields *during the ride*.
*   **Result**: The NFT itself evolves. It is a living record of the session.

### C. Programmable Transaction Blocks (PTB)
*   **Agent Superpower**: An AI Agent can execute complex logic in a single atomic transaction.
    1.  Scan biometrics of 100 riders.
    2.  Calculate the "Fatigue Index" of the room.
    3.  Adjust the "Route World" elevation (make it easier/harder).
    4.  Distribute micro-incentives to struggling riders.
*   **Efficiency**: No intermediate state failures. Total control in < 500ms.

---

## 5. Layer 3: The "World Memory" (Walrus)

We cannot store 3D assets or high-frequency biometric logs on-chain. IPFS is too slow for 10Hz playback.

*   **Walrus Integration**: We store the "Route World" definitions (GPX + environmental metadata) and the raw "Replay Logs" on Walrus decentralized storage.
*   **Agent Access**: AI Agents can read these raw logs to analyze historical performance trends (e.g., "Rider X always bonks at minute 30") to generate personalized coaching plans.

---

## 6. The User Journey: Bridging the Gap

How do users experience this dual-chain world without friction?

1.  **Onboarding**: User logs in via **zkLogin** (Google). A Sui address is derived instantly.
2.  **Ticketing (Avalanche)**: User buys a ticket on Avalanche. The UI waits for confirmation.
3.  **State Sync (The "Handshake")**:
    *   The frontend detects the `TicketPurchased` event on Avalanche.
    *   It calls a `join_session` function on Sui, passing the Avalanche Transaction Hash as a "Proof of Access".
    *   The Sui contract initializes a `RiderObject` for the session.
4.  **The Ride (Sui)**:
    *   User pedals. Telemetry is signed and sent to Sui (0 gas cost via sponsored transactions).
    *   AI Agent (running via PTBs) reacts to the data.
5.  **Settlement (Avalanche)**:
    *   Ride finishes. Sui generates a "Proof of Effort" (merkle root of the session).
    *   User submits this proof to Avalanche to claim their $SPIN rewards.

---

## 7. Why This Wins HackMoney

*   **Sui**: We showcase specific unique primitives (PTB, Dynamic Fields) that are impossible on EVM. We aren't just "using Sui as a database"; we are using it as a logic engine.
*   **Uniswap**: We implement "Agentic Finance" via v4 Hooks, giving AI instructors economic agency.
*   **ENS**: We give robots names.
*   **Avalanche**: We demonstrate a path to a dedicated subnet for high-throughput health data.