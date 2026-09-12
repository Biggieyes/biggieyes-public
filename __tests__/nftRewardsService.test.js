import { describe, expect, it, vi } from "vitest";

import NFTREWARDSService, {
  normalizeRewardEvent,
  normalizeRewardInfo,
} from "../src/shared/services/nftRewardsService.js";

const ADDRESS = "0x1111111111111111111111111111111111111111";

describe("NFTREWARDSService", () => {
  it("does not send a claim when gas estimation fails", async () => {
    const service = Object.create(NFTREWARDSService.prototype);
    service._signerConnected = true;
    const claim = vi.fn();
    claim.estimateGas = vi
      .fn()
      .mockRejectedValue(new Error("AlreadyClaimedError"));
    service.contract = { claim };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(service.claim(1)).rejects.toThrow("AlreadyClaimedError");
    expect(claim).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it.each([
    [80002, ADDRESS, ADDRESS, false, "Polygon mainnet"],
    [
      137,
      "0x2222222222222222222222222222222222222222",
      ADDRESS,
      false,
      "account changed",
    ],
    [
      137,
      ADDRESS,
      "0x2222222222222222222222222222222222222222",
      false,
      "not assigned",
    ],
    [137, ADDRESS, ADDRESS, true, "already claimed"],
  ])(
    "blocks an invalid claim context (%s, %s)",
    async (chainId, account, assigned, claimed, message) => {
      const service = Object.create(NFTREWARDSService.prototype);
      service.connectWithSigner = vi.fn();
      service.rewardInfo = vi
        .fn()
        .mockResolvedValue([assigned, claimed, "ipfs://one"]);
      service.claim = vi.fn();
      const signer = {
        provider: { getNetwork: vi.fn().mockResolvedValue({ chainId }) },
        getAddress: vi.fn().mockResolvedValue(account),
      };
      await expect(service.claimForWallet(1, signer, ADDRESS)).rejects.toThrow(
        message,
      );
      expect(service.claim).not.toHaveBeenCalled();
    },
  );

  it("claims only after checking the signer and fresh assignment", async () => {
    const service = Object.create(NFTREWARDSService.prototype);
    service.connectWithSigner = vi.fn();
    service.readOverrides = { blockTag: 12 };
    service.rewardInfo = vi
      .fn()
      .mockResolvedValue([ADDRESS, false, "ipfs://one"]);
    service.claim = vi.fn().mockResolvedValue({ status: 1 });
    const signer = {
      provider: { getNetwork: vi.fn().mockResolvedValue({ chainId: 137n }) },
      getAddress: vi.fn().mockResolvedValue(ADDRESS),
    };
    await service.claimForWallet(1, signer, ADDRESS);
    expect(service.readOverrides).toEqual({});
    expect(service.connectWithSigner).toHaveBeenCalledWith(signer);
    expect(service.claim).toHaveBeenCalledWith(1);
  });

  it("passes the snapshot block to reward reads", async () => {
    const service = Object.create(NFTREWARDSService.prototype);
    service.readOverrides = { blockTag: 123 };
    service.contract = {
      rewardInfo: vi.fn().mockResolvedValue([ADDRESS, false, "ipfs://one"]),
    };
    await service.rewardInfo(1);
    expect(service.contract.rewardInfo).toHaveBeenCalledWith(1, {
      blockTag: 123,
    });
  });

  it("can read event history older than the first page", async () => {
    const service = Object.create(NFTREWARDSService.prototype);
    service.nextEventId = vi.fn().mockResolvedValue(103n);
    service.events = vi
      .fn()
      .mockResolvedValue([2n, ADDRESS, 1n, 1n, false, false, 0n]);
    service.eventEligibleCount = vi.fn().mockResolvedValue(0n);
    const events = await service.fetchEventsDetailed({
      limit: 100,
      offset: 100,
    });
    expect(events.map((event) => event.eventId)).toEqual([1, 2]);
  });
  it("normalizes named and positional ABI results", () => {
    expect(
      normalizeRewardEvent(
        {
          kind: 3n,
          creator: ADDRESS,
          rewardStartId: 11n,
          rewardCount: 2n,
          randomnessRequested: true,
          finished: false,
          vrfRequestId: 99n,
        },
        4,
      ),
    ).toMatchObject({
      eventId: 4,
      kind: 3,
      rewardStartId: 11,
      rewardCount: 2,
      vrfRequestId: 99n,
    });

    expect(normalizeRewardInfo([ADDRESS, true, "ipfs://reward/1"], 1)).toEqual({
      rewardId: 1,
      assigned: ADDRESS,
      isClaimed: true,
      uri: "ipfs://reward/1",
    });
  });

  it("reads only real event IDs and preserves deployed ABI field names", async () => {
    const service = Object.create(NFTREWARDSService.prototype);
    service.nextEventId = vi.fn().mockResolvedValue(3n);
    service.events = vi.fn(async (eventId) => ({
      kind: eventId === 1 ? 2n : 3n,
      creator: ADDRESS,
      rewardStartId: BigInt(eventId),
      rewardCount: 1n,
      randomnessRequested: eventId === 2,
      finished: eventId === 1,
      vrfRequestId: eventId === 2 ? 55n : 0n,
    }));
    service.eventEligibleCount = vi.fn().mockResolvedValue(0n);

    const events = await service.fetchEventsDetailed();

    expect(events.map((event) => event.eventId)).toEqual([1, 2]);
    expect(events[1]).toMatchObject({
      rewardStartId: 2,
      vrfRequestId: 55n,
      randomnessRequested: true,
    });
    expect(service.events).not.toHaveBeenCalledWith(0);
  });

  it("starts reward scans at ID 1", async () => {
    const service = Object.create(NFTREWARDSService.prototype);
    service.rewardInfo = vi.fn(async (rewardId) => [
      ADDRESS,
      false,
      `ipfs://reward/${rewardId}`,
    ]);

    const rewards = await service.fetchREWARDSRange(0, 3);

    expect(rewards.map((reward) => reward.rewardId)).toEqual([1, 2]);
    expect(service.rewardInfo).not.toHaveBeenCalledWith(0);
  });

  it("uses ethers v6 method gas estimation before claim", async () => {
    const receipt = { status: 1 };
    const wait = vi.fn().mockResolvedValue(receipt);
    const claim = vi.fn().mockResolvedValue({ wait });
    claim.estimateGas = vi.fn().mockResolvedValue(100n);
    const service = Object.create(NFTREWARDSService.prototype);
    service._signerConnected = true;
    service.contract = { claim };

    await expect(service.claim(7)).resolves.toBe(receipt);
    expect(claim.estimateGas).toHaveBeenCalledWith(7, {});
    expect(claim).toHaveBeenCalledWith(7, { gasLimit: 120n });
    expect(wait).toHaveBeenCalledWith(1);
  });

  it("reads V2 ownership without calling removed V1 wiring getters", async () => {
    const service = Object.create(NFTREWARDSService.prototype);
    service.name = vi.fn().mockResolvedValue("Biggi Reward");
    service.symbol = vi.fn().mockResolvedValue("BGR");
    service.nextEventId = vi.fn().mockResolvedValue(1n);
    service.nextRewardId = vi.fn().mockResolvedValue(1n);
    service.vrfRouter = vi.fn().mockResolvedValue(ADDRESS);
    service.owner = vi.fn().mockResolvedValue(ADDRESS);
    service.pendingOwner = vi
      .fn()
      .mockResolvedValue("0x0000000000000000000000000000000000000000");
    service.mysteryRetryDelay = vi.fn().mockResolvedValue(900n);

    await expect(service.getAllStats()).resolves.toMatchObject({
      version: 2,
      pendingOwner: "0x0000000000000000000000000000000000000000",
      totalEventsCreated: 0,
      totalRewardsCreated: 0,
    });
  });
});
