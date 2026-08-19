import { beforeEach, describe, expect, it, vi } from "vitest";

const { ContractMock } = vi.hoisted(() => ({
  ContractMock: vi.fn(),
}));

vi.mock("ethers", () => ({
  Contract: ContractMock,
}));

import CollectionRewardsService from "@/shared/services/collectionRewardsService.js";

const buildContractMock = (overrides = {}) => ({
  blockReward: vi.fn().mockResolvedValue(3000n),
  blockWinnersCount: vi.fn().mockResolvedValue(2n),
  orangeReward: vi.fn().mockResolvedValue(1000n),
  orangeWinnersCount: vi.fn().mockResolvedValue(1n),
  rainbowReward: vi.fn().mockResolvedValue(10000n),
  rainbowRewardClaimedGlobal: vi.fn().mockResolvedValue(false),
  distributor: vi.fn().mockResolvedValue("0x1111111111111111111111111111111111111111"),
  main: vi.fn().mockResolvedValue("0x2222222222222222222222222222222222222222"),
  owner: vi.fn().mockResolvedValue("0x3333333333333333333333333333333333333333"),
  blockPaid: vi.fn().mockImplementation((idx) => Promise.resolve(idx === 1)),
  orangeMainIdPaid: vi
    .fn()
    .mockImplementation((mainId) => Promise.resolve(mainId === 2)),
  canClaimBlock: vi.fn().mockResolvedValue([true, 0n]),
  canClaimOrange: vi.fn().mockResolvedValue([true, 0n]),
  canClaimRainbow: vi.fn().mockResolvedValue([false, 3n]),
  ...overrides,
});

describe("CollectionRewardsService", () => {
  beforeEach(() => {
    ContractMock.mockReset();
  });

  it("returns core stats even when claimability reads revert", async () => {
    const contractMock = buildContractMock({
      canClaimBlock: vi.fn().mockRejectedValue(new Error("revert")),
      canClaimOrange: vi.fn().mockRejectedValue(new Error("revert")),
      canClaimRainbow: vi.fn().mockRejectedValue(new Error("revert")),
    });
    ContractMock.mockImplementation(function MockContract() {
      return contractMock;
    });

    const service = new CollectionRewardsService(
      "0xa708E016dEC7B6a5b3da640c0d995895979cE332",
      { provider: true },
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
      canClaimBlock: vi
        .fn()
        .mockImplementation((_, idx) => Promise.resolve([idx === 1, 0n])),
      canClaimOrange: vi
        .fn()
        .mockImplementation((_, mainId) => Promise.resolve([false, BigInt(mainId)])),
      canClaimRainbow: vi.fn().mockResolvedValue([false, 3n]),
    });
    ContractMock.mockImplementation(function MockContract() {
      return contractMock;
    });

    const service = new CollectionRewardsService(
      "0xa708E016dEC7B6a5b3da640c0d995895979cE332",
      { provider: true },
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
  });
});
