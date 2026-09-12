import { Contract } from "ethers";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  contracts: {},
  multicall: vi.fn().mockResolvedValue({}),
}));
vi.mock("../src/web3/provider", () => ({
  default: {},
  getProvider: () => ({}),
}));
vi.mock("../src/web3/contracts/liquidity.contracts", () => ({
  getLiquidityContracts: () => mocks.contracts,
}));
vi.mock("../src/config/addresses/index.js", () => ({
  getTokenDexAddresses: () => ({}),
}));
vi.mock("@/shared/utils/multicall.js", () => ({
  multicallReadContract: mocks.multicall,
}));
import { fetchLiquiditySnapshot } from "../src/shared/services/tokenomics/liquidity.reader.js";

describe("liquidity ethers v6 targets", () => {
  it("reads a real v6 helper instance and preserves configured addresses", async () => {
    const address = (n) => `0x${String(n).padStart(40, "0")}`;
    mocks.contracts = {
      reserve: new Contract(address(1), []),
      manager: new Contract(address(2), []),
      vault: new Contract(address(3), []),
      helper: new Contract(
        address(4),
        [
          "function routerInfo() view returns(address routerAddr,address factory)",
        ],
        {
          call: vi.fn(async () =>
            mocks.contracts.helper.interface.encodeFunctionResult(
              "routerInfo",
              [address(5), address(6)],
            ),
          ),
        },
      ),
    };
    expect(mocks.contracts.helper.address).toBeUndefined();
    const result = await fetchLiquiditySnapshot({ chainId: 137, provider: {} });
    expect(mocks.contracts.helper.runner.call).toHaveBeenCalledOnce();
    expect(result.reserve.address).toBe(address(1));
    expect(result.manager.address).toBe(address(2));
    expect(result.vault.address).toBe(address(3));
    expect(result.manager.routerAddress).toBe(address(5));
    expect(result.manager.factoryAddress).toBe(address(6));
  });
});
