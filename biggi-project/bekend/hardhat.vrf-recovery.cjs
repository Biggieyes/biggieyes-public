// Deliberately no dotenv, private keys, or writable remote network.
require("@nomiclabs/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

const forkUrl = process.env.VRF_RECOVERY_FORK_URL;
const forkBlock = Number(process.env.VRF_RECOVERY_FORK_BLOCK || 94041102);
if (forkUrl && (!Number.isSafeInteger(forkBlock) || forkBlock <= 0)) {
  throw new Error("Invalid VRF_RECOVERY_FORK_BLOCK");
}

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: forkUrl ? {
      chainId: 137,
      hardfork: "shanghai",
      forking: { url: forkUrl, blockNumber: forkBlock },
      chains: { 137: { hardforkHistory: { shanghai: 0 } } },
    } : {},
  },
  solidity: {
    compilers: [{ version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true } }],
  },
  paths: {
    sources: "./contracts/default_workspace (10)/contracts/BIGGI_MASTER",
    tests: "./test/master",
    cache: "./tmp-vrf-recovery-cache",
    artifacts: "./artifacts-master",
  },
  mocha: { timeout: 300000 },
};
