// src/services/NFTREWARDSService.js
// Ethers v6 service wrapper for NFTREWARDS (viewer + claim wrapper)
// - read getters mapují ABI
// - claim(rewardId) (write) s gas estimate + buffer + wait(1)
// - batch helpers: getAllStats(), fetchEventsDetailed(), fetchREWARDSRange(), fetchUserAssignedREWARDS()
// - subscribeOnBlock / unsubscribeOnBlock()
// - connectWithSigner() připravené pro write operace
// NEZměnil jsem žádnou logiku kontraktu.

import * as ethers from "ethers";
import { BiggiNftRewards as ABI } from "@/config/abi/index.js";

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

export default class NFTREWARDSService {
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

  /** Init sanity check (volitelně) */
  async init() {
    try {
      await this.provider.getNetwork();
      await this.name();
      return true;
    } catch (e) {
      console.error("NFTREWARDSService.init failed:", e);
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

  // ----------- Read getters -----------
  async balanceOf(ownerAddr) {
    return await this.contract.balanceOf(ownerAddr);
  }
  async ownerOf(tokenId) {
    return await this.contract.ownerOf(tokenId);
  }
  async name() {
    return await this.contract.name();
  }
  async symbol() {
    return await this.contract.symbol();
  }
  async tokenURI(tokenId) {
    return await this.contract.tokenURI(tokenId);
  }
  async supportsInterface(interfaceId) {
    return await this.contract.supportsInterface(interfaceId);
  }

  // REWARDS state
  async assignedTo(rewardId) {
    return await this.contract.assignedTo(rewardId);
  }
  async claimed(rewardId) {
    return await this.contract.claimed(rewardId);
  }
  async rewardInfo(rewardId) {
    return await this.contract.rewardInfo(rewardId);
  } // {assigned, isClaimed, uri}
  async rewardTokenUri(rewardId) {
    return await this.contract.rewardTokenUri(rewardId);
  }

  // events / mystery
  async events(idx) {
    return await this.contract.events(idx);
  } // struct
  async eventEligibleCount(eventId) {
    return await this.contract.eventEligibleCount(eventId);
  }
  async getEligibleAt(eventId, idx) {
    return await this.contract.getEligibleAt(eventId, idx);
  }
  async nextEventId() {
    return await this.contract.nextEventId();
  }
  async nextRewardId() {
    return await this.contract.nextRewardId();
  }

  // VRF / helpers
  async VRFRequestToEvent(reqId) {
    return await this.contract.VRFRequestToEvent(reqId);
  }
  async VRFRouter() {
    return await this.contract.VRFRouter();
  }
  async mainContract() {
    return await this.contract.mainContract();
  }
  async owner() {
    return await this.contract.owner();
  }
  async isApprovedForAll(ownerAddr, operatorAddr) {
    return await this.contract.isApprovedForAll(ownerAddr, operatorAddr);
  }
  async getApproved(tokenId) {
    return await this.contract.getApproved(tokenId);
  }

  // ----------- Write (claim) -----------
  async _sendTx(methodName, args = [], overrides = {}) {
    if (!this._signerConnected)
      throw new Error(
        "Signer not connected. Call connectWithSigner(signer) first.",
      );
    try {
      const method = this.contract[methodName];
      if (!method) throw new Error("Method not found: " + methodName);
      // estimate gas kdyz jde
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
      console.error(`_sendTx ${methodName} failed:`, err);
      throw err;
    }
  }

  /**
   * claim(rewardId) - volá claim na kontraktu (nutný signer, reward musí být assigned to caller)
   * @param {number|string} rewardId
   */
  async claim(rewardId, overrides = {}) {
    return await this._sendTx("claim", [rewardId], overrides);
  }

  // ----------- Batch / dashboard helpers -----------

  /** Returns basic dashboard stats */
  async getAllStats() {
    const calls = [
      this.name(),
      this.symbol(),
      this.nextEventId(),
      this.nextRewardId(),
      this.VRFRouter(),
      this.mainContract(),
      this.owner(),
    ];
    const [
      name,
      symbol,
      nextEventId,
      nextRewardId,
      VRFRouter,
      mainContract,
      owner,
    ] = await Promise.all(calls);
    return {
      name,
      symbol,
      nextEventId,
      nextRewardId,
      VRFRouter,
      mainContract,
      owner,
    };
  }

  /**
   * fetchEventsDetailed()
   * - načte nextEventId(), poté pro každý eventId zavolá events(id) + eventEligibleCount + (volitelně) winners/eligible
   * - WARNING: může být heavy pokud je eventů hodně
   */
  async fetchEventsDetailed({ includeEligible = false, limit = 100 } = {}) {
    const nextIdBn = await this.nextEventId();
    const nextId = Number(nextIdBn?.toString?.() ?? nextIdBn) || 0;
    const start = Math.max(0, nextId - limit);
    const ids = [];
    for (let i = start; i < nextId; i++) ids.push(i);

    const promises = ids.map(async (id) => {
      const evt = await this.events(id);
      const eligibleCountBn = await this.eventEligibleCount(id);
      const eligibleCount = Number(
        eligibleCountBn?.toString?.() ?? eligibleCountBn,
      );
      let eligible = [];
      if (includeEligible && eligibleCount > 0) {
        // opatrně - volá RPC eligibleCount krát
        const ePromises = [];
        for (let j = 0; j < eligibleCount; j++)
          ePromises.push(this.getEligibleAt(id, j));
        eligible = await Promise.all(ePromises);
      }
      return {
        eventId: id,
        kind: evt.kind,
        creator: evt.creator,
        REWARDStartId: evt.REWARDStartId,
        rewardCount: evt.rewardCount,
        randomnessRequested: evt.randomnessRequested,
        finished: evt.finished,
        VRFRequestId: evt.VRFRequestId,
        eligibleCount,
        eligible,
      };
    });

    return await Promise.all(promises);
  }

  /**
   * fetchREWARDSRange(startId, endId)
   * - načte rewardInfo pro rozsah (startId <= id < endId)
   * - užitečné pro stránkování/renderer
   */
  async fetchREWARDSRange(startId, endId) {
    if (endId <= startId) return [];
    const ids = [];
    for (let i = startId; i < endId; i++) ids.push(i);
    const promises = ids.map(async (id) => {
      const info = await this.rewardInfo(id);
      const assigned = info.assigned;
      const isClaimed = info.isClaimed;
      const uri = info.uri;
      return { rewardId: id, assigned, isClaimed, uri };
    });
    return await Promise.all(promises);
  }

  /**
   * fetchUserAssignedREWARDS(userAddr, limit = 500)
   * - iteruje rewardId od 0 do nextRewardId (max limit) a sbírá ty, které jsou assigned == userAddr
   * - WARNING: je to on-chain scan; pro větší rozsahy použij backend indexer nebo event logy
   */
  async fetchUserAssignedREWARDS(userAddr, { limit = 1000 } = {}) {
    const nextBn = await this.nextRewardId();
    const next = Number(nextBn?.toString?.() ?? nextBn) || 0;
    const max = Math.min(next, limit);
    const res = [];
    for (let i = 0; i < max; i++) {
      const info = await this.rewardInfo(i);
      if (
        String(info.assigned).toLowerCase() === String(userAddr).toLowerCase()
      ) {
        res.push({ rewardId: i, isClaimed: info.isClaimed, uri: info.uri });
      }
    }
    return res;
  }

  // ----------- Subscribe / Unsubscribe (block) -----------
  subscribeOnBlock(callback) {
    if (this._onBlockHandler) this.unsubscribeOnBlock();
    this._onBlockHandler = async (blockNumber) => {
      try {
        const stats = await this.getAllStats();
        callback(blockNumber, stats);
      } catch (e) {
        console.error("NFTREWARDSService subscribeOnBlock error", e);
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

  // ----------- Utilities -----------
  static bnToString(bn, decimals = 18) {
    if (bn === undefined || bn === null) return "0";
    try {
      return ethers.formatUnits(bn, decimals);
    } catch {
      return bn.toString();
    }
  }

  static formatReward(rewardObj) {
    return {
      rewardId: rewardObj.rewardId,
      assigned: rewardObj.assigned,
      isClaimed: rewardObj.isClaimed,
      uri: rewardObj.uri,
    };
  }

  static formatEvent(evt) {
    return {
      eventId: evt.eventId,
      kind: evt.kind,
      creator: evt.creator,
      REWARDStartId: evt.REWARDStartId,
      rewardCount: evt.rewardCount,
      randomnessRequested: evt.randomnessRequested,
      finished: evt.finished,
      VRFRequestId: evt.VRFRequestId,
      eligibleCount: evt.eligibleCount,
      eligible: evt.eligible,
    };
  }
}

