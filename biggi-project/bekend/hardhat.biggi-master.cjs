require("@nomiclabs/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");

const { resolve } = require("path");
require("dotenv").config({ path: resolve(__dirname, ".env") });

const forkBlockNumber = process.env.FORK_BLOCK_NUMBER ? Number(process.env.FORK_BLOCK_NUMBER) : undefined;
if (process.env.FORK_BLOCK_NUMBER && !Number.isInteger(forkBlockNumber)) {
  throw new Error(`Invalid FORK_BLOCK_NUMBER: ${process.env.FORK_BLOCK_NUMBER}`);
}

const hardhatNetwork = process.env.FORK_URL
  ? {
      chainId: 137,
      hardfork: "shanghai",
      forking: {
        url: process.env.FORK_URL,
        ...(Number.isInteger(forkBlockNumber) ? { blockNumber: forkBlockNumber } : {}),
      },
      chains: {
        137: {
          // Hardhat has no built-in Polygon history. Treat the forked state as
          // Shanghai-compatible so EDR can execute calls at the fork block.
          hardforkHistory: { shanghai: 0 },
        },
      },
    }
  : {};

const explorerApiKey =
  process.env.ETHERSCAN_API_KEY ||
  process.env.EXPLORER_API_KEY ||
  "";

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: hardhatNetwork,
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon.drpc.org",
      chainId: 137,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true,
        },
      },
    ],
  },
  paths: {
    sources: "./contracts/default_workspace (10)/contracts/BIGGI_MASTER",
    tests: "./test/master",
    cache: "./cache-master",
    artifacts: "./artifacts-master",
  },
  mocha: {
    timeout: 300000,
  },
  etherscan: {
    enabled: explorerApiKey !== "",
    apiKey: explorerApiKey,
  },
  sourcify: {
    enabled: process.env.DISABLE_SOURCIFY_VERIFY !== "1",
  },
};
