// src/services/COLLECTIONREWARDSService.js
// Wrapper around BiggiCOLLECTIONREWARDS ABI with read helpers and claim entry points.

import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import { BiggiCOLLECTIONREWARDS as ABI_COLLECTION_REWARDS } from "../config/abi/index.js";

const ABI = Array.isArray(ABI_COLLECTION_REWARDS) ? ABI_COLLECTION_REWARDS : [];
export const BLOCK_INDICES = Array.from({ length: 9 }, (_, idx) => idx + 1);
export const ORANGE_MAIN_IDS = Array.from({ length: 10 }, (_, idx) => idx + 1);

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

  async claimedOrange(addr) {
    return await this.contract.claimedOrange(addr);
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
    const sendOverrides = gasEstimate
      ? { gasLimit: gasEstimate.mul(120).div(100), ...overrides }
      : overrides;
    const tx = await method(...args, sendOverrides);
    const receipt = await tx.wait(1);
    return receipt;
  }

  async getAllStats(walletAddress = null) {
    const blockPaidPromise = Promise.all(
      BLOCK_INDICES.map((idx) => this.blockPaid(idx)),
    );
    const orangePaidPromise = Promise.all(
      ORANGE_MAIN_IDS.map((id) => this.orangeMainIdPaid(id)),
    );
    const claimedOrangePromise = walletAddress
      ? this.claimedOrange(walletAddress)
      : Promise.resolve(false);
    const promises = [
      this.blockReward(),
      this.blockWinnersCount(),
      this.orangeReward(),
      this.orangeWinnersCount(),
      this.rainbowReward(),
      this.rainbowRewardClaimedGlobal(),
      this.distributor(),
      this.main(),
      this.owner(),
      blockPaidPromise,
      orangePaidPromise,
      claimedOrangePromise,
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
      claimedOrangeRaw,
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
      claimedOrange: Boolean(claimedOrangeRaw),
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



