import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LiveStats from "../src/components/LiveStats.jsx";
import { DEFAULT_BLOCKS } from "../src/shared/blocks.js";

const mocks = vi.hoisted(() => ({
  token: {},
  lp: {},
  provider: {},
  snapshot: null,
  fetchSnapshot: vi.fn(),
  reset: vi.fn(),
  mark: vi.fn(),
  addresses: Object.fromEntries(
    [
      "BIGGI",
      "PAIR",
      "RESERVE",
      "TREASURY",
      "BUYBACK_AGENT",
      "COLLECTION_REWARDS",
      "COMMUNITY_CENTER",
      "TOKEN_REWARDS",
      "NFT_REWARDS",
      "LIQUIDITY_VAULT",
      "LM",
      "DISTRIBUTOR",
    ].map((key, i) => [key, `0x${(i + 1).toString(16).padStart(40, "0")}`]),
  ),
}));
vi.mock("ethers", async (load) => ({
  ...(await load()),
  Contract: vi.fn(function (address) {
    return address === mocks.addresses.BIGGI
      ? mocks.token
      : address === mocks.addresses.PAIR
        ? mocks.lp
        : {};
  }),
}));
vi.mock("@/shared/utils/contract", () => ({
  ADDR: mocks.addresses,
  getROProvider: () => mocks.provider,
  resetROProvider: mocks.reset,
  getDistributorRO: () => ({ totalReceived: vi.fn(async () => 0n) }),
  getReaderRO: () => null,
  getReadOnlyMain: () => null,
  getReadOnlyChapterMain: () => null,
  getReadOnlyChapterMain2: () => null,
  getTokenREWARDSRO: () => null,
  getReadOnlyLiquidityContract: () => null,
  getTokenRO: () => mocks.token,
  getPairRO: () => null,
  getInjectedProvider: () => null,
}));
vi.mock("@/shared/utils/rpcConfig", async (load) => ({
  ...(await load()),
  getPreferredRpc: () => "https://rpc.example",
  getRpcUrls: () => ["https://rpc.example", "https://other.example"],
  markRpcRateLimited: mocks.mark,
  setPreferredRpc: vi.fn(),
}));
vi.mock("@/shared/services/tokenomics/distributor.reader", () => ({
  fetchDistributorSnapshot: mocks.fetchSnapshot,
}));
vi.mock("../src/hooks/useWeeklyCountdown", () => ({
  default: () => ({ displayed: null, syncWeeklyInfo: vi.fn() }),
}));

const unit = 10n ** 18n;
const props = { maxSupply: 550, blockNames: DEFAULT_BLOCKS };
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const allocation = () =>
  screen
    .getByRole("dialog", { name: "Tokenomics" })
    .querySelector(".ls-tokenomics-modal__section--allocation");
