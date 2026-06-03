// Simple deployment script without Hardhat
// Channel settlement is now consolidated into IncentiveEngine — see
// contracts/evm/src/deploy.s.sol (Foundry script) as the canonical deployer.
//
// SECURITY: The previous version of this file hardcoded a 64-hex private key
// in source. That key was a Fuji testnet deployer and has been removed from
// this script. Use AVALANCHE_PRIVATE_KEY (or HARDHAT_NETWORK signer config)
// to provide a key at runtime. The leaked key should be considered public and
// any funds it controls should be rotated.
const { ethers } = require("ethers");

async function main() {
  // Read the deployer key from the environment. Hard error if missing so a
  // misconfigured run cannot fall back to a baked-in key.
  const privateKey = process.env.AVALANCHE_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "AVALANCHE_PRIVATE_KEY is required. Set it in your shell or .env " +
      "before running this script. Do not commit private keys to source."
    );
  }

  // Create a provider for Avalanche Fuji
  const provider = new ethers.providers.JsonRpcProvider(
    "https://api.avax-test.network/ext/bc/C/rpc"
  );

  const wallet = new ethers.Wallet(privateKey, provider);

  // Get the contract factories
  const SpinToken = await ethers.getContractFactory("SpinToken");
  const IncentiveEngine = await ethers.getContractFactory("IncentiveEngine");
  const ClassFactory = await ethers.getContractFactory("ClassFactory");
  const MockUltraVerifier = await ethers.getContractFactory("MockUltraVerifier");
  const EffortThresholdVerifier = await ethers.getContractFactory("EffortThresholdVerifier");
  const TreasurySplitter = await ethers.getContractFactory("TreasurySplitter");
  const BiometricOracle = await ethers.getContractFactory("BiometricOracle");

  // Deploy contracts
  console.log("Deploying MockUltraVerifier...");
  const mockUltraVerifier = await MockUltraVerifier.connect(wallet).deploy();
  await mockUltraVerifier.deployed();
  console.log(`MockUltraVerifier deployed to: ${mockUltraVerifier.address}`);

  console.log("Deploying SpinToken...");
  const spinToken = await SpinToken.connect(wallet).deploy();
  await spinToken.deployed();
  console.log(`SpinToken deployed to: ${spinToken.address}`);

  console.log("Deploying EffortThresholdVerifier...");
  const effortThresholdVerifier = await EffortThresholdVerifier.connect(wallet).deploy(mockUltraVerifier.address);
  await effortThresholdVerifier.deployed();
  console.log(`EffortThresholdVerifier deployed to: ${effortThresholdVerifier.address}`);

  console.log("Deploying IncentiveEngine...");
  const incentiveEngine = await IncentiveEngine.connect(wallet).deploy(
    spinToken.address,
    mockUltraVerifier.address,
    effortThresholdVerifier.address
  );
  await incentiveEngine.deployed();
  console.log(`IncentiveEngine deployed to: ${incentiveEngine.address}`);

  console.log("Deploying TreasurySplitter...");
  const treasurySplitter = await TreasurySplitter.connect(wallet).deploy();
  await treasurySplitter.deployed();
  console.log(`TreasurySplitter deployed to: ${treasurySplitter.address}`);

  console.log("Deploying BiometricOracle...");
  const biometricOracle = await BiometricOracle.connect(wallet).deploy();
  await biometricOracle.deployed();
  console.log(`BiometricOracle deployed to: ${biometricOracle.address}`);

  // YellowSettlement removed — channel settlement now lives in IncentiveEngine
  // (submitChannelProof / batchSubmitChannelProof).

  console.log("Deploying ClassFactory...");
  const classFactory = await ClassFactory.connect(wallet).deploy();
  await classFactory.deployed();
  console.log(`ClassFactory deployed to: ${classFactory.address}`);

  // Transfer ownership of SpinToken to IncentiveEngine
  console.log("Transferring SpinToken ownership to IncentiveEngine...");
  await spinToken.connect(wallet).transferOwnership(incentiveEngine.address);

  // Set biometric oracle in IncentiveEngine
  console.log("Setting biometric oracle in IncentiveEngine...");
  await incentiveEngine.connect(wallet).setBiometricOracle(biometricOracle.address);

  // Output all addresses for environment variables
  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("NEXT_PUBLIC_SPIN_TOKEN_ADDRESS=", spinToken.address);
  console.log("NEXT_PUBLIC_INCENTIVE_ENGINE_ADDRESS=", incentiveEngine.address);
  console.log("NEXT_PUBLIC_CLASS_FACTORY_ADDRESS=", classFactory.address);
  console.log("NEXT_PUBLIC_MOCK_ULTRA_VERIFIER_ADDRESS=", mockUltraVerifier.address);
  console.log("NEXT_PUBLIC_EFFORT_THRESHOLD_VERIFIER_ADDRESS=", effortThresholdVerifier.address);
  console.log("NEXT_PUBLIC_TREASURY_SPLITTER_ADDRESS=", treasurySplitter.address);
  console.log("NEXT_PUBLIC_BIOMETRIC_ORACLE_ADDRESS=", biometricOracle.address);
  // Note: no NEXT_PUBLIC_YELLOW_SETTLEMENT_ADDRESS — channel settlement is
  // now an IncentiveEngine function.
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });