import { describe, expect, it, vi } from "vitest";
import { Interface } from "ethers";
import { multicallReadContract } from "../src/shared/utils/multicall.js";

describe("multicall block snapshots", () => {
  it("skips missing v6 ABI functions instead of encoding a null fragment", async () => {
    const provider = { call: vi.fn() };
    const iface = new Interface([
      "function currentWeek() view returns(uint256)",
    ]);
    expect(iface.getFunction("missingMethod")).toBeNull();
    expect(
      await multicallReadContract(
        provider,
        {
          target: "0x1111111111111111111111111111111111111111",
          interface: iface,
        },
        [{ method: "missingMethod" }],
      ),
    ).toBeNull();
    expect(provider.call).not.toHaveBeenCalled();
  });
  it("passes a pinned block through the shared reader without changing decoding", async () => {
    const iface = new Interface([
      "function weekAllocated(uint256) view returns(uint256)",
    ]);
    const aggregate = new Interface([
      "function aggregate((address target,bytes callData)[] calls) view returns(uint256,bytes[])",
    ]);
    const provider = {
      call: vi
        .fn()
        .mockResolvedValue(
          aggregate.encodeFunctionResult("aggregate", [
            93471504,
            [
              iface.encodeFunctionResult("weekAllocated", [
                9007199254740993123456789n,
              ]),
            ],
          ]),
        ),
    };
    const result = await multicallReadContract(
      provider,
      {
        target: "0x82Ad5a0f379CCA21AC2979E88AC24db94e670bD8",
        interface: iface,
      },
      [{ method: "weekAllocated", params: [2957] }],
      null,
      { blockTag: 93471504 },
    );
    expect(result.weekAllocated).toBe(9007199254740993123456789n);
    expect(provider.call).toHaveBeenCalledOnce();
    expect(provider.call.mock.calls[0][0].blockTag).toBe(93471504);
  });
});
