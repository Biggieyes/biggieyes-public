// src/services/COLLECTIONREWARDSService.js
// Wrapper around BiggiCollectionRewards ABI with read helpers and claim entry points.

import { Contract } from "ethers";
import { BiggiCollectionRewards as ABI_COLLECTION_REWARDS } from "@/config/abi/index.js";

const ABI = Array.isArray(ABI_COLLECTION_REWARDS) ? ABI_COLLECTION_REWARDS : [];
export const BLOCK_INDICES = Array.from({ length: 9 }, (_, idx) => idx + 1);
export const ORANGE_MAIN_IDS = Array.from({ length: 10 }, (_, idx) => idx + 1);
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

export default class COLLECTIONREWARDSService {
  constructor(address, provider) {
    if (!address) throw new Error("Contract address required");
    if (!provider) throw new Error("Provider required");
    this.address = address;
    this.provider = provider;
    this.contract = new Contract(address, ABI, provider);
    this._signerConnected = false;
  }

  connectWithSigner(signer) {
    if (!signer) throw new Error("Signer required");
    this.contract = this.contract.connect(signer);
    this.provider = signer.provider ?? this.provider;
    this._signerConnected = true;
  }

  async blockPaid(idx) {
    return await this.contract.blockPaid(idx);
  }

  async blockReward() {
    return await this.contract.blockReward();
  }

  async blockWinnersCount() {
    return await this.contract.blockWinnersCount();
  }

  async claimBlockReward(blockIdx, overrides = {}) {
    return await this._sendTx("claimBlockReward", [blockIdx], overrides);
  }

  async claimOrangeReward(mainId, overrides = {}) {
    return await this._sendTx("claimOrangeReward", [mainId], overrides);
  }

  async claimRainbowReward(overrides = {}) {
    return await this._sendTx("claimRainbowReward", [], overrides);
  }

  async canClaimBlock(addr, blockIdx) {
    return await this.contract.canClaimBlock(addr, blockIdx);
  }

  async canClaimOrange(addr, mainId) {
    return await this.contract.canClaimOrange(addr, mainId);
  }

  async canClaimRainbow(addr) {
    return await this.contract.canClaimRainbow(addr);
  }

  async distributor() {
    return await this.contract.distributor();
  }

  async main() {
    return await this.contract.main();
  }

  async orangeMainIdPaid(mainId) {
    return await this.contract.orangeMainIdPaid(mainId);
  }

  async orangeReward() {
    return await this.contract.orangeReward();
  }

  async orangeWinnersCount() {
    return await this.contract.orangeWinnersCount();
  }

  async owner() {
    return await this.contract.owner();
  }

  async rainbowRewardClaimedGlobal() {
    return await this.contract.rainbowRewardClaimedGlobal();
  }

  async rainbowReward() {
    return await this.contract.rainbowReward();
  }

  async _sendTx(methodName, args = [], overrides = {}) {
    if (!this._signerConnected)
      throw new Error(
        "Signer not connected. Call connectWithSigner(signer) first.",
      );
    const method = this.contract[methodName];
    if (!method) throw new Error("Method not found: " + methodName);
    let gasEstimate = null;
    try {
      gasEstimate = await this.contract.estimateGas[methodName](
        ...args,
        overrides,
      );
    } catch (err) {
      console.debug(
        "COLLECTIONREWARDSService estimateGas failed",
        methodName,
        err,
      );
      gasEstimate = null;
    }
    const gasLimit = withGasBuffer(gasEstimate);
    const sendOverrides = gasLimit
      ? { gasLimit, ...overrides }
      : overrides;
    const tx = await method(...args, sendOverrides);
    const receipt = await tx.wait(1);
    return receipt;
  }

  async getAllStats(walletAddress = null) {
    const read = (fn, fallback = null) =>
      COLLECTIONREWARDSService.safeRead(fn, fallback);
    const readClaimability = (fn) =>
      read(fn, null).then(COLLECTIONREWARDSService.normalizeClaimability);

    const blockPaidPromise = Promise.all(
      BLOCK_INDICES.map((idx) => read(() => this.blockPaid(idx), false)),
    );
    const orangePaidPromise = Promise.all(
      ORANGE_MAIN_IDS.map((id) => read(() => this.orangeMainIdPaid(id), false)),
    );
    const blockClaimabilityPromise = walletAddress
      ? Promise.all(
          BLOCK_INDICES.map((idx) =>
            readClaimability(() => this.canClaimBlock(walletAddress, idx)),
          ),
        )
      : Promise.resolve([]);
    const orangeClaimabilityPromise = walletAddress
      ? Promise.all(
          ORANGE_MAIN_IDS.map((mainId) =>
            readClaimability(() => this.canClaimOrange(walletAddress, mainId)),
          ),
        )
      : Promise.resolve([]);
    const rainbowClaimabilityPromise = walletAddress
      ? readClaimability(() => this.canClaimRainbow(walletAddress))
      : Promise.resolve(COLLECTIONREWARDSService.normalizeClaimability(null));
    const promises = [
      read(() => this.blockReward(), null),
      read(() => this.blockWinnersCount(), null),
      read(() => this.orangeReward(), null),
      read(() => this.orangeWinnersCount(), null),
      read(() => this.rainbowReward(), null),
      read(() => this.rainbowRewardClaimedGlobal(), false),
      read(() => this.distributor(), null),
      read(() => this.main(), null),
      read(() => this.owner(), null),
      blockPaidPromise,
      orangePaidPromise,
      blockClaimabilityPromise,
      orangeClaimabilityPromise,
      rainbowClaimabilityPromise,
    ];
    const [
      blockReward,
      blockWinnersCount,
      orangeReward,
      orangeWinnersCount,
      rainbowReward,
      rainbowClaimed,
      distributor,
      main,
      owner,
      blockPaidRaw,
      orangePaidRaw,
      blockClaimability,
      orangeClaimability,
      rainbowClaimability,
    ] = await Promise.all(promises);

    return {
      blockReward,
      blockWinnersCount: COLLECTIONREWARDSService.toNumber(blockWinnersCount),
      orangeReward,
      orangeWinnersCount: COLLECTIONREWARDSService.toNumber(orangeWinnersCount),
      rainbowReward,
      rainbowClaimed: Boolean(rainbowClaimed),
      distributor,
      main,
      owner,
      blockPaid: (blockPaidRaw || []).map((paid) => Boolean(paid)),
      orangeMainIdPaid: (orangePaidRaw || []).map((paid) => Boolean(paid)),
      blockClaimability,
      orangeClaimability,
      rainbowClaimability,
    };
  }

  static async safeRead(readFn, fallback = null) {
    try {
      return await readFn();
    } catch {
      return fallback;
    }
  }

  static normalizeClaimability(value) {
    if (value == null) {
      return { ok: null, reason: null, resolved: false };
    }
    const okRaw = value?.ok ?? value?.[0] ?? null;
    const reasonRaw = value?.reason ?? value?.[1] ?? null;
    const ok = typeof okRaw === "boolean" ? okRaw : null;
    const reason =
      reasonRaw == null ? null : COLLECTIONREWARDSService.toNumber(reasonRaw);
    return { ok, reason, resolved: true };
  }

  static toNumber(value) {
    if (value == null) return 0;
    if (typeof value === "number") return value;
    const normalized = value?.toString?.() ?? value;
    const candidate = Number(normalized);
    return Number.isFinite(candidate) ? candidate : 0;
  }
}
