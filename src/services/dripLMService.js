// src/services/DRIPLMService.js
// Ethers v5 service wrapper for DRIPLM (read-only helpers + signer-ready)
// Neprovádím žádné změny v kontraktu.

import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import { multicallAggregate } from "../utils/multicall";

const ABI = [
  {
    inputs: [],
    name: "BIGGI",
    outputs: [{ internalType: "contract IERC20", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "BUYBACKAgent",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "DRIPDistributor",
    outputs: [
      { internalType: "contract IDRIPDistributor", name: "", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "reserve",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "router",
    outputs: [
      {
        internalType: "contract IUniswapV2Router02",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "sellPct",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "slippageBps",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "txDeadlineSec",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

export default class DRIPLMService {
  /**
   * @param {string} address - DRIPLM contract address
   * @param {ethers.providers.Provider} provider - ethers v5 provider (read-only)
   */
  constructor(address, provider) {
    if (!address) throw new Error("Contract address required");
    if (!provider) throw new Error("Provider required");
    this.address = address;
    this.provider = provider;
    this.contract = new Contract(address, ABI, provider);
    this._onBlockHandler = null;
    this._signerConnected = false;
  }

  /** Volitelný init sanity check */
  async init() {
    try {
      await this.provider.getNetwork();
      // jednoduchý sanity call
      await this.BIGGI();
      return true;
    } catch (e) {
      console.error("DRIPLMService.init failed:", e);
      throw e;
    }
  }

  /** Připojí signer pro případné write operace (pokud přidáš ABI write funkcí později) */
  connectWithSigner(signer) {
    if (!signer) throw new Error("Signer required");
    this.contract = this.contract.connect(signer);
    this.provider = signer.provider ?? this.provider;
    this._signerConnected = true;
  }

  // -------- GETTERY (ABI) --------
  async BIGGI() {
    return await this.contract.BIGGI();
  } // address
  async BUYBACKAgent() {
    return await this.contract.BUYBACKAgent();
  } // address
  async DRIPDistributor() {
    return await this.contract.DRIPDistributor();
  } // address
  async reserve() {
    return await this.contract.reserve();
  } // address
  async router() {
    return await this.contract.router();
  } // address
  async sellPct() {
    return await this.contract.sellPct();
  } // uint8
  async slippageBps() {
    return await this.contract.slippageBps();
  } // BigNumber
  async txDeadlineSec() {
    return await this.contract.txDeadlineSec();
  } // BigNumber

  /**
   * Paralelní načtení hlavních metrik pro dashboard.
   * Vrací objekt s ethers.BigNumber/primitive hodnotami.
   */
  async getAllStats() {
    try {
      const iface = new ethers.utils.Interface(ABI);
      const methods = [
        "BIGGI",
        "BUYBACKAgent",
        "DRIPDistributor",
        "reserve",
        "router",
        "sellPct",
        "slippageBps",
        "txDeadlineSec",
      ];
      const calls = methods.map((m) => ({
        target: this.address,
        iface,
        method: m,
      }));
      const decoded = await multicallAggregate(this.provider, calls).catch(
        () => null,
      );
      if (decoded && decoded.length === methods.length) {
        const vals = decoded.map((d) =>
          Array.isArray(d) && d.length === 1 ? d[0] : d,
        );
        const [
          BIGGI,
          BUYBACKAgent,
          DRIPDistributor,
          reserve,
          router,
          sellPct,
          slippageBps,
          txDeadlineSec,
        ] = vals;
        return {
          BIGGI,
          BUYBACKAgent,
          DRIPDistributor,
          reserve,
          router,
          sellPct,
          slippageBps,
          txDeadlineSec,
        };
      }
    } catch (e) {
      console.warn(
        "DRIPLMService multicall failed, falling back",
        e?.message || e,
      );
    }

    const calls = [
      this.BIGGI(),
      this.BUYBACKAgent(),
      this.DRIPDistributor(),
      this.reserve(),
      this.router(),
      this.sellPct(),
      this.slippageBps(),
      this.txDeadlineSec(),
    ];

    const [
      BIGGI,
      BUYBACKAgent,
      DRIPDistributor,
      reserve,
      router,
      sellPct,
      slippageBps,
      txDeadlineSec,
    ] = await Promise.all(calls);

    return {
      BIGGI,
      BUYBACKAgent,
      DRIPDistributor,
      reserve,
      router,
      sellPct,
      slippageBps,
      txDeadlineSec,
    };
  }

  /**
   * Subscribe na nové bloky; callback(blockNumber, stats)
   * Upozornění: getAllStats() se volá každý blok -> heavy. Raději polling 5–10s v produkci.
   */
  subscribeOnBlock(callback) {
    if (this._onBlockHandler) this.unsubscribeOnBlock();
    this._onBlockHandler = async (blockNumber) => {
      try {
        const stats = await this.getAllStats();
        callback(blockNumber, stats);
      } catch (e) {
        console.error("DRIPLMService subscribeOnBlock handler error", e);
      }
    };
    this.provider.on("block", this._onBlockHandler);
  }

  unsubscribeOnBlock() {
    if (this._onBlockHandler) {
      this.provider.off("block", this._onBlockHandler);
      this._onBlockHandler = null;
    }
  }

  // -------- Utility helpers --------
  /** Convert BigNumber -> readable string. Default decimals = 18. */
  static bnToString(bn, decimals = 18) {
    if (bn === undefined || bn === null) return "0";
    try {
      return ethers.utils.formatUnits(bn, decimals);
    } catch {
      return bn.toString();
    }
  }

  /** Lightweight UI summary formatting (stringified values) */
  static formatSummary(stats) {
    return {
      biggiToken: stats.BIGGI,
      BUYBACKAgent: stats.BUYBACKAgent,
      DRIPDistributor: stats.DRIPDistributor,
      reserve: stats.reserve,
      router: stats.router,
      sellPct: stats.sellPct?.toString?.() ?? stats.sellPct,
      slippageBps: stats.slippageBps?.toString?.() ?? stats.slippageBps,
      txDeadlineSec: stats.txDeadlineSec?.toString?.() ?? stats.txDeadlineSec,
    };
  }
}



