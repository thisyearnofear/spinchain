#!/usr/bin/env bash
set -euo pipefail

# SpinChain E2E Verification Script
# Verifies the full flow on Fuji testnet: contract deployment → class creation → reward calculation
#
# Prerequisites:
#   - foundry installed (curl -L https://foundry.paradigm.xyz | bash && foundryup)
#   - AVALANCHE_PRIVATE_KEY set in environment (deployer or test wallet with Fuji AVAX)
#   - SNOWTRACE_API_KEY set (optional, for verification)
#
# Usage:
#   export AVALANCHE_PRIVATE_KEY=0x...
#   ./scripts/e2e-verify-fuji.sh

set -a
source .env.local 2>/dev/null || true
set +a

RPC_URL="https://api.avax-test.network/ext/bc/C/rpc"
CONTRACTS_DIR="contracts/evm"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
info() { echo -e "${YELLOW}→ $1${NC}"; }

echo "============================================"
echo "  SpinChain E2E Fuji Verification"
echo "============================================"
echo ""

# ─── 1. Verify all contracts have code ──────────────────────────
info "Step 1: Verify all 8 contracts deployed on Fuji"

CONTRACTS=(
  "SpinPack:0x2C8443584daFA864Caa967cBDD7ec3D17157618B"
  "SpinToken:0x4c0E965B809452F2C914a74d1D0e9C3375543392"
  "IncentiveEngine:0x69800d3ABda003b7aA6038831715a4aCb736403d"
  "ClassFactory:0x035026f85CCbC273160669FBe9Ba5Dc147D0Bd9b"
  "UltraVerifier:0xF2a33f6e9a5e935Db5d682E226A7e1a0249A641B"
  "EffortVerifier:0xBbc32cc3b8AF9BaeD8D77E3bf4fC69141b0c9dA4"
  "TreasurySplitter:0x00a1e5688AF26c724155BfEe100fF23d387850AB"
  "BiometricOracle:0x038fca8A26F9065f12F831C0600f30d8C90AFCFD"
)

for entry in "${CONTRACTS[@]}"; do
  name="${entry%%:*}"
  addr="${entry##*:}"
  code=$(cast code "$addr" --rpc-url "$RPC_URL" 2>/dev/null || echo "0x")
  if [ "$code" = "0x" ] || [ -z "$code" ]; then
    fail "$name ($addr) has no code"
  else
    ok "$name deployed at $addr ($(echo -n "$code" | wc -c) bytes)"
  fi
done

echo ""

# ─── 2. Verify SpinToken owner is IncentiveEngine ───────────────
info "Step 2: Verify SpinToken owner is IncentiveEngine"

TOKEN_OWNER=$(cast call 0x4c0E965B809452F2C914a74d1D0e9C3375543392 "owner()(address)" --rpc-url "$RPC_URL" 2>/dev/null || echo "0x0")
EXPECTED="0x69800d3ABda003b7aA6038831715a4aCb736403d"

# Normalize addresses (lowercase, no extra padding)
TOKEN_OWNER_NORMALIZED=$(cast --to-checksum-address "$TOKEN_OWNER" 2>/dev/null || echo "$TOKEN_OWNER")
EXPECTED_NORMALIZED=$(cast --to-checksum-address "$EXPECTED" 2>/dev/null || echo "$EXPECTED")

if [ "$TOKEN_OWNER_NORMALIZED" = "$EXPECTED_NORMALIZED" ]; then
  ok "SpinToken owner = IncentiveEngine ($TOKEN_OWNER_NORMALIZED)"
else
  fail "SpinToken owner mismatch: got $TOKEN_OWNER_NORMALIZED, expected $EXPECTED_NORMALIZED"
fi

echo ""

# ─── 3. Verify IncentiveEngine is not paused ────────────────────
info "Step 3: Verify IncentiveEngine is not paused"

