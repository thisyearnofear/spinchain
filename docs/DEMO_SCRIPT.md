# SpinChain Demo Script (2 Minutes)

**Objective**: Showcase the technical complexity of Chainlink CRE + Confidential HTTP while demonstrating the seamless user experience of SpinChain.

---

### 0:00 - 0:15 | Introduction & Guest Mode
*   **Visual**: Dashboard with 3D Route.
*   **Action**: Click "Guest Mode".
*   **Voice**: "Welcome to SpinChain, the dual-engine fitness protocol where AI Instructors manage your workout and Chainlink CRE secures your rewards. We're jumping straight into **Guest Mode**—showing how any user can join an immersive 3D ride without a wallet or hardware."

### 0:15 - 0:45 | The Pedal Simulator & AI Coaching
*   **Visual**: Pedaling with the keyboard, metrics (BPM, Power) rising.
*   **Action**: Press 'W' to increase intensity.
*   **Voice**: "I’m using our built-in **Pedal Simulator**. Every stroke generates high-fidelity telemetry recorded on the **Sui Performance Layer**. Our AI Coach, Atlas, monitors these streams in real-time to provide adaptive coaching and ensure I’m hitting my effort zones."

### 0:45 - 1:20 | Chainlink CRE & Confidential HTTP
*   **Visual**: Finish the ride. Click "Verify Performance". Switch to Terminal.
*   **Action**: Run `node scripts/simulate-cre-flow.js`.
*   **Voice**: "To earn rewards, we need trustless verification. Our **Chainlink Runtime Environment (CRE)** workflow takes over. It uses **Confidential HTTP** to fetch my private biometric data from a wearable API. The CRE processes this raw telemetry off-chain to calculate a consensus-verified 'Effort Score' without ever exposing my health data on-chain."

### 1:20 - 1:45 | Settlement & Rewards
*   **Visual**: Switch back to app. Show "Verified" status.
*   **Action**: Click "Claim SPIN Rewards".
*   **Voice**: "The report is written back to Avalanche. Now, the **Incentive Engine** knows I’ve done the work. Because we fixed our state management, my wallet connection stays rock-solid as I navigate to the Rewards page to claim my SPIN tokens. This is the future of secure, private, and incentivized health."

### 1:45 - 2:00 | Conclusion
*   **Visual**: SpinChain Logo with "Built on Chainlink, Avalanche, and Sui".
*   **Voice**: "SpinChain combines agentic finance, ZK privacy, and decentralized data orchestration. Let's ride into the future of fitness. Thank you."

---

### Technical Highlights for Judges:
1.  **Chainlink CRE**: Orchestrating off-chain data fetching and computation.
2.  **Confidential HTTP**: Privacy-preserving API integrations.
3.  **Hybrid Architecture**: Sui for 10Hz telemetry, Avalanche for secure settlement.
4.  **Accessibility**: Pedal Simulator + Guest Mode for zero-barrier onboarding.
