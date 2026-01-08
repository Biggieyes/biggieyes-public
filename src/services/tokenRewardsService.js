// src/services/TokenREWARDSService.js
// Ethers v5 service wrapper for BiggiTokenREWARDS-like contract
// - read getters
// - claim (write) methods with gas estimate + buffer
// - batch getAllStats()
// - subscribeOnBlock / unsubscribeOnBlock()
// - bnToString helper (use token decimals from tokenMeta if needed)
// Neprovádím žádné změny v kontraktu (logiku jsem nikde nezasahoval).

import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import { BiggiTokenREWARDS as BiggiTokenREWARDSABI } from "../config/abi/index.js";

const ABI = Array.isArray(BiggiTokenREWARDSABI) ? BiggiTokenREWARDSABI : [];

export default class TokenREWARDSService {
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

  /** Init sanity check (volitelně zavolat) */
  async init() {
    try {
      await this.provider.getNetwork();
      // jednoduchá sanity call
      await this.unitReward();
      return true;
    } catch (e) {
      console.error("TokenREWARDSService.init failed:", e);
      throw e;
    }
  }

  /** Připojí signer pro write operace (claim) */
  connectWithSigner(signer) {
    if (!signer) throw new Error("Signer required");
    this.contract = this.contract.connect(signer);
    this.provider = signer.provider ?? this.provider;
    this._signerConnected = true;
  }

  // --------- View getters (ABI) ---------
  async allowedCOLLECTIONs(addr) {
    return await this.contract.allowedCOLLECTIONs(addr);
  } // bool
  async blockWeight() {
    return await this.contract.blockWeight();
  } // uint8
  async claimablePreview(tokenIds) {
    return await this.contract.claimablePreview(tokenIds);
  } // (units, amount)
  async claimablePreviewFor(COLLECTIONs, tokenIds) {
    return await this.contract.claimablePreviewFor(COLLECTIONs, tokenIds);
  } // (units, amount)
  async currentWeek() {
    return await this.contract.currentWeek();
  } // uint64
  async distributedThisWeek() {
    return await this.contract.distributedThisWeek();
  } // uint256
  async getBlockWeights() {
    return await this.contract.getBlockWeights();
  } // uint8[11]
  async isAllowedCOLLECTION(coll) {
    return await this.contract.isAllowedCOLLECTION(coll);
  } // bool
  async lastRecordedWeek() {
    return await this.contract.lastRecordedWeek();
  } // uint64
  async lastUserClaimWeek(addr) {
    return await this.contract.lastUserClaimWeek(addr);
  } // uint64 (mapping)
  async lastWeekDistributed() {
    return await this.contract.lastWeekDistributed();
  } // uint256
  async main2NFT() {
    return await this.contract.main2NFT();
  } // address
  async mainNFT() {
    return await this.contract.mainNFT();
  } // address
  async nextClaimWeekFor(tokenId) {
    return await this.contract.nextClaimWeekFor(tokenId);
  } // uint64
  async nextClaimWeekForCOLLECTION(COLLECTION, tokenId) {
    return await this.contract.nextClaimWeekForCOLLECTION(COLLECTION, tokenId);
  } // uint64
  async owner() {
    return await this.contract.owner();
  } // address
  async paused() {
    return await this.contract.paused();
  } // bool
  async remainingCap() {
    return await this.contract.remainingCap();
  } // BigNumber
  async REWARDSCap() {
    return await this.contract.REWARDSCap();
  }
  async REWARDSMinted() {
    return await this.contract.REWARDSMinted();
  }
  async REWARDSStats() {
    return await this.contract.REWARDSStats();
  } // (minted, cap_)
  async tokenAddress() {
    return await this.contract.tokenAddress();
  } // address
  async tokenLastClaimWeek(COLLECTION, tokenId) {
    return await this.contract.tokenLastClaimWeek(COLLECTION, tokenId);
  } // uint64 mapping
  async tokenMeta() {
    return await this.contract.tokenMeta();
  } // (name,symbol,decimals)
  async totalDistributed() {
    return await this.contract.totalDistributed();
  } // BigNumber
  async treasure() {
    return await this.contract.treasure();
  } // address
  async unitReward() {
    return await this.contract.unitReward();
  } // BigNumber

  // --------- Write methods (claim) ----------
  // internal tx sender: estimate gas (+ buffer) -> send -> wait(1)
  async _sendTx(methodName, args = [], overrides = {}) {
    if (!this._signerConnected)
      throw new Error(
        "Signer not connected. Call connectWithSigner(signer) first.",
      );
    try {
      const method = this.contract[methodName];
      if (!method)
        throw new Error("Method not found on contract: " + methodName);
      // attempt gas estimate
      let gasEstimate = null;
      try {
        gasEstimate = await this.contract.estimateGas[methodName](
          ...args,
          overrides,
        );
      } catch {
        gasEstimate = null;
      }
      const sendOverrides = gasEstimate
        ? { gasLimit: gasEstimate.mul(120).div(100), ...overrides }
        : overrides;
      const tx = await method(...args, sendOverrides);
      const receipt = await tx.wait(1);
      return receipt;
    } catch (err) {
      // bubble up (frontend can parse)
      console.error(`_sendTx ${methodName} failed:`, err);
      throw err;
    }
  }

