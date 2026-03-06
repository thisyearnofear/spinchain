/**
 * @type {import('hardhat/config').HardhatUserConfig}
 */
require("@nomicfoundation/hardhat-toolbox");

const fs = require('fs');
const path = require('path');

// Load private key from .env file (supports KEY=value or bare hex formats)
function loadPrivateKey() {
  const envPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found. Create contracts/evm/.env with AVALANCHE_PRIVATE_KEY=<your-key>');
  }
  const raw = fs.readFileSync(envPath, 'utf8').trim();
  // Support "KEY=value" format
  const match = raw.match(/AVALANCHE_PRIVATE_KEY\s*=\s*([0-9a-fA-F]{64})/);
  const hex = match ? match[1] : raw.replace(/^0x/, '');
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`Invalid private key in .env (expected 64 hex chars, got ${hex.length} chars)`);
  }
  return '0x' + hex;
}

const privateKey = loadPrivateKey();

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    fuji: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: [privateKey],
    },
  },
};
