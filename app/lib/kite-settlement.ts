/**
 * Kite Settlement Service
 *
 * Integrates with the Kite AI chain via gokite-aa-sdk for:
 * - Agent revenue settlement (USDC transfers via AA wallet)
 * - Spending rule configuration (budgets, time windows)
 * - Gasless transactions via bundler
 *
 * Docs: https://docs.gokite.ai/kite-chain/account-abstraction-sdk
 */

import { ethers } from "ethers";
import { CONTRACTS } from "@/app/config";

export interface KiteSettlementResult {
  txHash: string;
  attestationId: string;
  status: "settled" | "pending" | "failed";
  explorerUrl?: string;
}

export interface KiteSpendingRule {
  tokenAddress: string;
  maxAmountPerTx: bigint;
  maxTotalAmount: bigint;
  windowSeconds: bigint;
}

export interface KiteWalletBalance {
  kiteBalance: bigint;
  usdcBalance: bigint;
}

// ERC-20 ABI (minimal)
const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "decimals", type: "uint8" }],
    stateMutability: "view",
  },
];

/**
 * Lazily create the GokiteAASDK instance.
 * This is server-side only — requires KITE_SIGNER_PRIVATE_KEY.
 */
async function getKiteSDK(): Promise<{
  sdk: InstanceType<any>;
  signer: ethers.Wallet;
  eoa: string;
} | null> {
  const privateKey = process.env.KITE_SIGNER_PRIVATE_KEY;
  const aaWalletAddress = CONTRACTS.kite.aaWallet;
  const agentVault = CONTRACTS.kite.agentVault;

  if (!privateKey || !aaWalletAddress || !agentVault) {
    return null;
  }

  // Dynamically import to avoid bundling in client-side code
  const { GokiteAASDK } = await import("gokite-aa-sdk");

  const sdk = new GokiteAASDK(
    "kite_testnet",
    CONTRACTS.kite.rpcUrl,
    CONTRACTS.kite.bundlerRpcUrl,
  );

  const provider = new ethers.JsonRpcProvider(CONTRACTS.kite.rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const eoa = signer.address;

  return { sdk, signer, eoa };
}

/**
 * Sign function for AA user operations — uses ethers Wallet.
 */
function createSignFunction(signer: ethers.Wallet) {
  return async (userOpHash: string): Promise<string> => {
    return signer.signMessage(ethers.getBytes(userOpHash));
  };
}

/**
 * Settle agent revenue on Kite chain via AA wallet.
 *
 * Transfers USDC from the agent's AA wallet to the specified recipient.
 * Uses gasless transactions via the Kite bundler.
 *
 * @param revenue - Amount in USD (will be converted to USDC decimals)
 * @param classId - Class identifier for attestation
 * @param recipient - Wallet address to receive the settlement
 * @returns Settlement result with tx hash and attestation ID
 */
export async function settleAgentRevenue(
  revenue: number,
  classId: string,
  recipient: `0x${string}`,
): Promise<KiteSettlementResult> {
  const kite = await getKiteSDK();

  if (!kite) {
    console.warn(
      "[KiteSettlement] Kite SDK not configured — set KITE_SIGNER_PRIVATE_KEY, NEXT_PUBLIC_KITE_AA_WALLET, and NEXT_PUBLIC_KITE_AGENT_VAULT",
    );
    return {
      txHash: "",
      attestationId: "",
      status: "pending",
    };
  }

  const { sdk, signer, eoa } = kite;
  const usdcAddress = CONTRACTS.kite.usdc as `0x${string}`;

  try {
    // Convert USD amount to USDC decimals (6 decimals)
    const usdcAmount = ethers.parseUnits(revenue.toFixed(6), 6);

    // Encode ERC-20 transfer call
    const usdcInterface = new ethers.Interface(ERC20_ABI);
    const transferData = usdcInterface.encodeFunctionData("transfer", [
      recipient,
      usdcAmount,
    ]);

    // Send via AA wallet (gasless via bundler)
    const signFunction = createSignFunction(signer);
    const txHash = await sdk.sendUserOperationAndWait(
      eoa,
      {
        target: usdcAddress,
        value: 0n,
        callData: transferData,
      },
      signFunction,
    );

    const attestationId = `kite-attest-${classId}-${Date.now()}`;
    const explorerUrl = `${CONTRACTS.kite.explorerUrl}/tx/${txHash}`;

    console.log(
      `[KiteSettlement] Settled $${revenue.toFixed(2)} USDC to ${recipient} — tx: ${txHash}`,
    );

    return {
      txHash,
      attestationId,
      status: "settled",
      explorerUrl,
    };
  } catch (err) {
    console.error("[KiteSettlement] Settlement failed:", err);
    return {
      txHash: "",
      attestationId: "",
      status: "failed",
    };
  }
}

/**
 * Configure spending rules for the agent vault.
 *
 * Sets budget limits and time windows for autonomous agent transactions.
 *
 * @param rules - Array of spending rules (token, limits, window)
 */
export async function configureSpendingRules(
  rules: KiteSpendingRule[],
): Promise<boolean> {
  const kite = await getKiteSDK();

  if (!kite) {
    console.warn("[KiteSettlement] Kite SDK not configured — cannot set spending rules");
    return false;
  }

  const { sdk, signer, eoa } = kite;
  const agentVault = CONTRACTS.kite.agentVault!;

  try {
    const signFunction = createSignFunction(signer);

    // Encode configureSpendingRules call for each rule
    for (const rule of rules) {
      const encodedRules = [
        {
          tokenAddress: rule.tokenAddress,
          maxAmountPerTx: rule.maxAmountPerTx,
          maxTotalAmount: rule.maxTotalAmount,
          windowSeconds: rule.windowSeconds,
        },
      ];

      // The SDK provides the encoding helper
      const callData = sdk.encodeConfigureSpendingRules(encodedRules);

      await sdk.sendUserOperationAndWait(
        eoa,
        {
          target: agentVault,
          value: 0n,
          callData,
        },
        signFunction,
      );
    }

    console.log(`[KiteSettlement] Configured ${rules.length} spending rule(s)`);
    return true;
  } catch (err) {
    console.error("[KiteSettlement] Failed to configure spending rules:", err);
    return false;
  }
}

/**
 * Get the agent's wallet balances on Kite chain.
 *
 * @returns KITE (native) and USDC balances
 */
export async function getAgentBalances(): Promise<KiteWalletBalance> {
  const aaWallet = CONTRACTS.kite.aaWallet;

  if (!aaWallet) {
    return { kiteBalance: 0n, usdcBalance: 0n };
  }

  try {
    const provider = new ethers.JsonRpcProvider(CONTRACTS.kite.rpcUrl);

    // Native KITE balance
    const kiteBalance = await provider.getBalance(aaWallet);

    // USDC balance
    const usdcContract = new ethers.Contract(
      CONTRACTS.kite.usdc as string,
      ERC20_ABI,
      provider,
    );
    const usdcBalance = await usdcContract.balanceOf(aaWallet);

    return { kiteBalance, usdcBalance };
  } catch (err) {
    console.error("[KiteSettlement] Failed to get balances:", err);
    return { kiteBalance: 0n, usdcBalance: 0n };
  }
}

/**
 * Check if Kite settlement is configured and ready.
 */
export function isKiteConfigured(): boolean {
  return !!(
    process.env.KITE_SIGNER_PRIVATE_KEY &&
    CONTRACTS.kite.aaWallet &&
    CONTRACTS.kite.agentVault
  );
}
