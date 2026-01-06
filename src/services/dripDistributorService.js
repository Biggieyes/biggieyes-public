// src/services/DripDistributorService.js
// Ethers v5 service wrapper for DripDistributor-like contract
import { ethers } from "ethers";
import { multicallAggregate } from "../utils/multicall";

/**
 * DripDistributorService
 * - čte read-only hodnoty z kontraktu
 * - umožňuje připojit signer pro případné write operace později
 * - obsahuje helpery: batch getters, subscribeOnBlock (simple polling via provider block event)
 *
 * Použití (quick):
 *  const provider = new ethers.providers.Web3Provider(window.ethereum);
 *  const svc = new DripDistributorService(CONTRACT_ADDRESS, provider);
 *  await svc.init(); // nepovinné, ale ověří připojení
 *  const cap = await svc.CAP();
 *
 * Poznámky:
 * - Nepřepisuje žádnou logiku kontraktu.
 * - Pokud chceš TypeScript variantu, napiš a přepíšu.
 */

// --- vlož ABI sem ---
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
    name: "CAP",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "availableTokens",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "capRemaining",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "tokensPerMint",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAvailable",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalClaimed",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalNotified",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalTopUp",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalClaimed",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalNotified",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalTopUp",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "dripLM",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "treasury",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "a", type: "address" }],
    name: "isCollection",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
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
];

export default class DripDistributorService {
  /**
   * @param {string} address - kontraktová adresa
   * @param {ethers.providers.Provider} provider - ethers v5 provider (read-only)
   */
  constructor(address, provider) {
    if (!address) throw new Error("Contract address required");
    if (!provider) throw new Error("Provider required");
    this.address = address;
    this.provider = provider;
    this.contract = new ethers.Contract(address, ABI, provider);
    this._onBlockHandler = null;
  }

  /** volitelně zavolat, aby se ověřilo připojení (vrací true pokud OK) */
  async init() {
    try {
      await this.provider.getNetwork(); // ověření provideru
      // jednoduchá call sanity check (CAP)
      await this.CAP();
      return true;
    } catch (e) {
      console.error("DripDistributorService.init failed:", e);
      throw e;
    }
  }

  /** Připojí signer (pro případné write operace později) */
  connectWithSigner(signer) {
    if (!signer) throw new Error("Signer required");
    this.contract = this.contract.connect(signer);
    this.provider = signer.provider ?? this.provider;
  }

  // --- jednotlivé read-gettery (odpovídají ABI) ---
  async BIGGI() {
    return await this.contract.BIGGI();
  }
  async CAP() {
    return await this.contract.CAP();
  }
  async availableTokens() {
    return await this.contract.availableTokens();
  }
  async capRemaining() {
    return await this.contract.capRemaining();
  }
  async tokensPerMint() {
    return await this.contract.tokensPerMint();
  }
  async getAvailable() {
    return await this.contract.getAvailable();
  }
  async getTotalClaimed() {
    return await this.contract.getTotalClaimed();
  }
  async getTotalNotified() {
    return await this.contract.getTotalNotified();
  }
  async getTotalTopUp() {
    return await this.contract.getTotalTopUp();
  }
  async totalClaimed() {
    return await this.contract.totalClaimed();
  }
  async totalNotified() {
    return await this.contract.totalNotified();
  }
  async totalTopUp() {
    return await this.contract.totalTopUp();
  }
  async dripLM() {
    return await this.contract.dripLM();
  }
  async treasury() {
    return await this.contract.treasury();
  }
  async isCollection(addr) {
    return await this.contract.isCollection(addr);
  }
  async paused() {
    return await this.contract.paused();
  }

  /**
   * Rychlé načtení většiny statistik paralelně.
   * Vrací objekt s poli (bignumbers jako ethers.BigNumber).
   */
  async getAllStats() {
    try {
      const iface = new ethers.utils.Interface(ABI);
      const methods = [
        "CAP",
        "availableTokens",
        "capRemaining",
        "tokensPerMint",
        "getAvailable",
        "getTotalClaimed",
        "getTotalNotified",
        "getTotalTopUp",
        "totalClaimed",
        "totalNotified",
        "totalTopUp",
        "dripLM",
        "treasury",
        "paused",
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
          CAP,
          availableTokens,
          capRemaining,
          tokensPerMint,
          getAvailable,
          getTotalClaimed,
          getTotalNotified,
          getTotalTopUp,
          totalClaimed,
          totalNotified,
          totalTopUp,
          dripLM,
          treasury,
          paused,
        ] = vals;
        return {
          CAP,
          availableTokens,
          capRemaining,
          tokensPerMint,
          getAvailable,
          getTotalClaimed,
          getTotalNotified,
          getTotalTopUp,
          totalClaimed,
          totalNotified,
          totalTopUp,
          dripLM,
          treasury,
          paused,
        };
      }
    } catch (e) {
      console.warn(
        "DripDistributorService multicall failed, falling back",
        e?.message || e,
      );
    }

    const calls = [
      this.CAP(),
      this.availableTokens(),
      this.capRemaining(),
      this.tokensPerMint(),
      this.getAvailable(),
      this.getTotalClaimed(),
      this.getTotalNotified(),
      this.getTotalTopUp(),
      this.totalClaimed(),
      this.totalNotified(),
      this.totalTopUp(),
      this.dripLM(),
      this.treasury(),
      this.paused(),
    ];
    const [
      CAP,
      availableTokens,
      capRemaining,
      tokensPerMint,
      getAvailable,
      getTotalClaimed,
      getTotalNotified,
      getTotalTopUp,
      totalClaimed,
      totalNotified,
      totalTopUp,
      dripLM,
      treasury,
      paused,
    ] = await Promise.all(calls);
    return {
      CAP,
      availableTokens,
      capRemaining,
      tokensPerMint,
      getAvailable,
      getTotalClaimed,
      getTotalNotified,
      getTotalTopUp,
      totalClaimed,
      totalNotified,
      totalTopUp,
      dripLM,
      treasury,
      paused,
    };
  }

  /**
   * Subscribes to provider 'block' events and zavolá callback on each new block.
   * callback receives (blockNumber, stats) where stats = await getAllStats()
   * - Pozor: volá getAllStats každé bloky => může být heavy. Použij s rozumem.
   */
  subscribeOnBlock(callback) {
    if (this._onBlockHandler) this.unsubscribeOnBlock();
    this._onBlockHandler = async (blockNumber) => {
      try {
        const stats = await this.getAllStats();
        callback(blockNumber, stats);
      } catch (e) {
        console.error("subscribeOnBlock handler error", e);
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

  /** Utility: převod BigNumber -> decimal string (pokud chceš) */
  static bnToString(bn, decimals = 18) {
    if (!bn) return "0";
    return ethers.utils.formatUnits(bn, decimals);
  }
}
