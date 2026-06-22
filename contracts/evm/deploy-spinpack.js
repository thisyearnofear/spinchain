// Deploy script for SpinPack ERC-1155
// Usage: AVALANCHE_PRIVATE_KEY=0x... node deploy-spinpack.js
const { ethers } = require("ethers");

async function main() {
  const privateKey = process.env.AVALANCHE_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("AVALANCHE_PRIVATE_KEY is required.");
  }

  const provider = new ethers.providers.JsonRpcProvider(
    "https://api.avax-test.network/ext/bc/C/rpc"
  );
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deploying SpinPack with deployer:", wallet.address);

  const abi = [
    "constructor(string memory uri_, address revenueRecipient)",
  ];
  const bytecode = require("./compiled/SpinPack.json").bytecode;

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);

  const uri = "https://app.spinchain.xyz/api/spinpack/";
  const revenueRecipient = wallet.address;

  console.log("Deploying SpinPack...");
  const spinPack = await factory.deploy(uri, revenueRecipient);
  await spinPack.deployed();

  console.log("SpinPack deployed to:", spinPack.address);
  console.log("Add to .env.local:");
  console.log(`NEXT_PUBLIC_SPIN_PACK_ADDRESS=${spinPack.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
