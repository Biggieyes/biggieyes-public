// src/services/CommunityCenterService.js
// Ethers v5 service wrapper for BiggiCommunityCenter events + pool
// - read getters (mapují ABI)
// - claim(eventId) write (estimateGas + buffer + wait(1))
// - batch helpers: getAllStats(), fetchEventsDetailed()
// - subscribeOnBlock / unsubscribeOnBlock
// - bnToString helper + formatSummary
// Neprovádím žádné změny v kontraktu.

import { ethers } from "ethers";
import { getROProvider, ADDR } from "../utils/contract";

const ABI = [
  { "inputs":[{"internalType":"uint256","name":"eventId","type":"uint256"},{"internalType":"address","name":"who","type":"address"}],"name":"assignedAmountOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  { "inputs":[{"internalType":"uint256","name":"eventId","type":"uint256"}],"name":"balanceOfEvent","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  { "inputs":[{"internalType":"uint256","name":"eventId","type":"uint256"}],"name":"claim","outputs":[],"stateMutability":"nonpayable","type":"function"},
  { "inputs":[],"name":"distributor","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  { "inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"events","outputs":[{"internalType":"string","name":"title","type":"string"},{"internalType":"string","name":"ipfsHash","type":"string"},{"internalType":"uint256","name":"start","type":"uint256"},{"internalType":"uint256","name":"end","type":"uint256"},{"internalType":"uint256","name":"totalPrize","type":"uint256"},{"internalType":"uint256","name":"locked","type":"uint256"},{"internalType":"bool","name":"exists","type":"bool"}],"stateMutability":"view","type":"function"},
  { "inputs":[{"internalType":"uint256","name":"eventId","type":"uint256"}],"name":"getEvent","outputs":[{"internalType":"string","name":"title","type":"string"},{"internalType":"string","name":"ipfsHash","type":"string"},{"internalType":"uint256","name":"start","type":"uint256"},{"internalType":"uint256","name":"end","type":"uint256"},{"internalType":"uint256","name":"totalPrize","type":"uint256"},{"internalType":"uint256","name":"locked","type":"uint256"},{"internalType":"bool","name":"exists","type":"bool"}],"stateMutability":"view","type":"function"},
  { "inputs":[{"internalType":"uint256","name":"eventId","type":"uint256"}],"name":"getEventWinners","outputs":[{"internalType":"address[]","name":"winners","type":"address[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"},{"internalType":"bool[]","name":"claimed","type":"bool[]"}],"stateMutability":"view","type":"function"},
  { "inputs":[],"name":"getEvents","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},
  { "inputs":[],"name":"nextEventId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  { "inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  { "inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  { "inputs":[],"name":"poolBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];

export default class CommunityCenterService {
  /**
   * @param {string} address - contract address
   * @param {ethers.providers.Provider} provider - ethers v5 provider
   */
  constructor(address, provider = null) {
    const finalProvider = provider || getROProvider();
    if (!address) throw new Error("Contract address required");
    if (!finalProvider) throw new Error("Provider required");
    this.address = address;
    this.provider = finalProvider;
    this.contract = new ethers.Contract(address, ABI, finalProvider);
    this._onBlockHandler = null;
    this._signerConnected = false;
  }

  /** Resolve default CommunityCenter address from ADDR hints */
  static resolveDefaultAddress() {
    return (
      ADDR?.COMMUNITY_CENTER ||
      ADDR?.CommunityCenter ||
      ADDR?.BIGGI_COMMUNITY_CENTER ||
      ADDR?.BiggiCommunityCenter ||
      null
    );
  }

  /** Factory helper using default provider/address */
  static create(address, provider) {
    const addr = address || CommunityCenterService.resolveDefaultAddress();
    const prov = provider || getROProvider();
    if (!addr) throw new Error("Community Center address is not configured");
    if (!prov) throw new Error("Read-only provider unavailable");
    return new CommunityCenterService(addr, prov);
  }

  /** Volitelný init sanity check */
  async init() {
    try {
      await this.provider.getNetwork();
      await this.nextEventId();
      return true;
    } catch (e) {
      console.error("CommunityCenterService.init failed:", e);
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

  // ------------------- Read getters -------------------
  async assignedAmountOf(eventId, who) { return await this.contract.assignedAmountOf(eventId, who); }
  async balanceOfEvent(eventId) { return await this.contract.balanceOfEvent(eventId); }
  async distributor() { return await this.contract.distributor(); }
  async events(idx) { return await this.contract.events(idx); } // struct view
  async getEvent(eventId) { return await this.contract.getEvent(eventId); }
  async getEventWinners(eventId) { return await this.contract.getEventWinners(eventId); } // (winners, amounts, claimed)
  async getEvents() { return await this.contract.getEvents(); } // ids array
  async nextEventId() { return await this.contract.nextEventId(); }
  async owner() { return await this.contract.owner(); }
  async paused() { return await this.contract.paused(); }
  async poolBalance() { return await this.contract.poolBalance(); }

  // ------------------- Write (claim) -------------------
  async _sendTx(methodName, args = [], overrides = {}) {
    if (!this._signerConnected) throw new Error("Signer not connected. Call connectWithSigner(signer) first.");
    try {
      const method = this.contract[methodName];
      if (!method) throw new Error("Method not found: " + methodName);
      // odhad gas, pokud jde
      let gasEstimate = null;
      try { gasEstimate = await this.contract.estimateGas[methodName](...args, overrides); } catch { gasEstimate = null; }
      const sendOverrides = gasEstimate ? { gasLimit: gasEstimate.mul(120).div(100), ...overrides } : overrides;
      const tx = await method(...args, sendOverrides);
      const receipt = await tx.wait(1);
      return receipt;
    } catch (err) {
      console.error(`_sendTx ${methodName} failed:`, err);
      throw err;
    }
  }

  /** Claim pro konkrétní eventId (přihlášený signer musí být adresou výherce) */
  async claim(eventId, overrides = {}) {
    return await this._sendTx("claim", [eventId], overrides);
  }

  // ------------------- Batch helpers -------------------
  /** GetAllStats: základní metriky pro dashboard */
  async getAllStats() {
    const calls = [
      this.distributor(),
      this.nextEventId(),
      this.getEvents(),
      this.poolBalance(),
      this.owner(),
      this.paused()
    ];
    const [distributor, nextEventId, eventsList, poolBalance, owner, paused] = await Promise.all(calls);
    return { distributor, nextEventId, eventsList, poolBalance, owner, paused };
  }

  /**
   * fetchEventsDetailed:
   * - zavolá getEvents() -> vrátí pole eventId
   * - pro každý eventId zavolá getEvent(eventId) a getEventWinners(eventId)
   * - vrátí pole objektů: { eventId, eventStruct, winners: [...], amounts: [...], claimed: [...] }
   *
   * Pozor: může být heavy pokud je mnoho eventů.
   */
  async fetchEventsDetailed() {
    const ids = await this.getEvents();
    if (!ids || ids.length === 0) return [];
    const promises = ids.map(async (idBn) => {
      const id = idBn.toString();
      const [eventStruct, winnersTuple] = await Promise.all([
        this.getEvent(id),
        this.getEventWinners(id)
      ]);
      const [winners, amounts, claimed] = winnersTuple;
      return {
        eventId: id,
        title: eventStruct.title,
        ipfsHash: eventStruct.ipfsHash,
        start: eventStruct.start,
        end: eventStruct.end,
        totalPrize: eventStruct.totalPrize,
        locked: eventStruct.locked,
        exists: eventStruct.exists,
        winners,
        amounts,
        claimed
      };
    });
    return await Promise.all(promises);
  }

  // ------------------- Subscribe / Unsubscribe -------------------
  /**
   * Subscribe na nové bloky; callback(blockNumber, stats)
   * Upozornění: getAllStats() může být heavy => použij throttling/polling v produkci.
   */
  subscribeOnBlock(callback) {
    if (this._onBlockHandler) this.unsubscribeOnBlock();
    this._onBlockHandler = async (blockNumber) => {
      try {
        const stats = await this.getAllStats();
        callback(blockNumber, stats);
      } catch (e) {
        console.error("CommunityCenterService subscribeOnBlock handler error", e);
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

  // ------------------- Utilities -------------------
  static bnToString(bn, decimals = 18) {
    if (!bn) return "0";
    try { return ethers.utils.formatUnits(bn, decimals); } catch { return bn.toString(); }
  }

  static formatSummary(stats) {
    return {
      distributor: stats.distributor,
      nextEventId: stats.nextEventId?.toString?.() ?? stats.nextEventId,
      eventsCount: Array.isArray(stats.eventsList) ? stats.eventsList.length : 0,
      poolBalance: CommunityCenterService.bnToString(stats.poolBalance, 18),
      owner: stats.owner,
      paused: stats.paused
    };
  }
}
