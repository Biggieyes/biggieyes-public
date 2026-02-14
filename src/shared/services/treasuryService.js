// src/services/TreasuryService.js
// Ethers v6 service wrapper for Treasury contract (read-only helpers)
// Usage:
//   const provider = new BrowserProvider(window.ethereum);
//   const svc = new TreasuryService(CONTRACT_ADDRESS, provider);
//   await svc.init();
//   const stats = await svc.getAllStats();

import * as ethers from "ethers";
import {
  ADDR,
  getReserveTreasurySnapshotRO,
} from "@/shared/utils/contract";

export default class TreasuryService {
  /**
   * @param {string} address - treasury contract address
   * @param {ethers.providers.Provider} provider - ethers provider (read-only)
   */
  constructor(address, provider) {
    this.address = address || ADDR.TREASURY;
    this.provider = provider;
    this.contract = null; // legacy placeholder
    this._onBlockHandler = null;
  }

  /** Optional init - sanity checks provider + simple call */
  async init() {
    try {
      if (this.provider) await this.provider.getNetwork();
      return true;
    } catch (e) {
      console.error("TreasuryService.init failed:", e);
      throw e;
    }
  }

  /** Připojí signer (pokud budeš chtít později volat write metody) */
  connectWithSigner(signer) {
    if (!signer) throw new Error("Signer required");
    this.provider = signer.provider ?? this.provider;
  }

  async _snapshot() {
    const reader = getReserveTreasurySnapshotRO();
    return reader.treasurySnapshot();
  }

  // --- GETTERY ---
  async BIGGI() {
    return ADDR.BIGGI;
  } // address
  async biggiBalance() {
    const snap = await this._snapshot();
    return snap.treasuryBiggi;
  } // BigNumber
  async maticBalance() {
    const snap = await this._snapshot();
    return snap.treasuryPol;
  } // BigNumber (wei)
  async totalBiggiReceived() {
    const snap = await this._snapshot();
    return snap.totalBiggiFromBuyback;
  }
  async totalBiggiReceivedFromBUYBACK() {
    const snap = await this._snapshot();
    return snap.totalBiggiFromBuyback;
  }
  async totalMaticReceived() {
    const snap = await this._snapshot();
    return snap.totalPolFromDistributor;
  }
  async totalMaticReceivedFromDistributor() {
    const snap = await this._snapshot();
    return snap.totalPolFromDistributor;
  }

  /**
   * Paralelní načtení všech statistik.
   * Vrací objekt s bigint hodnotami.
   */
  async getAllStats() {
    const snap = await this._snapshot();
    const BIGGI = await this.BIGGI();
    const biggiBalance = snap.treasuryBiggi;
    const maticBalance = snap.treasuryPol;
    const totalBiggiReceived = snap.totalBiggiFromBuyback;
    const totalBiggiReceivedFromBUYBACK = snap.totalBiggiFromBuyback;
    const totalMaticReceived = snap.totalPolFromDistributor;
    const totalMaticReceivedFromDistributor = snap.totalPolFromDistributor;
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
      return ethers.formatUnits(bn, decimals);
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
