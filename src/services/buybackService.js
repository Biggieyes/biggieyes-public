// src/services/BuybackService.js
// Ethers v5 service wrapper for BuybackAgent-like contract (read-only helpers)
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
    name: "autoBuybackEnabled",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "biggiBalance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nativeBalance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
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
    name: "wrappedNative",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "treasury",
    outputs: [
      { internalType: "contract IBiggiTreasury", name: "", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "policy",
    outputs: [
      { internalType: "contract IBiggiPolicy", name: "", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "dripLM",
    outputs: [{ internalType: "contract IDripLM", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "fallbackMinIntervalSec",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "fallbackSwapSlippageBps",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "fallbackTxDeadlineSec",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "lastBuybackAt",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "pathCustom",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalBiggiAcquired",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalNativeReceived",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalNativeSpent",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "paused",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

export default class BuybackService {
  /**
   * @param {string} address - contract address
   * @param {ethers.providers.Provider} provider - ethers v5 provider
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

  /** Volitelný init sanity check (ověří provider + jednoduchý getter) */
  async init() {
    try {
      await this.provider.getNetwork();
      await this.BIGGI();
      return true;
    } catch (e) {
      console.error("BuybackService.init failed:", e);
      throw e;
    }
  }

  /** Připojí signer pokud bude potřeba (pro write v budoucnu) */
  connectWithSigner(signer) {
    if (!signer) throw new Error("Signer required");
    this.contract = this.contract.connect(signer);
    this.provider = signer.provider ?? this.provider;
    this._signerConnected = true;
  }

  // --- getters ---
  async BIGGI() {
    return await this.contract.BIGGI();
  } // address (IERC20)
  async autoBuybackEnabled() {
    return await this.contract.autoBuybackEnabled();
  } // bool
  async biggiBalance() {
    return await this.contract.biggiBalance();
  } // BigNumber
  async nativeBalance() {
    return await this.contract.nativeBalance();
  } // BigNumber (wei)
  async router() {
    return await this.contract.router();
  } // address
  async wrappedNative() {
    return await this.contract.wrappedNative();
  } // address
  async treasury() {
    return await this.contract.treasury();
  } // address
  async policy() {
    return await this.contract.policy();
  } // address
  async dripLM() {
    return await this.contract.dripLM();
  } // address
  async fallbackMinIntervalSec() {
    return await this.contract.fallbackMinIntervalSec();
  } // BigNumber
  async fallbackSwapSlippageBps() {
    return await this.contract.fallbackSwapSlippageBps();
  } // BigNumber
  async fallbackTxDeadlineSec() {
    return await this.contract.fallbackTxDeadlineSec();
  } // BigNumber
  async lastBuybackAt() {
    return await this.contract.lastBuybackAt();
  } // BigNumber (timestamp)
  async pathCustom() {
    return await this.contract.pathCustom();
  } // address[]
  async totalBiggiAcquired() {
    return await this.contract.totalBiggiAcquired();
  } // BigNumber
  async totalNativeReceived() {
    return await this.contract.totalNativeReceived();
  } // BigNumber
  async totalNativeSpent() {
    return await this.contract.totalNativeSpent();
  } // BigNumber
  async paused() {
    return await this.contract.paused();
  } // bool
  async owner() {
    return await this.contract.owner();
  } // address

  /**
   * Paralelní načtení všech důležitých metrík.
   * Vrací objekt s ethers.BigNumber / primitivy.
   */
  async getAllStats() {
    try {
      // Try multicall first (falls back internally if no multicall address configured)
      const iface = new ethers.utils.Interface(ABI);
      const methods = [
        "BIGGI",
        "autoBuybackEnabled",
        "biggiBalance",
        "nativeBalance",
        "router",
        "wrappedNative",
        "treasury",
        "policy",
        "dripLM",
        "fallbackMinIntervalSec",
        "fallbackSwapSlippageBps",
        "fallbackTxDeadlineSec",
        "lastBuybackAt",
        "pathCustom",
        "totalBiggiAcquired",
        "totalNativeReceived",
        "totalNativeSpent",
        "paused",
        "owner",
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
          autoBuybackEnabled,
          biggiBalance,
          nativeBalance,
          router,
          wrappedNative,
          treasury,
          policy,
          dripLM,
          fallbackMinIntervalSec,
          fallbackSwapSlippageBps,
          fallbackTxDeadlineSec,
          lastBuybackAt,
          pathCustom,
          totalBiggiAcquired,
          totalNativeReceived,
          totalNativeSpent,
          paused,
          owner,
        ] = vals;
        return {
          BIGGI,
          autoBuybackEnabled,
          biggiBalance,
          nativeBalance,
          router,
          wrappedNative,
          treasury,
          policy,
          dripLM,
          fallbackMinIntervalSec,
          fallbackSwapSlippageBps,
          fallbackTxDeadlineSec,
          lastBuybackAt,
          pathCustom,
          totalBiggiAcquired,
          totalNativeReceived,
          totalNativeSpent,
          paused,
          owner,
        };
      }
    } catch (e) {
      console.warn(
        "BuybackService multicall failed, falling back to Promise.all",
        e?.message || e,
      );
    }

    // fallback: original parallel calls
    const calls = [
      this.BIGGI(),
      this.autoBuybackEnabled(),
      this.biggiBalance(),
      this.nativeBalance(),
      this.router(),
      this.wrappedNative(),
      this.treasury(),
      this.policy(),
      this.dripLM(),
      this.fallbackMinIntervalSec(),
      this.fallbackSwapSlippageBps(),
      this.fallbackTxDeadlineSec(),
      this.lastBuybackAt(),
      this.pathCustom(),
      this.totalBiggiAcquired(),
      this.totalNativeReceived(),
      this.totalNativeSpent(),
      this.paused(),
      this.owner(),
    ];

    const [
      BIGGI,
      autoBuybackEnabled,
      biggiBalance,
      nativeBalance,
      router,
      wrappedNative,
      treasury,
      policy,
      dripLM,
      fallbackMinIntervalSec,
      fallbackSwapSlippageBps,
      fallbackTxDeadlineSec,
      lastBuybackAt,
      pathCustom,
      totalBiggiAcquired,
      totalNativeReceived,
      totalNativeSpent,
      paused,
      owner,
    ] = await Promise.all(calls);

    return {
      BIGGI,
      autoBuybackEnabled,
      biggiBalance,
      nativeBalance,
      router,
      wrappedNative,
      treasury,
      policy,
      dripLM,
      fallbackMinIntervalSec,
      fallbackSwapSlippageBps,
      fallbackTxDeadlineSec,
      lastBuybackAt,
      pathCustom,
      totalBiggiAcquired,
      totalNativeReceived,
      totalNativeSpent,
      paused,
      owner,
    };
  }

  /**
   * Subscribe na nové bloky; callback(blockNumber, stats)
   * Pozor: getAllStats() se volá každý blok -> heavy. Doporučuju throttle/polling v produkci.
   */
  subscribeOnBlock(callback) {
    if (this._onBlockHandler) this.unsubscribeOnBlock();
    this._onBlockHandler = async (blockNumber) => {
      try {
        const stats = await this.getAllStats();
        callback(blockNumber, stats);
      } catch (e) {
        console.error("BuybackService subscribeOnBlock handler error", e);
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

  /** Helper: převod BigNumber -> string (default 18 decimals) */
  static bnToString(bn, decimals = 18) {
    if (!bn) return "0";
    try {
      return ethers.utils.formatUnits(bn, decimals);
    } catch {
      return bn.toString();
    }
  }

  /** Formátované shrnutí stringů pro UI (tokeny podle 18 decimál) */
  static formatSummary(stats) {
    const decimals = 18;
    return {
      biggiToken: stats.BIGGI,
      autoBuybackEnabled: stats.autoBuybackEnabled,
      biggiBalance: BuybackService.bnToString(stats.biggiBalance, decimals),
      nativeBalanceEth: BuybackService.bnToString(
        stats.nativeBalance,
        decimals,
      ),
      router: stats.router,
      wrappedNative: stats.wrappedNative,
      treasury: stats.treasury,
      policy: stats.policy,
      dripLM: stats.dripLM,
      fallbackMinIntervalSec: stats.fallbackMinIntervalSec?.toString?.(),
      fallbackSwapSlippageBps: stats.fallbackSwapSlippageBps?.toString?.(),
      fallbackTxDeadlineSec: stats.fallbackTxDeadlineSec?.toString?.(),
      lastBuybackAt: stats.lastBuybackAt?.toString?.(),
      pathCustom: stats.pathCustom,
      totalBiggiAcquired: BuybackService.bnToString(
        stats.totalBiggiAcquired,
        decimals,
      ),
      totalNativeReceived: BuybackService.bnToString(
        stats.totalNativeReceived,
        decimals,
      ),
      totalNativeSpent: BuybackService.bnToString(
        stats.totalNativeSpent,
        decimals,
      ),
      paused: stats.paused,
      owner: stats.owner,
    };
  }
}

