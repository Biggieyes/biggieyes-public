import * as React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseUnits } from "ethers";
import LiveStats from "../src/components/LiveStats.jsx";
import { DEFAULT_BLOCKS } from "../src/shared/blocks";

const mocks = vi.hoisted(() => ({
  token: {},
  quote: {},
  pair: {},
  rewards: null,
}));
vi.mock("ethers", async (importOriginal) => ({
  ...(await importOriginal()),
  Contract: vi.fn(function (address) {
    return address === "token" ? mocks.token : mocks.quote;
  }),
}));
vi.mock("@/shared/utils/contract", () => ({
  ADDR: {
    BIGGI: "token",
    PAIR: "pair",
    RESERVE: "reserve",
    TOKEN_REWARDS: "rewards",
    DRIP_DISTRIBUTOR: "drip",
  },
  getROProvider: () => ({}),
  getReaderRO: () => null,
  getReadOnlyMain: () => null,
  getReadOnlyChapterMain: () => null,
  getReadOnlyChapterMain2: () => null,
  getTokenREWARDSRO: () => mocks.rewards,
  getDistributorRO: () => null,
  getReadOnlyLiquidityContract: () => null,
  getTokenRO: () => mocks.token,
  getPairRO: () => mocks.pair,
  getInjectedProvider: () => null,
  resetROProvider: vi.fn(),
}));
vi.mock("../src/hooks/useWeeklyCountdown", () => ({
  default: () => ({ displayed: null, syncWeeklyInfo: vi.fn() }),
}));

const amount = (value) => parseUnits(String(value), 18);
const capital = (container) =>
  within(container.querySelector(".ls-summary-card--capital"));
const market = (container) =>
  within(container.querySelector(".ls-summary-card--market"));
const fmt = (value) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 0 });
const props = { maxSupply: 550, blockNames: DEFAULT_BLOCKS };

beforeEach(() => {
  mocks.token = {
    totalSupply: vi.fn().mockResolvedValue(amount(1000)),
    decimals: vi.fn().mockResolvedValue(18n),
    symbol: vi.fn().mockResolvedValue("BIGGI"),
    balanceOf: vi.fn().mockResolvedValue(amount(100)),
  };
  mocks.quote = {
    decimals: vi.fn().mockResolvedValue(6n),
    symbol: vi.fn().mockResolvedValue("USDC"),
  };
  mocks.pair = {
    getReserves: vi.fn().mockResolvedValue([amount(100), parseUnits("200", 6)]),
    token0: vi.fn().mockResolvedValue("token"),
    token1: vi.fn().mockResolvedValue("quote"),
  };
  mocks.rewards = null;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
});

describe("LiveStats partial read failures", () => {
  it("does not treat missing token decimals as zero decimals or publish a derived market cap", async () => {
    mocks.token.decimals.mockRejectedValue(new Error("Unavailable decimals"));
    const { container } = render(<LiveStats {...props} />);
    await act(async () => {});
    expect(capital(container).getByText("-")).toBeInTheDocument();
    expect(mocks.token.balanceOf).not.toHaveBeenCalled();
  });

  it("does not invent locked balances after a partial failure", async () => {
    mocks.token.balanceOf.mockImplementation(async (address) => {
      if (address === "reserve") throw new Error("RPC unavailable");
      return amount(100);
    });
    const { container } = render(<LiveStats {...props} />);
    await act(async () => {});
    expect(capital(container).getByText("-")).toBeInTheDocument();
    expect(market(container).getByText("2.000 USDC")).toBeInTheDocument();
  });

  it("labels market cap with the same quote currency as the price", async () => {
    const { container } = render(<LiveStats {...props} />);
    await act(async () => {});
    expect(market(container).getByText("2.000 USDC")).toBeInTheDocument();
    expect(
      capital(container).getByText(
        (_, node) => node.textContent === `${fmt(1400)} USDC`,
      ),
    ).toBeInTheDocument();
  });

  it("accepts genuine zero-decimal quote tokens without substituting 18 decimals", async () => {
    mocks.quote.decimals.mockResolvedValue(0n);
    mocks.pair.getReserves.mockResolvedValue([amount(100), 200n]);
    const { container } = render(<LiveStats {...props} />);
    await act(async () => {});
    expect(market(container).getByText("2.000 USDC")).toBeInTheDocument();
  });

  it("does not fabricate a DEX price when quote decimals cannot be read", async () => {
    mocks.quote.decimals.mockRejectedValue(new Error("Unavailable decimals"));
    const { container } = render(<LiveStats {...props} />);
    await act(async () => {});
    expect(market(container).getAllByText("-")).toHaveLength(2);
  });

  it("accepts real zero locked balances", async () => {
    mocks.token.balanceOf.mockResolvedValue(0n);
    const { container } = render(<LiveStats {...props} />);
    await act(async () => {});
    expect(
      capital(container).getByText(
        (_, node) => node.textContent === `${fmt(2000)} USDC`,
      ),
    ).toBeInTheDocument();
  });
});

async function weeklyAmount() {
  const { container } = render(
    <LiveStats
      {...props}
      walletAddress="wallet"
      items={[
        {
          tokenId: "1001",
          contractAddress: "collection",
          image: "/nft.png",
          meta: { attributes: [{ trait_type: "Block ID", value: 1 }] },
        },
      ]}
    />,
  );
  await act(async () => {});
  fireEvent.click(
    within(container).getByRole("button", { name: "COLLECTION STATS" }),
  );
  const label = screen.getByText("My weekly BIGGI");
  return label.parentElement.querySelector(".collection-stat-value")
    .textContent;
}
const rewardContract = (unit) => ({
  getBlockWeights: vi
    .fn()
    .mockResolvedValue(Array.from({ length: 11 }, (_, i) => i)),
  unitReward: vi.fn().mockResolvedValue(unit),
  tokenMeta: vi.fn().mockResolvedValue(["Biggi", "BIGGI", 18n]),
});

describe("LiveStats weekly amount presentation", () => {
  it("does not label reward-weight units as tokens before the amount is known", async () => {
    expect(await weeklyAmount()).toBe("-- BIGGI");
  });

  it("preserves the amount calculated from complete contract data", async () => {
    mocks.rewards = rewardContract(amount(2));
    expect(await weeklyAmount()).toBe("2.000 BIGGI");
  });

  it("preserves a genuine zero unit reward", async () => {
    mocks.rewards = rewardContract(0n);
    expect(await weeklyAmount()).toBe("0.000000 BIGGI");
  });

  it("does not estimate tokens from fallback weights when contract weights are absent", async () => {
    mocks.rewards = rewardContract(amount(2));
    mocks.rewards.getBlockWeights.mockResolvedValue(null);
    expect(await weeklyAmount()).toBe("-- BIGGI");
  });

  it("does not convert a missing reward decimals field to zero", async () => {
    mocks.rewards = rewardContract(amount(2));
    mocks.rewards.tokenMeta.mockResolvedValue(["Biggi", "BIGGI", null]);
    expect(await weeklyAmount()).toBe("-- BIGGI");
  });

  it("does not relabel a WETH quote as native POL", async () => {
    mocks.quote.symbol.mockResolvedValue("WETH");
    const { container } = render(<LiveStats {...props} />);
    await act(async () => {});
    expect(market(container).getByText("2.000 WETH")).toBeInTheDocument();
  });
});
