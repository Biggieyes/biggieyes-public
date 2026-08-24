import { beforeEach, describe, expect, it, vi } from "vitest";

const { ContractMock } = vi.hoisted(() => ({
  ContractMock: vi.fn(),
}));

vi.mock("ethers", () => ({
  Contract: ContractMock,
}));

import CollectionRewardsService from "@/shared/services/collectionRewardsService.js";

const COLLECTION = "0x2222222222222222222222222222222222222222";

const buildContractMock = (overrides = {}) => ({
  blockReward: vi.fn().mockResolvedValue(3000n),
  blockWinnersCount: vi.fn().mockResolvedValue(2n),
  orangeReward: vi.fn().mockResolvedValue(1000n),
  orangeWinnersCount: vi.fn().mockResolvedValue(1n),
  rainbowReward: vi.fn().mockResolvedValue(10000n),
  rainbowRewardClaimedGlobal: vi.fn().mockResolvedValue(false),
  distributor: vi.fn().mockResolvedValue("0x1111111111111111111111111111111111111111"),
  defaultMain: vi.fn().mockResolvedValue(COLLECTION),
  owner: vi.fn().mockResolvedValue("0x3333333333333333333333333333333333333333"),
  blockPaid: vi
    .fn()
    .mockImplementation((collection, idx) =>
      Promise.resolve(collection === COLLECTION && idx === 1),
    ),
  orangeMainIdPaid: vi
    .fn()
    .mockImplementation((collection, mainId) =>
      Promise.resolve(collection === COLLECTION && mainId === 2),
    ),
  canClaimBlockFor: vi.fn().mockResolvedValue([true, 0n]),
  canClaimOrangeFor: vi.fn().mockResolvedValue([true, 0n]),
  canClaimRainbowFor: vi.fn().mockResolvedValue([false, 3n]),
  ...overrides,
});

describe("CollectionRewardsService", () => {
  beforeEach(() => {
    ContractMock.mockReset();
  });

  it("returns core stats even when claimability reads revert", async () => {
    const contractMock = buildContractMock({
      canClaimBlockFor: vi.fn().mockRejectedValue(new Error("revert")),
      canClaimOrangeFor: vi.fn().mockRejectedValue(new Error("revert")),
      canClaimRainbowFor: vi.fn().mockRejectedValue(new Error("revert")),
    });
    ContractMock.mockImplementation(function MockContract() {
      return contractMock;
    });

    const service = new CollectionRewardsService(
      "0xa708E016dEC7B6a5b3da640c0d995895979cE332",
      { provider: true },
      COLLECTION,
    );
    const stats = await service.getAllStats(
      "0x4444444444444444444444444444444444444444",
    );

    expect(stats.blockReward).toBe(3000n);
    expect(stats.orangeReward).toBe(1000n);
    expect(stats.blockPaid).toHaveLength(9);
    expect(stats.orangeMainIdPaid).toHaveLength(10);
    expect(stats.blockClaimability).toEqual(
      Array.from({ length: 9 }, () => ({
        ok: null,
        reason: null,
        resolved: false,
      })),
    );
    expect(stats.orangeClaimability).toEqual(
      Array.from({ length: 10 }, () => ({
        ok: null,
        reason: null,
        resolved: false,
      })),
    );
    expect(stats.rainbowClaimability).toEqual({
      ok: null,
      reason: null,
      resolved: false,
    });
  });

  it("normalizes tuple claimability responses", async () => {
    const contractMock = buildContractMock({
      canClaimBlockFor: vi
        .fn()
        .mockImplementation((collection, _, idx) =>
          Promise.resolve([collection === COLLECTION && idx === 1, 0n]),
        ),
      canClaimOrangeFor: vi
        .fn()
        .mockImplementation((collection, _, mainId) =>
          Promise.resolve([
            false,
            collection === COLLECTION ? BigInt(mainId) : 8n,
          ]),
        ),
      canClaimRainbowFor: vi.fn().mockResolvedValue([false, 3n]),
    });
    ContractMock.mockImplementation(function MockContract() {
      return contractMock;
    });

    const service = new CollectionRewardsService(
      "0xa708E016dEC7B6a5b3da640c0d995895979cE332",
      { provider: true },
      COLLECTION,
    );
    const stats = await service.getAllStats(
      "0x5555555555555555555555555555555555555555",
    );

    expect(stats.blockClaimability[0]).toEqual({
      ok: true,
      reason: 0,
      resolved: true,
    });
    expect(stats.blockClaimability[1]).toEqual({
      ok: false,
      reason: 0,
      resolved: true,
    });
    expect(stats.orangeClaimability[0]).toEqual({
      ok: false,
      reason: 1,
      resolved: true,
    });
    expect(stats.orangeClaimability[9]).toEqual({
      ok: false,
      reason: 10,
      resolved: true,
    });
    expect(stats.rainbowClaimability).toEqual({
      ok: false,
      reason: 3,
      resolved: true,
    });
    expect(stats.collection).toBe(COLLECTION);
    expect(contractMock.blockPaid).toHaveBeenCalledWith(COLLECTION, 1);
    expect(contractMock.canClaimBlockFor).toHaveBeenCalledWith(
      COLLECTION,
      "0x5555555555555555555555555555555555555555",
      1,
    );
  });

  it("sends explicit collection claims with an ethers v6 gas estimate", async () => {
    const wait = vi.fn().mockResolvedValue({ status: 1 });
    const claimBlockRewardFor = vi.fn().mockResolvedValue({ wait });
    claimBlockRewardFor.estimateGas = vi.fn().mockResolvedValue(100n);
    const contractMock = buildContractMock({
      claimBlockRewardFor,
    });
    contractMock.connect = vi.fn().mockReturnValue(contractMock);
    ContractMock.mockImplementation(function MockContract() {
      return contractMock;
    });

    const service = new CollectionRewardsService(
      "0xa708E016dEC7B6a5b3da640c0d995895979cE332",
      { provider: true },
      COLLECTION,
    );
    service.connectWithSigner({ provider: { provider: true } });

    await service.claimBlockRewardFor(COLLECTION, 1);

    expect(claimBlockRewardFor.estimateGas).toHaveBeenCalledWith(
      COLLECTION,
      1,
      {},
    );
    expect(claimBlockRewardFor).toHaveBeenCalledWith(COLLECTION, 1, {
      gasLimit: 120n,
    });
    expect(wait).toHaveBeenCalledWith(1);
  });
});
