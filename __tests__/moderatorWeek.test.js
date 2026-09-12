import { beforeEach, describe, expect, it, vi } from "vitest";
import { multicallReadContract } from "../src/shared/utils/multicall.js";
import {
  parseModeratorWeek,
  readModeratorWeek,
} from "../src/features/admin/MODERATORCENTER/moderatorWeek.js";

vi.mock("../src/shared/utils/multicall.js", () => ({
  multicallReadContract: vi.fn(),
}));

const week = 2957;
const timestamp = (week + 1) * 604800 + 86400;
const contract = {
  target: "0x82Ad5a0f379CCA21AC2979E88AC24db94e670bD8",
  runner: {
    getNetwork: vi.fn(),
    getBlock: vi.fn(),
  },
};
const base = {
  currentWeek: BigInt(week + 1),
  WEEK: 604800n,
  SETTLEMENT_DELAY: 86400n,
  weekConfigVersion: 12n,
  weekSettled: false,
  weekAllocated: 9007199254740993123456789n,
  weekDistributed: 0n,
  weekRolledOver: 0n,
};

beforeEach(() => {
  vi.resetAllMocks();
  contract.runner.getNetwork.mockResolvedValue({ chainId: 137n });
  contract.runner.getBlock.mockResolvedValue({ number: 93471504, timestamp });
  multicallReadContract.mockImplementation(
    async (_provider, _contract, entries) => {
      if (entries[0].method === "currentWeek") return { ...base };
      return Object.fromEntries(
        entries.map(({ key, method, params }) => [
          key,
          method === "getWeekSlotConfig"
            ? {
                enabled: params[1] === 0,
                isLeader: params[1] === 0,
                payout: "0x1111111111111111111111111111111111111111",
              }
            : method === "getWeekStats"
              ? { uniqueRefs: 2n, ticketSales: 3n }
              : 230n,
        ]),
      );
    },
  );
});

describe("Moderator V2 weekly report", () => {
  it("reads historical identities at one block in two multicalls and preserves wei precision", async () => {
    const report = await readModeratorWeek(contract, week);
    expect(report).toMatchObject({
      week,
      chainId: 137,
      blockNumber: 93471504,
      opened: true,
      status: "Awaiting settlement",
      configVersion: "12",
      allocatedWei: "9007199254740993123456789",
      creditedWei: "0",
      settled: false,
      settlesAt: timestamp,
    });
    expect(report.slots[0]).toEqual({
      slotId: 0,
      enabled: true,
      isLeader: true,
      payout: "0x1111111111111111111111111111111111111111",
      uniqueBuyers: "2",
      paidTickets: "3",
      weight: "230",
    });
    expect(multicallReadContract).toHaveBeenCalledTimes(2);
    for (const call of multicallReadContract.mock.calls) {
      expect(call[4]).toEqual({ blockTag: 93471504 });
    }
    expect(multicallReadContract.mock.calls[1][2]).toHaveLength(30);
    expect(multicallReadContract.mock.calls[1][2][0]).toMatchObject({
      method: "getWeekSlotConfig",
      params: [week, 0],
    });
    expect(() => JSON.stringify(report)).not.toThrow();
  });

  it("does not request nonexistent snapshots for unopened weeks", async () => {
    multicallReadContract.mockResolvedValueOnce({
      ...base,
      weekConfigVersion: 0n,
      weekAllocated: 0n,
    });
    const report = await readModeratorWeek(contract, week);
    expect(report.opened).toBe(false);
    expect(report.status).toBe("Not opened");
    expect(report.slots).toEqual([]);
    expect(multicallReadContract).toHaveBeenCalledTimes(1);
  });

  it("uses the blockchain clock for the current week", async () => {
    const report = await readModeratorWeek(contract);
    expect(report.week).toBe(Math.floor(timestamp / 604800));
  });

  it.each([
    [week * 604800 + 1, false, "In progress"],
    [(week + 1) * 604800, false, "Settlement delay"],
    [timestamp, false, "Awaiting settlement"],
    [timestamp, true, "Settled"],
  ])(
    "reports settlement status from chain time %i and settled %s",
    async (now, settled, status) => {
      contract.runner.getBlock.mockResolvedValue({ number: 1, timestamp: now });
      multicallReadContract.mockResolvedValueOnce({
        ...base,
        weekSettled: settled,
      });
      expect((await readModeratorWeek(contract, week)).status).toBe(status);
    },
  );

  it("does not turn failed RPC data into zero rewards", async () => {
    multicallReadContract.mockRejectedValueOnce(new Error("429"));
    await expect(readModeratorWeek(contract, week)).rejects.toThrow("429");
    multicallReadContract.mockResolvedValueOnce({
      ...base,
      weekAllocated: undefined,
    });
    await expect(readModeratorWeek(contract, week)).rejects.toThrow(
      "incomplete",
    );
  });

  it("rejects the wrong chain before reading the contract", async () => {
    contract.runner.getNetwork.mockResolvedValue({ chainId: 80002n });
    await expect(readModeratorWeek(contract, week)).rejects.toThrow(
      "Polygon mainnet",
    );
    expect(multicallReadContract).not.toHaveBeenCalled();
  });

  it("validates weeks before making RPC requests", async () => {
    for (const value of ["", -1, 1.5, "1e3", "NaN", 1000001]) {
      expect(() => parseModeratorWeek(value)).toThrow();
      await expect(readModeratorWeek(contract, value)).rejects.toThrow();
    }
    expect(parseModeratorWeek("0")).toBe(0);
    expect(contract.runner.getNetwork).not.toHaveBeenCalled();
  });
});
