# Testing & Verification Guide

This document outlines the testing strategy and verification steps for the SpinChain protocol, specifically focusing on the **Chainlink Runtime Environment (CRE)** integration for the hackathon.

## 🧪 Smart Contract Tests (Forge)

We use **Foundry (Forge)** for unit and integration testing of the EVM contracts on Avalanche.

### Running Tests
```bash
# Run all tests
forge test --root contracts/evm

# Run specific BiometricOracle tests (with verbose logging)
forge test --root contracts/evm --match-path test/BiometricOracle.t.sol -vv
```

### Coverage
- **BiometricOracle**: Validates request lifecycle, CRE forwarder authorization, and report fulfillment logic.
- **IncentiveEngine**: Verifies reward calculation and distribution via Chainlink-verified scores.
- **Access Control**: Ensures only authorized CRE workflows and forwarders can update oracle state.

---

## 🔄 End-to-End Simulation (Chainlink CRE)

Since the Chainlink Runtime Environment involves off-chain orchestration, we provide a simulation script that demonstrates the full biometric verification loop.

### Run Simulation
```bash
node scripts/simulate-cre-flow.js
```

### Simulation Steps
1. **Rider Request**: Simulates an on-chain call to `BiometricOracle.requestVerification`.
2. **CRE Trigger**: Simulates the CRE Workflow detecting the `VerificationRequested` event.
3. **Confidential Fetch**: Demonstrates the use of **Confidential HTTP** to fetch private telemetry from a wearable API.
4. **Off-Chain Logic**: Processes the raw telemetry to calculate a consensus-verified `Effort Score`.
5. **On-Chain Report**: Simulates the DON (Decentralized Oracle Network) submitting the report back to Avalanche.
6. **Reward Claim**: Shows the rider claiming SPIN tokens from the `IncentiveEngine` using the oracle's verified score.

---

## 🛠️ ZK Proof Validation (Noir)

For users choosing maximum privacy, the legacy ZK-based flow is still available and validated via:

```bash
# Compile and test ZK circuits
cd circuits/effort_threshold
nargo test

# Run E2E ZK Live Loop simulation
npx ts-node --esm scripts/e2e-live-loop.ts
```

---

## ✅ Verification Result Summary

| Feature | Method | Status |
|---------|--------|--------|
| **CRE Biometric Oracle** | Forge Unit Tests | 🟢 PASSED |
| **Confidential HTTP Flow** | Node.js Simulation | 🟢 VERIFIED |
| **Incentive Engine Rewards**| Integration Tests | 🟢 PASSED |
| **ZK Privacy Circuits** | Nargo Tests | 🟢 PASSED |
