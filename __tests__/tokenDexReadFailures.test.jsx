import React from "react";
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Interface, ZeroAddress } from "ethers";
import { UniswapV2Pair } from "../src/config/abi/index.js";
import { fetchTokenDexSnapshot } from "../src/shared/services/tokenomics/tokenDex.reader.js";
import useTokenDexSnapshot from "../src/hooks/tokenomics/useTokenDexSnapshot.js";
import { mapRawSnapshotToUI } from "../src/shared/services/tokenomics/tokenDex.mappers.js";
import TokenDexTab from "../src/features/tokenomics/tabs/TokenDexTab.jsx";

const fixture = vi.hoisted(() => ({
  contracts: null,
  multicall: vi.fn(),
  provider: { kind: "read-only" },
}));
vi.mock("../src/web3/provider", () => ({
  getProvider: () => fixture.provider,
}));
vi.mock("../src/web3/contracts/tokenDex.contracts", () => ({
  getTokenDexContracts: () => fixture.contracts,
}));
vi.mock("@/shared/utils/multicall", () => ({
  multicallAggregate: (...args) => fixture.multicall(...args),
}));
vi.mock("@/providers/Web3Context.js", () => ({
  useWeb3: () => ({ chainId: 137, provider: fixture.provider }),
}));

const addr = (n) => `0x${String(n).padStart(40, "0")}`;
const ONE = 10n ** 18n;
const pairIface = new Interface(UniswapV2Pair);
const reserves = (a, b) =>
  pairIface.decodeFunctionResult(
    "getReserves",
    pairIface.encodeFunctionResult("getReserves", [a, b, 10]),
  );
const revert = () =>
  Object.assign(new Error("UniswapV2Library: INSUFFICIENT_LIQUIDITY"), {
    code: "CALL_EXCEPTION",
  });

beforeEach(() => {
  const values = {
    name: "BIGGI",
    symbol: "BIGGI",
    decimals: 18n,
    totalSupply: 1000n * ONE,
    CAP: 10000n * ONE,
    remainingMintable: 9000n * ONE,
    reserveAddr: addr(8),
    dripDistributorAddr: ZeroAddress,
    tokenRewardsAddr: ZeroAddress,
    rewardsOperator: ZeroAddress,
  };
  const token = {
    target: addr(1),
    balanceOf: vi.fn().mockResolvedValue(3n * ONE),
  };
  token.interface = new Interface(
    Object.keys(values).map(
      (name) =>
        `function ${name}() view returns (${
          typeof values[name] === "bigint"
            ? "uint256"
            : name === "name" || name === "symbol"
            ? "string"
            : "address"
        })`,
    ),
  );
  for (const [name, value] of Object.entries(values))
    token[name] = vi.fn().mockResolvedValue(value);
  const pair = {
    target: addr(3),
    interface: pairIface,
    getReserves: vi.fn().mockResolvedValue(reserves(0n, 0n)),
    token0: vi.fn().mockResolvedValue(addr(1)),
    token1: vi.fn().mockResolvedValue(addr(2)),
    totalSupply: vi.fn().mockResolvedValue(0n),
  };
  fixture.contracts = {
    token,
    pair,
    router: {
      target: addr(4),
      getAmountsOut: vi.fn().mockResolvedValue([ONE, ONE / 100n]),
    },
    factory: { getPair: vi.fn().mockResolvedValue(ZeroAddress) },
    priceFeed: null,
    addrs: {
      weth: addr(2),
      pairAddress: addr(3),
      factory: addr(5),
      reserve: addr(8),
    },
  };
  fixture.multicall.mockReset().mockImplementation(async (_provider, calls) =>
    Promise.all(
      calls.map(async (call) => {
        const contract = call.target === token.target ? token : pair;
        const value = await contract[call.method](...(call.params || []));
        return call.method === "getReserves" ? value : [value];
      }),
    ),
  );
});