async function open() {
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "TOKENOMICS", exact: true }),
    ),
  );
}
function valueFor(section, name) {
  return within(section)
    .getByText(name, { exact: true })
    .closest(".collection-stat-card")
    .querySelector(".collection-stat-value").textContent;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.scrollTo = vi.fn();
  mocks.provider = {
    getBlockNumber: vi.fn(async () => 123),
    getBalance: vi.fn(async () => unit),
  };
  mocks.token = {
    balanceOf: vi.fn(async () => 2n * unit),
    decimals: vi.fn(async () => 18n),
    symbol: vi.fn(async () => "BIGGI"),
    totalSupply: vi.fn(async () => 100n * unit),
  };
  mocks.lp = {
    balanceOf: vi.fn(async () => 3n * unit),
    decimals: vi.fn(async () => 18n),
    symbol: vi.fn(async () => "LP"),
    totalSupply: vi.fn(async () => 10n * unit),
  };
  mocks.snapshot = {
    reserve: mocks.addresses.RESERVE,
    BUYBACKAgent: mocks.addresses.BUYBACK_AGENT,
    treasury: mocks.addresses.TREASURY,
    COLLECTIONREWARDS: mocks.addresses.COLLECTION_REWARDS,
    COMMUNITYCENTER: mocks.addresses.COMMUNITY_CENTER,
    pendingReserve: 0n,
    pendingBUYBACK: 0n,
    pendingTreasury: 0n,
    pendingCOLLECTIONREWARDS: 0n,
    pendingCOMMUNITYCENTER: 0n,
  };
  mocks.fetchSnapshot.mockImplementation(async () => mocks.snapshot);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("LiveStats pool reads", () => {
  it("uses the existing distributor snapshot and preserves five native pools", async () => {
    render(<LiveStats {...props} />);
    await open();
    expect(allocation().querySelectorAll(".collection-stat-card")).toHaveLength(
      5,
    );
    expect(valueFor(allocation(), "Reserve")).toBe("1.0000 POL");
    expect(mocks.fetchSnapshot).toHaveBeenCalledTimes(1);
  });
  it("keeps failed native balances unknown and leaves successful pools visible", async () => {
    mocks.provider.getBalance.mockImplementation(async (address) => {
      if (address === mocks.addresses.RESERVE)
        throw Error("Unavailable balance");
      return unit;
    });
    render(<LiveStats {...props} />);
    await open();
    expect(valueFor(allocation(), "Reserve")).toBe("-");
    expect(valueFor(allocation(), "Treasury")).toBe("1.0000 POL");
    expect(
      screen.getByText("Some pool data is unavailable."),
    ).toBeInTheDocument();
  });
  it("preserves confirmed zero balances", async () => {
    mocks.provider.getBalance.mockResolvedValue(0n);
    render(<LiveStats {...props} />);
    await open();
    expect(valueFor(allocation(), "Reserve")).toBe("0.0000 POL");
  });
  it("preserves known balances but marks allocations unknown without a snapshot", async () => {
    mocks.fetchSnapshot.mockResolvedValue(null);
    render(<LiveStats {...props} />);
    await open();
    expect(valueFor(allocation(), "Reserve")).toBe("1.0000 POL");
    expect(within(allocation()).getAllByText("Alloc: -")).toHaveLength(5);
    expect(
      screen.getByText("Some pool data is unavailable."),
    ).toBeInTheDocument();
  });
  it("respects valid zero decimals for token and LP amounts", async () => {
    mocks.token.decimals.mockResolvedValue(0n);
    mocks.token.balanceOf.mockResolvedValue(2n);
    mocks.lp.decimals.mockResolvedValue(0n);
    mocks.lp.totalSupply.mockResolvedValue(10n);
    render(<LiveStats {...props} />);
    await open();
    const dialog = screen.getByRole("dialog", { name: "Tokenomics" });
    expect(
      valueFor(
        dialog.querySelector(".ls-tokenomics-modal__section--contracts"),
        "Reserve",
      ),
    ).toBe("2.0000 BIGGI");
    expect(valueFor(dialog, "TOTAL SUPPLY")).toBe("10.0000 LP");
  });
  it("loads and refreshes under StrictMode without duplicate snapshot reads", async () => {
    render(
      <React.StrictMode>
        <LiveStats {...props} />
      </React.StrictMode>,
    );
    await open();
    expect(mocks.fetchSnapshot).toHaveBeenCalledTimes(1);
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Refresh pool data" }),
      ),
    );
    expect(mocks.fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(valueFor(allocation(), "Reserve")).toBe("1.0000 POL");
  });
  it("shows an error instead of endless Loading after bootstrap fails and can recover manually", async () => {
    mocks.provider.getBlockNumber.mockRejectedValueOnce(Error("no runners?!"));
    render(<LiveStats {...props} />);
    await open();
    expect(screen.getByText("Pool data is unavailable.")).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog", { name: "Tokenomics" })).queryByText(
        "Loading",
      ),
    ).not.toBeInTheDocument();
    expect(mocks.reset).toHaveBeenCalledTimes(1);
    expect(mocks.mark).not.toHaveBeenCalled();
    expect(mocks.fetchSnapshot).not.toHaveBeenCalled();
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Refresh pool data" }),
      ),
    );
    expect(valueFor(allocation(), "Reserve")).toBe("1.0000 POL");
  });
  it("does not start downstream reads after closing during bootstrap", async () => {
    const pending = deferred();
    mocks.provider.getBlockNumber.mockReturnValue(pending.promise);
    render(<LiveStats {...props} />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Close pools" }));
    await act(async () => pending.resolve(123));
    expect(mocks.fetchSnapshot).not.toHaveBeenCalled();
  });
  it("ignores the earlier snapshot after closing and reopening", async () => {
    const pending = deferred();
    mocks.fetchSnapshot.mockReturnValueOnce(pending.promise);
    render(<LiveStats {...props} />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Close pools" }));
    await open();
    const before = allocation().textContent;
    await act(async () =>
      pending.resolve({ ...mocks.snapshot, pendingReserve: 99n * unit }),
    );
    expect(allocation().textContent).toBe(before);
    expect(mocks.provider.getBalance).toHaveBeenCalledTimes(5);
  });
  it("invalidates reads when unmounted", async () => {
    const pending = deferred();
    mocks.provider.getBlockNumber.mockReturnValue(pending.promise);
    const { unmount } = render(<LiveStats {...props} />);
    await open();
    unmount();
    await act(async () => pending.resolve(123));
    expect(mocks.fetchSnapshot).not.toHaveBeenCalled();
  });
  it("does not silently use zero decimals when token or LP metadata fails", async () => {
    mocks.token.decimals.mockRejectedValue(Error("Missing decimals"));
    mocks.lp.decimals.mockRejectedValue(Error("Missing decimals"));
    render(<LiveStats {...props} />);
    await open();
    const dialog = screen.getByRole("dialog", { name: "Tokenomics" });
    const tokens = dialog.querySelector(
      ".ls-tokenomics-modal__section--contracts",
    );
    expect(valueFor(tokens, "Reserve")).toBe("-");
    expect(valueFor(dialog, "TOTAL SUPPLY")).toBe("-");
  });
  it("keeps unavailable token rows in place", async () => {
    mocks.token.balanceOf.mockImplementation(async (address) => {
      if (address === mocks.addresses.RESERVE) throw Error("Unavailable");
      return 2n * unit;
    });
    render(<LiveStats {...props} />);
    await open();
    const tokens = screen
      .getByRole("dialog", { name: "Tokenomics" })
      .querySelector(".ls-tokenomics-modal__section--contracts");
    expect(valueFor(tokens, "Reserve")).toBe("-");
    expect(valueFor(tokens, "Treasury")).toBe("2.0000 BIGGI");
  });
  it("uses the same on-chain destination for native and BIGGI holdings", async () => {
    const changed = `0x${"f".repeat(40)}`;
    mocks.snapshot.reserve = changed;
    render(<LiveStats {...props} />);
    await open();
    expect(mocks.provider.getBalance).toHaveBeenCalledWith(changed);
    expect(mocks.token.balanceOf).toHaveBeenCalledWith(changed);
  });
  it("bounds an unresponsive read and keeps late results from overwriting the timeout", async () => {
    vi.useFakeTimers();
    const pending = deferred();
    mocks.provider.getBlockNumber.mockReturnValue(pending.promise);
    render(<LiveStats {...props} />);
    await open();
    await act(async () => vi.advanceTimersByTimeAsync(20_001));
    expect(screen.getByText("Pool data is unavailable.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh pool data" }),
    ).toBeEnabled();
    await act(async () => pending.resolve(123));
    expect(mocks.fetchSnapshot).not.toHaveBeenCalled();
  });
});
