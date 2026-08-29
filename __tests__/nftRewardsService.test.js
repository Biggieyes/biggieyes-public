import { describe, expect, it, vi } from "vitest";

import NFTREWARDSService, {
  normalizeRewardEvent,
  normalizeRewardInfo,
} from "../src/shared/services/nftRewardsService.js";

const ADDRESS = "0x1111111111111111111111111111111111111111";

describe("NFTREWARDSService", () => {
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

  it("treats removed V1-only wiring reads as optional for V2", async () => {
    const service = Object.create(NFTREWARDSService.prototype);
    service.name = vi.fn().mockResolvedValue("Biggi Reward");
    service.symbol = vi.fn().mockResolvedValue("BGR");
    service.nextEventId = vi.fn().mockResolvedValue(1n);
    service.nextRewardId = vi.fn().mockResolvedValue(1n);
    service.vrfRouter = vi.fn().mockResolvedValue(ADDRESS);
    service.mainContract = vi.fn().mockRejectedValue(new Error("missing selector"));
    service.owner = vi.fn().mockResolvedValue(ADDRESS);
    service.registry = vi.fn().mockRejectedValue(new Error("missing selector"));
    service.mysteryRetryDelay = vi.fn().mockResolvedValue(900n);

    await expect(service.getAllStats()).resolves.toMatchObject({
      mainContract: null,
      registry: null,
      totalEventsCreated: 0,
      totalRewardsCreated: 0,
    });
  });
});
