// src/services/COLLECTIONREWARDSService.js
// Wrapper around BiggiCollectionRewards ABI with read helpers and claim entry points.

import { Contract } from "ethers";
import { BiggiCollectionRewards as ABI_COLLECTION_REWARDS } from "@/config/abi/index.js";
import { assertWriteContext, waitForWriteReceipt } from "@/shared/utils/writeRetry";

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
  constructor(address, provider, collectionAddress = null) {
    if (!address) throw new Error("Contract address required");
    if (!provider) throw new Error("Provider required");
    this.address = address;
    this.provider = provider;
    this.contract = new Contract(address, ABI, provider);
    this.collectionAddress = collectionAddress;
    this._signerConnected = false;
  }

  connectWithSigner(signer, expectedAccount = "") {
    if (!signer) throw new Error("Signer required");
    this.contract = this.contract.connect(signer);
    this.provider = signer.provider ?? this.provider;
    this._signer = signer;
    this._expectedAccount = String(expectedAccount || "").trim();
    this._signerConnected = true;
  }

  setCollection(collectionAddress) {
    if (!collectionAddress) throw new Error("Collection address required");
    this.collectionAddress = collectionAddress;
  }

  async defaultMain() {
    return await this.contract.defaultMain();
  }

  async _resolveCollection(collectionAddress = null) {
    const selected = collectionAddress || this.collectionAddress;
    if (selected) return selected;
    const fallback = await this.defaultMain();
    this.collectionAddress = fallback;
    return fallback;
  }

  async blockPaid(collectionAddress, idx) {
    return await this.contract.blockPaid(collectionAddress, idx);
  }

  async blockReward() {
    return await this.contract.blockReward();
  }

  async blockWinnersCount(collectionAddress) {
    return await this.contract.blockWinnersCount(collectionAddress);
  }

  async collectionBudgetSnapshot(collectionAddress) {
    return await this.contract.collectionBudgetSnapshot(collectionAddress);
  }

  async claimBlockReward(blockIdx, overrides = {}) {
    return await this._sendTx("claimBlockReward", [blockIdx], overrides);
  }

  async claimBlockRewardFor(collectionAddress, blockIdx, overrides = {}) {
    return await this._sendTx(
      "claimBlockRewardFor",
      [collectionAddress, blockIdx],
      overrides,
    );
  }

  async claimOrangeReward(mainId, overrides = {}) {
    return await this._sendTx("claimOrangeReward", [mainId], overrides);
  }

  async claimOrangeRewardFor(collectionAddress, mainId, overrides = {}) {
    return await this._sendTx(
      "claimOrangeRewardFor",
      [collectionAddress, mainId],
      overrides,
    );
  }

  async claimRainbowReward(overrides = {}) {
    return await this._sendTx("claimRainbowReward", [], overrides);
  }

  async claimRainbowRewardFor(collectionAddress, overrides = {}) {
    return await this._sendTx(
      "claimRainbowRewardFor",
      [collectionAddress],
      overrides,
    );
  }

  async canClaimBlock(addr, blockIdx) {
    return await this.contract.canClaimBlock(addr, blockIdx);
  }

  async canClaimBlockFor(collectionAddress, addr, blockIdx) {
    return await this.contract.canClaimBlockFor(
      collectionAddress,
      addr,
      blockIdx,
    );
  }

  async canClaimOrange(addr, mainId) {
    return await this.contract.canClaimOrange(addr, mainId);
  }

  async canClaimOrangeFor(collectionAddress, addr, mainId) {
    return await this.contract.canClaimOrangeFor(
      collectionAddress,
      addr,
      mainId,
    );
  }

  async canClaimRainbow(addr) {
    return await this.contract.canClaimRainbow(addr);
  }

  async canClaimRainbowFor(collectionAddress, addr) {
    return await this.contract.canClaimRainbowFor(collectionAddress, addr);
  }

  async distributor() {
    return await this.contract.distributor();
  }

  async main() {
    return await this._resolveCollection();
  }

  async orangeMainIdPaid(collectionAddress, mainId) {
    return await this.contract.orangeMainIdPaid(collectionAddress, mainId);
  }

  async orangeReward() {
    return await this.contract.orangeReward();
  }

  async orangeWinnersCount(collectionAddress) {
    return await this.contract.orangeWinnersCount(collectionAddress);
  }

  async owner() {
    return await this.contract.owner();
  }

  async rainbowRewardClaimedGlobal(collectionAddress) {
    return await this.contract.rainbowRewardClaimedGlobal(collectionAddress);
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
    const estimate =
      method.estimateGas || this.contract.estimateGas?.[methodName];
    if (!estimate) throw new Error("Claim preflight unavailable");
    const gasEstimate = await estimate(...args, overrides);
    const gasLimit = withGasBuffer(gasEstimate);
    const sendOverrides = gasLimit ? { gasLimit, ...overrides } : overrides;
    if (this._signer) {
      const expectedAccount =
        this._expectedAccount || (await this._signer.getAddress());
      await assertWriteContext({
        contract: { runner: this._signer },
        account: expectedAccount,
        getCurrentAccount: () => expectedAccount,
        chainId: 137,
      });
    }
    const tx = await method(...args, sendOverrides);
    return await waitForWriteReceipt(tx, 1);
  }

  async getAllStats(walletAddress = null, collectionAddress = null) {
    const collection = await this._resolveCollection(collectionAddress);
    const requiredErrors = [];
    const read = (fn, fallback = null) =>
      COLLECTIONREWARDSService.safeRead(fn, fallback);
    const required = async (fn) => {
      try {
        const value = await fn();
        if (value == null) throw new Error("Missing collection reward data");
        return value;
      } catch (error) {
        requiredErrors.push(error);
        return null;
      }
    };
    const readClaimability = (fn) =>
      read(fn, null).then(COLLECTIONREWARDSService.normalizeClaimability);

    const blockPaidPromise = Promise.all(
      BLOCK_INDICES.map((idx) =>
        required(() => this.blockPaid(collection, idx)),
      ),
    );
    const orangePaidPromise = Promise.all(
      ORANGE_MAIN_IDS.map((id) =>
        required(() => this.orangeMainIdPaid(collection, id)),
      ),
    );
    const blockClaimabilityPromise = walletAddress
      ? Promise.all(
          BLOCK_INDICES.map((idx) =>
            readClaimability(() =>
              this.canClaimBlockFor(collection, walletAddress, idx),
            ),
          ),
        )
      : Promise.resolve([]);
    const orangeClaimabilityPromise = walletAddress
      ? Promise.all(
          ORANGE_MAIN_IDS.map((mainId) =>
            readClaimability(() =>
              this.canClaimOrangeFor(collection, walletAddress, mainId),
            ),
          ),
        )
      : Promise.resolve([]);
    const rainbowClaimabilityPromise = walletAddress
      ? readClaimability(() =>
          this.canClaimRainbowFor(collection, walletAddress),
        )
      : Promise.resolve(COLLECTIONREWARDSService.normalizeClaimability(null));
    const budgetPromise = read(
      () => this.collectionBudgetSnapshot(collection),
      null,
    ).then(COLLECTIONREWARDSService.normalizeBudgetSnapshot);
    const promises = [
      required(() => this.blockReward()),
      required(() => this.blockWinnersCount(collection)),
      required(() => this.orangeReward()),
      required(() => this.orangeWinnersCount(collection)),
      required(() => this.rainbowReward()),
      required(() => this.rainbowRewardClaimedGlobal(collection)),
      read(() => this.distributor(), null),
      read(() => this.defaultMain(), null),
      read(() => this.owner(), null),
      blockPaidPromise,
      orangePaidPromise,
      blockClaimabilityPromise,
      orangeClaimabilityPromise,
      rainbowClaimabilityPromise,
      budgetPromise,
    ];
    const [
      blockReward,
      blockWinnersCount,
      orangeReward,
      orangeWinnersCount,
      rainbowReward,
      rainbowClaimed,
      distributor,
      defaultMain,
      owner,
      blockPaidRaw,
      orangePaidRaw,
      blockClaimability,
      orangeClaimability,
      rainbowClaimability,
      budget,
    ] = await Promise.all(promises);

    if (requiredErrors.length) {
      throw new Error(
        "Collection rewards are unavailable. Refresh before claiming.",
        {
          cause: requiredErrors[0],
        },
      );
    }

    return {
      blockReward,
      blockWinnersCount: COLLECTIONREWARDSService.toNumber(blockWinnersCount),
      orangeReward,
      orangeWinnersCount: COLLECTIONREWARDSService.toNumber(orangeWinnersCount),
      rainbowReward,
      rainbowClaimed: Boolean(rainbowClaimed),
      distributor,
      collection,
      main: collection,
      defaultMain,
      owner,
      blockPaid: (blockPaidRaw || []).map((paid) => Boolean(paid)),
      orangeMainIdPaid: (orangePaidRaw || []).map((paid) => Boolean(paid)),
      blockClaimability,
      orangeClaimability,
      rainbowClaimability,
      budget,
      budgetConfigured: budget.configured,
      claimsEnabled: budget.claimsEnabled,
      requiredBudget: budget.requiredBudget,
      fundedBudget: budget.fundedBudget,
      spentBudget: budget.spentBudget,
      availableBudget: budget.availableBudget,
      remainingLiability: budget.remainingLiability,
      surplusBudget: budget.surplusBudget,
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

  static normalizeBudgetSnapshot(value) {
    if (value == null) {
      return {
        configured: null,
        claimsEnabled: null,
        requiredBudget: null,
        fundedBudget: null,
        spentBudget: null,
        availableBudget: null,
        remainingLiability: null,
        surplusBudget: null,
        resolved: false,
      };
    }
    return {
      configured: Boolean(value?.configured ?? value?.[0]),
      claimsEnabled: Boolean(value?.claimsEnabled ?? value?.[1]),
      requiredBudget: value?.requiredBudget ?? value?.[2] ?? null,
      fundedBudget: value?.fundedBudget ?? value?.[3] ?? null,
      spentBudget: value?.spentBudget ?? value?.[4] ?? null,
      availableBudget: value?.availableBudget ?? value?.[5] ?? null,
      remainingLiability: value?.remainingLiability ?? value?.[6] ?? null,
      surplusBudget: value?.surplusBudget ?? value?.[7] ?? null,
      resolved: true,
    };
  }

  static toNumber(value) {
    if (value == null) return 0;
    if (typeof value === "number") return value;
    const normalized = value?.toString?.() ?? value;
    const candidate = Number(normalized);
    return Number.isFinite(candidate) ? candidate : 0;
  }
}
