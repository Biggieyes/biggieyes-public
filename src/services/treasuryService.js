// src/services/TreasuryService.js
// Ethers v5 service wrapper for Treasury contract (read-only helpers)
// Usage:
//   const provider = new BrowserProvider(window.ethereum);
//   const svc = new TreasuryService(CONTRACT_ADDRESS, provider);
//   await svc.init();
//   const stats = await svc.getAllStats();

import * as ethers from "ethers";
import { BiggiTreasury as TreasuryAbi } from "../config/abi/index.js";

const ABI = TreasuryAbi;

export default class TreasuryService {
  /**
   * @param {string} address - treasury contract address
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

  /** Optional init - sanity checks provider + simple call */
  async init() {
    try {
      await this.provider.getNetwork();
      // sanity call
      await this.biggiBalance();
      return true;
    } catch (e) {
      console.error("TreasuryService.init failed:", e);
      throw e;
    }
  }

  /** Připojí signer (pokud budeš chtít později volat write metody) */
  connectWithSigner(signer) {
    if (!signer) throw new Error("Signer required");
    this.contract = this.contract.connect(signer);
    this.provider = signer.provider ?? this.provider;
  }

  // --- GETTERY ---
  async BIGGI() {
    return await this.contract.BIGGI();
  } // address
  async biggiBalance() {
    return await this.contract.biggiBalance();
  } // BigNumber
  async maticBalance() {
    return await this.contract.maticBalance();
  } // BigNumber (wei)
  async totalBiggiReceived() {
    return await this.contract.totalBiggiReceived();
  }
  async totalBiggiReceivedFromBUYBACK() {
    return await this.contract.totalBiggiReceivedFromBuyback();
  }
  async totalMaticReceived() {
    return await this.contract.totalMaticReceived();
  }
  async totalMaticReceivedFromDistributor() {
    return await this.contract.totalMaticReceivedFromDistributor();
  }

  /**
   * Paralelní načtení všech statistik.
   * Vrací objekt s ethers.BigNumber hodnotami.
   */
  async getAllStats() {
    const calls = [
      this.BIGGI(),
      this.biggiBalance(),
      this.maticBalance(),
      this.totalBiggiReceived(),
      this.totalBiggiReceivedFromBUYBACK(),
      this.totalMaticReceived(),
      this.totalMaticReceivedFromDistributor(),
    ];
    const [
      BIGGI,
      biggiBalance,
      maticBalance,
      totalBiggiReceived,
      totalBiggiReceivedFromBUYBACK,
      totalMaticReceived,
      totalMaticReceivedFromDistributor,
    ] = await Promise.all(calls);

    return {
      BIGGI,
      biggiBalance,
      maticBalance,
      totalBiggiReceived,
      totalBiggiReceivedFromBUYBACK,
      totalMaticReceived,
      totalMaticReceivedFromDistributor,
    };
  }

  /**
   * Subscribe na nové bloky. callback(blockNumber, stats)
   * Upozornění: getAllStats() se volá každým blokem => může být heavy.
   * Doporučuju throttling nebo polling každých X sekund pro produkci.
   */
  subscribeOnBlock(callback) {
    if (this._onBlockHandler) this.unsubscribeOnBlock();
    this._onBlockHandler = async (blockNumber) => {
      try {
        const stats = await this.getAllStats();
        callback(blockNumber, stats);
      } catch (e) {
        console.error("TreasuryService subscribeOnBlock error", e);
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

  /** Utility: převod BigNumber -> string (default 18 decimál) */
  static bnToString(bn, decimals = 18) {
    if (!bn) return "0";
    try {
      return ethers.utils.formatUnits(bn, decimals);
    } catch {
      return bn.toString();
    }
  }

  /** Rychlý formátovaný summary (stringy) */
  static formatSummary(stats) {
    return {
      biggiToken: stats.BIGGI,
      biggiBalance: TreasuryService.bnToString(stats.biggiBalance, 18),
      maticBalanceEth: TreasuryService.bnToString(stats.maticBalance, 18),
      totalBiggiReceived: TreasuryService.bnToString(
        stats.totalBiggiReceived,
        18,
      ),
      totalBiggiReceivedFromBUYBACK: TreasuryService.bnToString(
        stats.totalBiggiReceivedFromBUYBACK,
        18,
      ),
      totalMaticReceived: TreasuryService.bnToString(
        stats.totalMaticReceived,
        18,
      ),
      totalMaticReceivedFromDistributor: TreasuryService.bnToString(
        stats.totalMaticReceivedFromDistributor,
        18,
      ),
    };
  }
}
