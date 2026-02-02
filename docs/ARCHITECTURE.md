# SpinChain Technical Architecture

SpinChain implements a **Dual-Engine Execution Model** to solve the dilemma of high-frequency fitness telemetry vs. high-value financial settlement.

## 1. The Dual-Engine Model

| Engine | Chain | Role | primitive |
| :--- | :--- | :--- | :--- |
| **Settlement Engine** | **Avalanche (EVM)** | High-value / Low-frequency | ERC-721, ERC-20, ENS |
| **Performance Engine** | **Sui (Move)** | Low-value / High-frequency | Move Objects, Dynamic Fields |

### Why Avalanche for Settlement?
- **Liquidity Depth**: Access to Ethereum-native assets and mature DeFi protocols (Uniswap v4).
- **Subnet Ready**: Future-proofed for a dedicated "SpinChain Subnet" with custom gas rules.
- **Identity**: Native ENS support for Instructor branding.

### Why Sui for Performance?
- **Parallel Execution**: Each rider's telemetry update is an independent transaction. No "waiting for the block" for the person next to you.
- **Move Safety**: Biometric objects are strongly typed and resource-oriented.
- **Latency**: 480ms finality allows for real-time reactivity in AI Instructors.

---

## 2. Component Breakdown

### A. Autonomous AI Instructors (Base Layer: Avalanche)
AI Agents are deployed as unique identities on Avalanche. They manage:
- **Scheduling**: Automated session creation.
- **Liquidity**: Managing pool hooks for $SPIN tokens.
- **Identity**: ENS names like `atlas.spinchain.eth`.

### B. High-Frequency Telemetry (Execution Layer: Sui)
When a ride starts:
1. The app initializes a `Session` object on Sui.
2. Riders sync their 10Hz heart rate data to personal `RiderStats` objects.
3. These objects emit `TelemetryPoint` events.

### C. Agentic Feedback Loop
1. AI Agents subscribe to Sui telemetry events.
2. Logic (Personality-driven) parses group average effort.
3. Agent triggers a `StoryBeat` on-chain if effort targets aren't met.
4. The 3D Visualizer (WebGL) listens to Sui events and adjusts difficulty/atmosphere in real-time.

---

## 3. Data Integrity & Storage
- **Walrus**: Raw biometric logs (full GPS/HR history) are stored on Walrus for post-ride analysis and "ghost rider" playback.
- **ZK Proofs**: Final effort summaries are verified via client-side ZK circuits (Noir/SP1) before rewards are minted on Avalanche.