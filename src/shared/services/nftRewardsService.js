// Ethers v6 wrapper for the deployed BiggiNFTRewards contract and hardened V2.

import * as ethers from "ethers";
import { BiggiNftRewards as ABI } from "@/config/abi/index.js";

const withGasBuffer = (gas, pct = 120) => {
  if (gas == null) return null;
  if (typeof gas === "bigint") return (gas * BigInt(pct)) / 100n;
  if (gas?._isBigNumber && typeof gas.mul === "function") {
    return gas.mul(pct).div(100);
  }
  try {
    return (BigInt(gas) * BigInt(pct)) / 100n;
  } catch {
    return gas;
  }
};

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value?.toString?.() ?? value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const pick = (result, key, index) => result?.[key] ?? result?.[index];

export const normalizeRewardEvent = (result, eventId) => ({
  eventId: toSafeNumber(eventId),
  kind: toSafeNumber(pick(result, "kind", 0)),
  creator: pick(result, "creator", 1) ?? null,
  rewardStartId: toSafeNumber(pick(result, "rewardStartId", 2)),
  rewardCount: toSafeNumber(pick(result, "rewardCount", 3)),
  randomnessRequested: Boolean(pick(result, "randomnessRequested", 4)),
  finished: Boolean(pick(result, "finished", 5)),
  vrfRequestId: pick(result, "vrfRequestId", 6) ?? 0n,
});

export const normalizeRewardInfo = (result, rewardId) => ({
  rewardId: toSafeNumber(rewardId),
  assigned: pick(result, "assigned", 0) ?? null,
  isClaimed: Boolean(pick(result, "isClaimed", 1)),
  uri: pick(result, "uri", 2) ?? "",
});

const mapWithConcurrency = async (items, worker, concurrency = 3) => {
  if (!items.length) return [];
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
};

export default class NFTREWARDSService {
  constructor(address, provider) {
    if (!address) throw new Error("Contract address required");
    if (!provider) throw new Error("Provider required");
    this.address = address;
    this.provider = provider;
    this.contract = new ethers.Contract(address, ABI, provider);
    this._onBlockHandler = null;
    this._signerConnected = false;
  }

  async init() {
    try {
      await this.provider.getNetwork();
      await this.name();
      return true;
    } catch (error) {
      console.error("NFTREWARDSService.init failed:", error);
      throw error;
    }
  }

  connectWithSigner(signer) {
    if (!signer) throw new Error("Signer required");
    this.contract = this.contract.connect(signer);
    this.provider = signer.provider ?? this.provider;
    this._signerConnected = true;
  }

