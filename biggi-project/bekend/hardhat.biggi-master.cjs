require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");

const { resolve } = require("path");
require("dotenv").config({ path: resolve(__dirname, ".env") });

const forkBlockNumber = process.env.FORK_BLOCK_NUMBER ? Number(process.env.FORK_BLOCK_NUMBER) : undefined;
if (process.env.FORK_BLOCK_NUMBER && !Number.isInteger(forkBlockNumber)) {
  throw new Error(`Invalid FORK_BLOCK_NUMBER: ${process.env.FORK_BLOCK_NUMBER}`);
}

const hardhatNetwork = process.env.FORK_URL
  ? {
      forking: {
        url: process.env.FORK_URL,
        ...(Number.isInteger(forkBlockNumber) ? { blockNumber: forkBlockNumber } : {}),
      },
    }
  : {};

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: hardhatNetwork,
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://polygon-amoy-bor.publicnode.com",
      chainId: 80002,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
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
};
