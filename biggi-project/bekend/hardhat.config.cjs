// hardhat.config.cjs
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
// pokud používáš toolbox starší verzi místo těchto importů, přidej vhodné pluginy

const { resolve } = require("path");
require("dotenv").config({ path: resolve(__dirname, ".env") });

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
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
    // přidej další sítě pokud potřebuješ
  },

  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
      {
        version: "0.6.6",
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
    ],
    // overrides pro konkrétní soubory (důležité pro node_modules importy a pro tvé lokální Uniswap kopie)
    overrides: {
      // Uniswap V2 periphery / router (pokud importuješ z node_modules)
      "node_modules/@uniswap/v2-periphery/contracts/UniswapV2Router02.sol": {
        version: "0.6.6",
        settings: {},
      },
      "node_modules/@uniswap/v2-core/contracts/UniswapV2Factory.sol": {
        version: "0.6.6",
        settings: {},
      },
      "node_modules/@uniswap/v2-core/contracts/UniswapV2Pair.sol": {
        version: "0.6.6",
        settings: {},
      },

      // Pokud používáš lokální kopie (tvoje cesta s UniswapV2forTEST), přidej i ji:
      // uprav cestu podle skutečné pozice souboru ve tvém projektu
      "contracts/default_workspace (10)/contracts/BIGGIEYESOFFICIALTESTNET/UniswapV2Router02.sol": {
        version: "0.8.24",
        settings: {},
      },

      // Pokud máš i factory/pair ve stejné složce, přidej je taky:
      "contracts/default_workspace (10)/contracts/BIGGIEYESOFFICIALTESTNET/UniswapV2Factory.sol": {
        version: "0.8.24",
      },
      "contracts/default_workspace (10)/contracts/BIGGIEYESOFFICIALTESTNET/BiggiUniswapV2Pair.sol": {
        version: "0.8.24",
      },
    },
  },

  paths: {
    // Oddělený deploy balíček (minimal) — obsahuje pouze kontrakty potřebné pro aktuální deployy.
    sources: "./contracts/default_workspace (10)/contracts/BIGGIEYESOFFICIALTESTNET",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  mocha: {
    timeout: 200000,
  },
};



