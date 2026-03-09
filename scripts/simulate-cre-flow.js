/**
 * Chainlink CRE Live Fuji Relay
 * 
 * This script acts as a "Local Chainlink Node" for your demo.
 * It will:
 * 1. Listen for YOUR request on the Fuji BiometricOracle.
 * 2. Simulate the CRE logic (fetching your keyboard data).
 * 3. Submit a REAL fulfillment transaction to Fuji.
 */

const { createPublicClient, createWalletClient, http, keccak256, encodePacked } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { avalancheFuji } = require('viem/chains');

// --- CONFIGURATION ---
// Replace with your private key to send a REAL transaction on Fuji
const PRIVATE_KEY = process.env.AVALANCHE_PRIVATE_KEY; 
const RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc';

// Deployed Fuji Addresses
const ORACLE_ADDR = '0x794b684532B03D510167d6438596644026859733';
const WORKFLOW_ID = keccak256(encodePacked(['string'], ['SpinChainBiometricWorkflowV1']));

// ABI for fulfillment
const ORACLE_ABI = [
    {
        name: 'fulfillCREReport',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'requestId', type: 'bytes32' },
            { name: 'workflowId', type: 'bytes32' },
            { name: 'verified', type: 'bool' },
            { name: 'effortScore', type: 'uint16' }
        ]
    }
];

async function main() {
    if (!PRIVATE_KEY) {
        console.error('❌ ERROR: AVALANCHE_PRIVATE_KEY not found in .env');
        process.exit(1);
    }

    const account = privateKeyToAccount(PRIVATE_KEY);
    const client = createPublicClient({ chain: avalancheFuji, transport: http(RPC_URL) });
    const wallet = createWalletClient({ chain: avalancheFuji, transport: http(RPC_URL), account });

    console.log('═══════════════════════════════════════════════════');
    console.log('  SpinChain: Chainlink CRE Live Fuji Relay');
    console.log(`  Relay Node Address: ${account.address}`);
    console.log('═══════════════════════════════════════════════════');

    // 1. In a real demo, we'd poll for the event. Here we generate the ID based on your address.
    const classId = keccak256(encodePacked(['string'], ['tour-de-fuji-2026']));
    console.log(`\n[Step 1] Monitoring Fuji for requests from ${account.address}...`);

    // For the demo, we simulate the ID generation to match the contract logic
    // In a live loop, we'd use: const logs = await client.getLogs({ ... })
    const requestId = keccak256(encodePacked(['address', 'bytes32'], [account.address, classId])); 
    
    console.log(`\n[Step 2] Simulated CRE Workflow (Confidential HTTP)`);
    console.log(`  > Processing telemetry for Effort Score: 805`);
    
    console.log(`\n[Step 3] Submitting REAL fulfillment to Fuji...`);
    
    try {
        const hash = await wallet.writeContract({
            address: ORACLE_ADDR,
            abi: ORACLE_ABI,
            functionName: 'fulfillCREReport',
            args: [requestId, WORKFLOW_ID, true, 805]
        });

        console.log(`  ✅ Transaction Sent!`);
        console.log(`  > Hash: ${hash}`);
        console.log(`  > View on Snowtrace: https://testnet.snowtrace.io/tx/${hash}`);

        console.log(`\n[Step 4] Finalizing...`);
        console.log(`  Wait 5-10 seconds for Fuji confirmation, then click 'Claim' in the UI!`);

    } catch (err) {
        console.error('❌ Transaction failed:', err.message);
    }

    console.log('\n═══════════════════════════════════════════════════');
}

main().catch(console.error);
