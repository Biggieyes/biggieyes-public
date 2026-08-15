// src/services/COMMUNITYCENTERService.js
// Ethers v6 service wrapper for BiggiCommunityCenter events + pool
// - read getters (mapují ABI)
// - claim(eventId) write (estimateGas + buffer + wait(1))
// - batch helpers: getAllStats(), fetchEventsDetailed()
// - subscribeOnBlock / unsubscribeOnBlock
// - bnToString helper + formatSummary
// Neprovádím žádné změny v kontraktu.

import { Contract, formatUnits } from "ethers";
import { getROProvider, ADDR } from "@/shared/utils/contract";
import { BiggiCommunityCenter as ABI } from "@/config/abi/index.js";

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

export default class COMMUNITYCENTERService {
  /**
   * @param {string} address - contract address
   * @param {ethers.providers.Provider} provider - ethers provider
   */
  constructor(address, provider = null) {
    const finalProvider = provider || getROProvider();
    if (!address) throw new Error("Contract address required");
    if (!finalProvider) throw new Error("Provider required");
    this.address = address;
    this.provider = finalProvider;
    this.contract = new Contract(address, ABI, finalProvider);
    this._onBlockHandler = null;
    this._signerConnected = false;
  }

  /** Resolve default COMMUNITYCENTER address from ADDR hints */
  static resolveDefaultAddress() {
    return (
      ADDR?.COMMUNITY_CENTER ||
      ADDR?.COMMUNITYCENTER ||
      ADDR?.BIGGI_COMMUNITY_CENTER ||
      ADDR?.BiggiCOMMUNITYCENTER ||
      null
    );
  }

  /** Factory helper using default provider/address */
  static create(address, provider) {
    const addr = address || COMMUNITYCENTERService.resolveDefaultAddress();
    const prov = provider || getROProvider();
    if (!addr) throw new Error("Community Center address is not configured");
    if (!prov) throw new Error("Read-only provider unavailable");
    return new COMMUNITYCENTERService(addr, prov);
  }

  /** Volitelný init sanity check */
  async init() {
    try {
      await this.provider.getNetwork();
      await this.nextEventId();
      return true;
    } catch (e) {
      console.error("COMMUNITYCENTERService.init failed:", e);
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
  async assignedAmountOf(eventId, who) {
    return await this.contract.assignedAmountOf(eventId, who);
  }
  async balanceOfEvent(eventId) {
    return await this.contract.balanceOfEvent(eventId);
  }
  async distributor() {
    return await this.contract.distributor();
  }
  async events(idx) {
    return await this.contract.events(idx);
  } // struct view
  async getEvent(eventId) {
    return await this.contract.getEvent(eventId);
  }
  async getEventWinners(eventId) {
    return await this.contract.getEventWinners(eventId);
  } // (winners, amounts, claimed)
  async getEvents() {
    return await this.contract.getEvents();
  } // ids array
  async nextEventId() {
    return await this.contract.nextEventId();
  }
  async owner() {
    return await this.contract.owner();
  }
  async paused() {
    return await this.contract.paused();
  }
  async poolBalance() {
    return await this.contract.poolBalance();
  }

  // ------------------- Write (claim) -------------------
  async _sendTx(methodName, args = [], overrides = {}) {
    if (!this._signerConnected)
      throw new Error(
        "Signer not connected. Call connectWithSigner(signer) first.",
      );
    try {
      const method = this.contract[methodName];
      if (!method) throw new Error("Method not found: " + methodName);
      // odhad gas, pokud jde
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
      this.paused(),
    ];
    const [distributor, nextEventId, eventsList, poolBalance, owner, paused] =
      await Promise.all(calls);
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
        this.getEventWinners(id),
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
        claimed,
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
        console.error(
          "COMMUNITYCENTERService subscribeOnBlock handler error",
          e,
        );
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
    try {
      return formatUnits(bn, decimals);
    } catch {
      return bn.toString();
    }
  }

  static formatSummary(stats) {
    return {
      distributor: stats.distributor,
      nextEventId: stats.nextEventId?.toString?.() ?? stats.nextEventId,
      eventsCount: Array.isArray(stats.eventsList)
        ? stats.eventsList.length
        : 0,
      poolBalance: COMMUNITYCENTERService.bnToString(stats.poolBalance, 18),
      owner: stats.owner,
      paused: stats.paused,
    };
  }
}