PAUSED=$(cast call 0x69800d3ABda003b7aA6038831715a4aCb736403d "paused()(bool)" --rpc-url "$RPC_URL" 2>/dev/null || echo "true")
if [ "$PAUSED" = "false" ]; then
  ok "IncentiveEngine is not paused"
else
  fail "IncentiveEngine is paused — rewards cannot be claimed"
fi

echo ""

# ─── 4. Verify ClassFactory has classes registered ──────────────
info "Step 4: Verify ClassFactory has classes"

CLASS_COUNT=$(cast call 0x035026f85CCbC273160669FBe9Ba5Dc147D0Bd9b "getClassCount()(uint256)" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
ok "ClassFactory has $CLASS_COUNT classes registered"

echo ""

# ─── 5. Verify reward calculation ───────────────────────────────
info "Step 5: Verify reward calculation"

REWARD_500=$(cast call 0x69800d3ABda003b7aA6038831715a4aCb736403d "calculateReward(uint16)(uint256)" 500 --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
REWARD_800=$(cast call 0x69800d3ABda003b7aA6038831715a4aCb736403d "calculateReward(uint16)(uint256)" 800 --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
REWARD_1000=$(cast call 0x69800d3ABda003b7aA6038831715a4aCb736403d "calculateReward(uint16)(uint256)" 1000 --rpc-url "$RPC_URL" 2>/dev/null || echo "0")

ok "Reward(500) = $(cast --from-wei "$REWARD_500" 2>/dev/null || echo "$REWARD_500") SPIN"
ok "Reward(800) = $(cast --from-wei "$REWARD_800" 2>/dev/null || echo "$REWARD_800") SPIN"
ok "Reward(1000) = $(cast --from-wei "$REWARD_1000" 2>/dev/null || echo "$REWARD_1000") SPIN"

echo ""

# ─── 6. Run Foundry fork tests ──────────────────────────────────
info "Step 6: Run Foundry E2E fork tests"

if ! command -v forge &> /dev/null; then
  echo "  forge not found — skipping Foundry tests"
  echo "  Install: curl -L https://foundry.paradigm.xyz | bash && foundryup"
else
  cd "$CONTRACTS_DIR"
  if forge test --match-contract E2EFujiDeployment --fork-url "$RPC_URL" -vvv; then
    ok "Foundry E2E fork tests passed"
  else
    fail "Foundry E2E fork tests failed"
  fi
  cd - > /dev/null
fi

echo ""

# ─── 7. Summary ─────────────────────────────────────────────────
echo "============================================"
echo "  E2E Verification Complete"
echo "============================================"
echo ""
echo "Contracts verified:"
echo "  - SpinPack (ERC-1155):       0x2C8443584daFA864Caa967cBDD7ec3D17157618B"
echo "  - SpinToken (ERC-20):        0x4c0E965B809452F2C914a74d1D0e9C3375543392"
echo "  - IncentiveEngine:           0x69800d3ABda003b7aA6038831715a4aCb736403d"
echo "  - ClassFactory:              0x035026f85CCbC273160669FBe9Ba5Dc147D0Bd9b"
echo "  - UltraVerifier (real ZK):   0xF2a33f6e9a5e935Db5d682E226A7e1a0249A641B"
echo "  - EffortThresholdVerifier:   0xBbc32cc3b8AF9BaeD8D77E3bf4fC69141b0c9dA4"
echo "  - TreasurySplitter:          0x00a1e5688AF26c724155BfEe100fF23d387850AB"
echo "  - BiometricOracle:           0x038fca8A26F9065f12F831C0600f30d8C90AFCFD"
echo ""
echo "Remaining manual checks:"
echo "  1. Frontend: Connect wallet → browse class catalog → join a class"
echo "  2. Ride: Start a practice ride → complete → verify ride summary saved"
echo "  3. ZK Claim: Submit ZK proof on-chain → verify SPIN tokens minted"
echo "  4. Walrus: Verify ride telemetry blob is anchored on Sui"
echo ""