describe("Token / DEX read failures", () => {
  it.each([
    [0n, 0n],
    [ONE, 0n],
    [0n, ONE],
  ])("does not quote an unfunded pair (%s / %s)", async (a, b) => {
    fixture.contracts.pair.getReserves.mockResolvedValue(reserves(a, b));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const raw = await fetchTokenDexSnapshot({ chainId: 137 });
    expect(raw.dex.quoteStatus).toBe("no_liquidity");
    expect(raw.dex.routerNativeOut).toBeNull();
    expect(fixture.contracts.router.getAmountsOut).not.toHaveBeenCalled();
    expect(raw.token.balances.reserve).toBe(3n * ONE);
    expect(warning).not.toHaveBeenCalled();
    warning.mockRestore();
    expect(mapRawSnapshotToUI(raw).dex.derived.marketHealth).toBe(
      "No liquidity",
    );
    expect(
      mapRawSnapshotToUI(raw).dex.price.pair.nativePerBiggiNumeric,
    ).toBeNull();
  });

  it("resumes quotes when the same pair is funded", async () => {
    await fetchTokenDexSnapshot();
    fixture.contracts.pair.getReserves.mockResolvedValue(
      reserves(100n * ONE, ONE),
    );
    const raw = await fetchTokenDexSnapshot();
    expect(raw.dex.quoteStatus).toBe("ready");
    expect(
      fixture.contracts.router.getAmountsOut,
    ).toHaveBeenCalledExactlyOnceWith(ONE, [addr(1), addr(2)]);
    expect(raw.dex.routerNativeOut).toBe(ONE / 100n);
  });

  it("does not quote when the factory has no pair", async () => {
    fixture.contracts.pair = null;
    fixture.contracts.addrs.pairAddress = null;
    const raw = await fetchTokenDexSnapshot();
    expect(raw.dex.pair).toBeNull();
    expect(raw.dex.routerNativeOut).toBeNull();
    expect(fixture.contracts.router.getAmountsOut).not.toHaveBeenCalled();
  });

  it("does not quote a mismatched configured pair", async () => {
    fixture.contracts.pair.getReserves.mockResolvedValue(reserves(ONE, ONE));
    fixture.contracts.pair.token1.mockResolvedValue(addr(99));
    const raw = await fetchTokenDexSnapshot();
    expect(raw.dex.quoteStatus).toBe("pair_mismatch");
    expect(fixture.contracts.router.getAmountsOut).not.toHaveBeenCalled();
  });

  it.each([
    new TypeError("Failed to fetch"),
    { code: "SERVER_ERROR", message: "HTTP 503" },
    { code: "CALL_EXCEPTION", info: { error: { code: -32005 } } },
    {
      code: "BAD_DATA",
      value: [{ code: -32005, message: "Too Many Requests" }],
    },
  ])(
    "stops after a transport failure without per-field fallback reads",
    async (error) => {
      fixture.multicall.mockRejectedValue(error);
      await expect(fetchTokenDexSnapshot()).rejects.toMatchObject({
        code: "TOKEN_DEX_READ_FAILED",
      });
      expect(fixture.multicall).toHaveBeenCalledTimes(1);
      expect(fixture.contracts.token.decimals).not.toHaveBeenCalled();
      expect(fixture.contracts.token.balanceOf).not.toHaveBeenCalled();
      expect(fixture.contracts.router.getAmountsOut).not.toHaveBeenCalled();
    },
  );

  it("retains individual reads when an optional multicall reverts", async () => {
    fixture.multicall.mockRejectedValueOnce(revert());
    const raw = await fetchTokenDexSnapshot();
    expect(raw.token.totalSupply).toBe(1000n * ONE);
    expect(raw.token.decimals).toBe(18);
    expect(raw.dex.quoteStatus).toBe("no_liquidity");
  });

  it("does not include methods absent from the ABI in multicall", async () => {
    fixture.contracts.token.interface = new Interface([
      "function decimals() view returns (uint8)",
      "function totalSupply() view returns (uint256)",
    ]);
    delete fixture.contracts.token.CAP;
    const raw = await fetchTokenDexSnapshot();
    expect(
      fixture.multicall.mock.calls[0][1].map((call) => call.method),
    ).toEqual(["decimals", "totalSupply"]);
    expect(raw.token.cap).toBeNull();
  });

  it("handles a quote reverting after a successful reserve read without a warning loop", async () => {
    fixture.contracts.pair.getReserves.mockResolvedValue(reserves(ONE, ONE));
    fixture.contracts.router.getAmountsOut.mockRejectedValue(revert());
    const raw = await fetchTokenDexSnapshot();
    expect(raw.dex.routerNativeOut).toBeNull();
    expect(raw.dex.quoteStatus).toBe("unavailable");
  });

  it("uses zero token decimals without substituting 18", async () => {
    fixture.contracts.token.decimals.mockResolvedValue(0n);
    fixture.contracts.pair.getReserves.mockResolvedValue(reserves(ONE, ONE));
    expect((await fetchTokenDexSnapshot()).token.decimals).toBe(0);
    expect(fixture.contracts.router.getAmountsOut).toHaveBeenCalledWith(1n, [
      addr(1),
      addr(2),
    ]);
  });

  it("keeps the last good hook snapshot on RPC failure and recovers on refresh", async () => {
    const { result } = renderHook(() =>
      useTokenDexSnapshot({ intervalMs: 0, pauseWhenHidden: false }),
    );
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    expect(result.current.snapshot.derived.priceNativePerToken).toBeNull();
    const good = result.current.snapshot;
    fixture.multicall.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await act(async () => result.current.refresh(true));
    expect(result.current.snapshot).toBe(good);
    expect(result.current.error?.code).toBe("TOKEN_DEX_READ_FAILED");
    await act(async () => result.current.refresh(true));
    expect(result.current.error).toBeNull();
  });

  it("shows stale state while retaining the last snapshot in the panel", async () => {
    const raw = await fetchTokenDexSnapshot();
    render(
      <TokenDexTab
        tokenDexSnapshot={raw}
        error={new Error("temporary RPC error")}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing the last successful snapshot",
    );
    expect(screen.getAllByText("No liquidity").length).toBeGreaterThan(0);
  });
});