  /**
   * claim(tokenIds) - claim z tokenů z hlavní kolekce (klasický use-case)
   * @param {Array<number|string>} tokenIds
   */
  async claim(tokenIds, overrides = {}) {
    return await this._sendTx("claim", [tokenIds], overrides);
  }

  /**
   * claimWithCOLLECTIONs(COLLECTIONs, tokenIds) - multi-COLLECTION claim
   * @param {Array<string>} COLLECTIONs - pole adres kolekcí (1:1 k tokenIds nebo podle kontraktu)
   * @param {Array<number|string>} tokenIds
   */
  async claimWithCOLLECTIONs(COLLECTIONs, tokenIds, overrides = {}) {
    return await this._sendTx(
      "claimWithCOLLECTIONs",
      [COLLECTIONs, tokenIds],
      overrides,
    );
  }

  // --------- Batch helper: getAllStats ----------
  async getAllStats() {
    const calls = [
      this.unitReward(),
      this.REWARDSMinted(),
      this.REWARDSCap(),
      this.remainingCap(),
      this.totalDistributed(),
      this.distributedThisWeek(),
      this.currentWeek(),
      this.lastRecordedWeek(),
      this.lastWeekDistributed(),
      this.getBlockWeights(),
      this.tokenMeta(),
      this.mainNFT(),
      this.main2NFT(),
      this.owner(),
      this.paused(),
      this.treasure(),
    ];
    const [
      unitReward,
      REWARDSMinted,
      REWARDSCap,
      remainingCap,
      totalDistributed,
      distributedThisWeek,
      currentWeek,
      lastRecordedWeek,
      lastWeekDistributed,
      blockWeights,
      tokenMeta,
      mainNFT,
      main2NFT,
      owner,
      paused,
      treasure,
    ] = await Promise.all(calls);

    return {
      unitReward,
      REWARDSMinted,
      REWARDSCap,
      remainingCap,
      totalDistributed,
      distributedThisWeek,
      currentWeek,
      lastRecordedWeek,
      lastWeekDistributed,
      blockWeights,
      tokenMeta,
      mainNFT,
      main2NFT,
      owner,
      paused,
      treasure,
    };
  }

  // --------- Subscribe na nové bloky (callback(blockNumber, stats)) ----------
  subscribeOnBlock(callback) {
    if (this._onBlockHandler) this.unsubscribeOnBlock();
    this._onBlockHandler = async (blockNumber) => {
      try {
        const stats = await this.getAllStats();
        callback(blockNumber, stats);
      } catch (e) {
        console.error("TokenREWARDSService subscribeOnBlock error", e);
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

  // --------- Utilities ----------
  /** formátuje BigNumber podle decimál tokenu (default 18) */
  static async bnToString(bn, decimals = 18) {
    if (!bn) return "0";
    return ethers.utils.formatUnits(bn, decimals);
  }

  /** Convenience: z tokenMeta získat decimals pro formátování */
  static async formatUsingTokenMeta(statsObj) {
    // očekává objekt s tokenMeta polem (name_,symbol_,decimals_)
    const decimals = statsObj?.tokenMeta?.decimals_ ?? 18;
    return {
      unitReward: TokenREWARDSService.bnToString(statsObj.unitReward, decimals),
      REWARDSMinted: TokenREWARDSService.bnToString(
        statsObj.REWARDSMinted,
        decimals,
      ),
      REWARDSCap: TokenREWARDSService.bnToString(statsObj.REWARDSCap, decimals),
      remainingCap: TokenREWARDSService.bnToString(
        statsObj.remainingCap,
        decimals,
      ),
      totalDistributed: TokenREWARDSService.bnToString(
        statsObj.totalDistributed,
        decimals,
      ),
      distributedThisWeek: TokenREWARDSService.bnToString(
        statsObj.distributedThisWeek,
        decimals,
      ),
      // leaving other non-BN fields as-is
      currentWeek: statsObj.currentWeek?.toString?.() ?? statsObj.currentWeek,
      lastRecordedWeek:
        statsObj.lastRecordedWeek?.toString?.() ?? statsObj.lastRecordedWeek,
      lastWeekDistributed: TokenREWARDSService.bnToString(
        statsObj.lastWeekDistributed,
        decimals,
      ),
      blockWeights: statsObj.blockWeights,
      tokenMeta: statsObj.tokenMeta,
      mainNFT: statsObj.mainNFT,
      main2NFT: statsObj.main2NFT,
      owner: statsObj.owner,
      paused: statsObj.paused,
      treasure: statsObj.treasure,
    };
  }
}



