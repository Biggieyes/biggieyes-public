// src/services/TokenRewardsService.js
// Ethers v6 service wrapper for BiggiTokenRewards-like contract
// - read getters
// - claim (write) methods with gas estimate + buffer
// - batch getAllStats()
// - subscribeOnBlock / unsubscribeOnBlock()
// - bnToString helper (use token decimals from tokenMeta if needed)
// Neprovádím žádné změny v kontraktu (logiku jsem nikde nezasahoval).

import * as ethers from "ethers";
import { BiggiTokenRewards as BiggiTokenRewardsABI } from "@/config/abi/index.js";

const ABI = Array.isArray(BiggiTokenRewardsABI) ? BiggiTokenRewardsABI : [];
const withGasBuffer = (gas, pct = 120) => {
  if (gas == null) return null;
  if (typeof gas === "bigint") return (gas * BigInt(pct)) / 100n;
  if (gas?._isBigNumber && typeof gas.mul === "function")
    return gas.mul(pct).div(100);
  try {
    return (BigInt(gas) * BigInt(pct)) / 100n;
  } catch {
    return gas;
  }
};

export default class TokenRewardsService {
  /**
   * @param {string} address - contract address
   * @param {ethers.providers.Provider} provider - ethers provider
   */
  constructor(address, provider) {
    if (!address) throw new Error("Contract address required");
    if (!provider) throw new Error("Provider required");
    this.address = address;
    this.provider = provider;
    this.contract = new ethers.Contract(address, ABI, provider);
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
      console.error("TokenRewardsService.init failed:", e);
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
  async allowedCollections(addr) {
    return await this.contract.allowedCollections(addr);
  } // bool
  async allowedCOLLECTIONs(addr) {
    return await this.allowedCollections(addr);
  } // legacy alias
  async blockWeight(index) {
    if (index == null) return await this.getBlockWeights();
    return await this.contract.blockWeight(index);
  } // uint8 | uint8[11]
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
  async isAllowedCollection(coll) {
    return await this.contract.isAllowedCollection(coll);
  } // bool
  async isAllowedCOLLECTION(coll) {
    return await this.isAllowedCollection(coll);
  } // legacy alias
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
  async nextClaimWeekForCollection(collection, tokenId) {
    return await this.contract.nextClaimWeekForCollection(collection, tokenId);
  } // uint64
  async nextClaimWeekForCOLLECTION(collection, tokenId) {
    return await this.nextClaimWeekForCollection(collection, tokenId);
  } // legacy alias
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
    return await this.contract.rewardsCap();
  }
  async REWARDSMinted() {
    return await this.contract.rewardsMinted();
  }
  async REWARDSStats() {
    return await this.contract.rewardsStats();
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
      const gasLimit = withGasBuffer(gasEstimate);
      const sendOverrides = gasLimit
        ? { gasLimit, ...overrides }
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
  async claimWithCollections(collections, tokenIds, overrides = {}) {
    return await this._sendTx(
      "claimWithCollections",
      [collections, tokenIds],
      overrides,
    );
  }
  async claimWithCOLLECTIONs(collections, tokenIds, overrides = {}) {
    return await this.claimWithCollections(collections, tokenIds, overrides);
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
        console.error("TokenRewardsService subscribeOnBlock error", e);
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
    return ethers.formatUnits(bn, decimals);
  }

  /** Convenience: z tokenMeta získat decimals pro formátování */
  static async formatUsingTokenMeta(statsObj) {
    // očekává objekt s tokenMeta polem (name_,symbol_,decimals_)
    const decimals = statsObj?.tokenMeta?.decimals_ ?? 18;
    return {
      unitReward: TokenRewardsService.bnToString(statsObj.unitReward, decimals),
      REWARDSMinted: TokenRewardsService.bnToString(
        statsObj.REWARDSMinted,
        decimals,
      ),
      REWARDSCap: TokenRewardsService.bnToString(statsObj.REWARDSCap, decimals),
      remainingCap: TokenRewardsService.bnToString(
        statsObj.remainingCap,
        decimals,
      ),
      totalDistributed: TokenRewardsService.bnToString(
        statsObj.totalDistributed,
        decimals,
      ),
      distributedThisWeek: TokenRewardsService.bnToString(
        statsObj.distributedThisWeek,
        decimals,
      ),
      // leaving other non-BN fields as-is
      currentWeek: statsObj.currentWeek?.toString?.() ?? statsObj.currentWeek,
      lastRecordedWeek:
        statsObj.lastRecordedWeek?.toString?.() ?? statsObj.lastRecordedWeek,
      lastWeekDistributed: TokenRewardsService.bnToString(
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