  async balanceOf(ownerAddress) {
    return await this.contract.balanceOf(ownerAddress);
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
  async assignedTo(rewardId) {
    return await this.contract.assignedTo(rewardId);
  }
  async claimed(rewardId) {
    return await this.contract.claimed(rewardId);
  }
  async rewardInfo(rewardId) {
    return await this.contract.rewardInfo(rewardId);
  }
  async rewardTokenUri(rewardId) {
    return await this.contract.rewardTokenUri(rewardId);
  }
  async events(eventId) {
    return await this.contract.events(eventId);
  }
  async eventEligibleCount(eventId) {
    return await this.contract.eventEligibleCount(eventId);
  }
  async getEligibleAt(eventId, index) {
    return await this.contract.getEligibleAt(eventId, index);
  }
  async nextEventId() {
    return await this.contract.nextEventId();
  }
  async nextRewardId() {
    return await this.contract.nextRewardId();
  }
  async vrfRequestToEvent(requestId) {
    return await this.contract.vrfRequestToEvent(requestId);
  }
  async VRFRequestToEvent(requestId) {
    return await this.vrfRequestToEvent(requestId);
  }
  async vrfRouter() {
    return await this.contract.vrfRouter();
  }
  async VRFRouter() {
    return await this.vrfRouter();
  }
  async mainContract() {
    return await this.contract.mainContract();
  }
  async registry() {
    return await this.contract.registry();
  }
  async mysteryRetryDelay() {
    return await this.contract.mysteryRetryDelay();
  }
  async owner() {
    return await this.contract.owner();
  }
  async isApprovedForAll(ownerAddress, operatorAddress) {
    return await this.contract.isApprovedForAll(ownerAddress, operatorAddress);
  }
  async getApproved(tokenId) {
    return await this.contract.getApproved(tokenId);
  }

  async _sendTx(methodName, args = [], overrides = {}) {
    if (!this._signerConnected) {
      throw new Error(
        "Signer not connected. Call connectWithSigner(signer) first.",
      );
    }
    try {
      const method = this.contract[methodName];
      if (!method) throw new Error(`Method not found: ${methodName}`);
      let gasEstimate = null;
      try {
        if (typeof method.estimateGas === "function") {
          gasEstimate = await method.estimateGas(...args, overrides);
        } else if (
          typeof this.contract.estimateGas?.[methodName] === "function"
        ) {
          gasEstimate = await this.contract.estimateGas[methodName](
            ...args,
            overrides,
          );
        }
      } catch {
        gasEstimate = null;
      }
      const gasLimit = withGasBuffer(gasEstimate);
      const sendOverrides = gasLimit ? { gasLimit, ...overrides } : overrides;
      const transaction = await method(...args, sendOverrides);
      return await transaction.wait(1);
    } catch (error) {
      console.error(`_sendTx ${methodName} failed:`, error);
      throw error;
    }
  }

  async claim(rewardId, overrides = {}) {
    return await this._sendTx("claim", [rewardId], overrides);
  }

  async getAllStats() {
    const [
      name,
      symbol,
      nextEventId,
      nextRewardId,
      vrfRouter,
      mainContract,
      owner,
      registry,
      mysteryRetryDelay,
    ] = await Promise.all([
      this.name(),
      this.symbol(),
      this.nextEventId(),
      this.nextRewardId(),
      this.vrfRouter(),
      this.mainContract().catch(() => null),
      this.owner(),
      this.registry().catch(() => null),
      this.mysteryRetryDelay(),
    ]);

    return {
      name,
      symbol,
      nextEventId,
      nextRewardId,
      vrfRouter,
      VRFRouter: vrfRouter,
      mainContract,
      owner,
      registry,
      mysteryRetryDelay,
      totalEventsCreated: Math.max(0, toSafeNumber(nextEventId) - 1),
      totalRewardsCreated: Math.max(0, toSafeNumber(nextRewardId) - 1),
    };
  }

  async fetchEventsDetailed({ includeEligible = false, limit = 100 } = {}) {
    const nextId = toSafeNumber(await this.nextEventId());
    const lastId = nextId - 1;
    if (lastId < 1) return [];
    const safeLimit = Math.max(1, toSafeNumber(limit, 100));
    const startId = Math.max(1, lastId - safeLimit + 1);
    const ids = Array.from(
      { length: lastId - startId + 1 },
      (_, index) => startId + index,
    );

    return await mapWithConcurrency(ids, async (eventId) => {
      const event = normalizeRewardEvent(await this.events(eventId), eventId);
      const eligibleCount = toSafeNumber(
        await this.eventEligibleCount(eventId),
      );
      let eligible = [];
      if (includeEligible && eligibleCount > 0) {
        const indexes = Array.from({ length: eligibleCount }, (_, idx) => idx);
        eligible = await mapWithConcurrency(indexes, (index) =>
          this.getEligibleAt(eventId, index),
        );
      }
      return { ...event, eligibleCount, eligible };
    });
  }

  async fetchREWARDSRange(startId, endId) {
    const firstId = Math.max(1, toSafeNumber(startId, 1));
    const lastExclusive = toSafeNumber(endId);
    if (lastExclusive <= firstId) return [];
    const ids = Array.from(
      { length: lastExclusive - firstId },
      (_, index) => firstId + index,
    );
    return await mapWithConcurrency(ids, async (rewardId) =>
      normalizeRewardInfo(await this.rewardInfo(rewardId), rewardId),
    );
  }

  async fetchUserAssignedREWARDS(userAddress, { limit = 1000 } = {}) {
    const total = Math.max(0, toSafeNumber(await this.nextRewardId()) - 1);
    const count = Math.min(total, Math.max(0, toSafeNumber(limit, 1000)));
    const rewards = await this.fetchREWARDSRange(1, count + 1);
    const normalizedUser = String(userAddress || "").toLowerCase();
    return rewards.filter(
      (reward) =>
        String(reward.assigned || "").toLowerCase() === normalizedUser,
    );
  }

  subscribeOnBlock(callback) {
    if (this._onBlockHandler) this.unsubscribeOnBlock();
    this._onBlockHandler = async (blockNumber) => {
      try {
        callback(blockNumber, await this.getAllStats());
      } catch (error) {
        console.error("NFTREWARDSService subscribeOnBlock error", error);
      }
    };
    this.provider.on("block", this._onBlockHandler);
  }

  unsubscribeOnBlock() {
    if (!this._onBlockHandler) return;
    this.provider.off("block", this._onBlockHandler);
    this._onBlockHandler = null;
  }

  static bnToString(value, decimals = 18) {
    if (value === undefined || value === null) return "0";
    try {
      return ethers.formatUnits(value, decimals);
    } catch {
      return value.toString();
    }
  }

  static formatReward(reward) {
    return {
      rewardId: reward.rewardId,
      assigned: reward.assigned,
      isClaimed: reward.isClaimed,
      uri: reward.uri,
    };
  }

  static formatEvent(event) {
    return {
      eventId: event.eventId,
      kind: event.kind,
      creator: event.creator,
      rewardStartId: event.rewardStartId,
      rewardCount: event.rewardCount,
      randomnessRequested: event.randomnessRequested,
      finished: event.finished,
      vrfRequestId: event.vrfRequestId,
      eligibleCount: event.eligibleCount,
      eligible: event.eligible,
    };
  }
}
