import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import USERPANEL from "../src/features/user/USERPANEL.jsx";

const mocks = vi.hoisted(() => ({ web3: {}, contracts: {}, community: {} }));
vi.mock("@/providers/Web3Context.js", () => ({ useWeb3: () => mocks.web3 }));
vi.mock("@/providers/ContractsContext.js", () => ({
  useContracts: () => mocks.contracts,
}));
vi.mock("@/hooks/useCommunityCenterUserSnapshot.js", () => ({
  default: () => mocks.community,
}));

const account = `0x${"1".repeat(40)}`;
const other = `0x${"2".repeat(40)}`;
let readProvider, token, collection, tickets;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const balances = (container) =>
  Array.from(
    container.querySelectorAll(".user-panel__balance-item strong"),
    (node) => node.textContent,
  );
const claimLabel = (container) =>
  container.querySelectorAll(".user-panel__key-metrics strong")[1].textContent;
const settled = () =>
  waitFor(() =>
    expect(screen.getByRole("button", { name: "Refresh data" })).toBeEnabled(),
  );

beforeEach(() => {
  readProvider = {
    getNetwork: vi.fn(async () => ({ chainId: 137n })),
    getBalance: vi.fn(async () => 2n * 10n ** 18n),
  };
  token = {
    balanceOf: vi.fn(async () => 3n * 10n ** 18n),
    decimals: vi.fn(async () => 18n),
  };
  collection = { balanceOf: vi.fn(async () => 4n) };
  tickets = { balanceOf: vi.fn(async () => 5n) };
  mocks.web3 = {
    account,
    chainId: 137,
    provider: readProvider,
    connectMetaMask: vi.fn(),
  };
  mocks.contracts = {
    _effectiveROProvider: vi.fn(() => readProvider),
    tokenRead: vi.fn(() => token),
    chapterCollectionsRead: vi.fn(() => [{ contract: collection }]),
    ticketHubRead: vi.fn(() => tickets),
  };
  mocks.community = {
    snapshot: { configured: true, paused: false, claimableEvents: 0 },
    loading: false,
    error: null,
    refresh: vi.fn(),
  };
});
afterEach(cleanup);

describe("User Panel read consistency", () => {
  it("refreshes claimable rewards with the rest of the panel", async () => {
    const onRefreshClaimable = vi.fn(async () => {
      throw new Error("RPC unavailable");
    });
    render(<USERPANEL onRefreshClaimable={onRefreshClaimable} />);
    await settled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
    await waitFor(() => expect(onRefreshClaimable).toHaveBeenCalledTimes(1));
    await settled();
    expect(mocks.community.refresh).toHaveBeenCalledTimes(1);
  });
  it("reads POL from the mainnet read provider, not a wallet on another chain", async () => {
    const wallet = { getBalance: vi.fn(async () => 99n * 10n ** 18n) };
    mocks.web3 = { ...mocks.web3, provider: wallet, chainId: 80002 };
    const { container } = render(<USERPANEL />);
    await settled();
    expect(balances(container)).toEqual(["2 POL", "3 BIGGI", "4", "5"]);
    expect(wallet.getBalance).not.toHaveBeenCalled();
    expect(readProvider.getNetwork).toHaveBeenCalled();
  });

  it("rejects a read provider on the wrong chain before any balance calls", async () => {
    readProvider.getNetwork.mockResolvedValue({ chainId: 80002n });
    const { container } = render(<USERPANEL />);
    await settled();
    expect(balances(container)).toEqual(["--", "--", "--", "--"]);
    expect(readProvider.getBalance).not.toHaveBeenCalled();
    expect(token.balanceOf).not.toHaveBeenCalled();
    expect(
      screen.getByText("Some wallet balances could not be refreshed."),
    ).toBeInTheDocument();
  });

  it("clears the old wallet immediately and ignores its delayed responses", async () => {
    const old = deferred(),
      next = deferred();
    readProvider.getBalance
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise);
    const { container, rerender } = render(<USERPANEL />);
    await waitFor(() =>
      expect(readProvider.getBalance).toHaveBeenCalledWith(account),
    );
    mocks.web3 = { ...mocks.web3, account: other };
    rerender(<USERPANEL />);
    expect(balances(container)).toEqual(["--", "--", "--", "--"]);
    await act(async () => next.resolve(7n * 10n ** 18n));
    await settled();
    await act(async () => old.resolve(99n * 10n ** 18n));
    expect(balances(container)[0]).toBe("7 POL");
  });

  it("does not retain successful balances while loading another account", async () => {
    const { container, rerender } = render(<USERPANEL />);
    await settled();
    const network = deferred();
    readProvider.getNetwork.mockReturnValue(network.promise);
    mocks.web3 = { ...mocks.web3, account: other };
    rerender(<USERPANEL />);
    expect(balances(container)).toEqual(["--", "--", "--", "--"]);
    await act(async () => network.resolve({ chainId: 137n }));
    await settled();
  });

  it("does not start contract reads after unmount during network validation", async () => {
    const network = deferred();
    readProvider.getNetwork.mockReturnValue(network.promise);
    const { unmount } = render(<USERPANEL />);
    unmount();
    await act(async () => network.resolve({ chainId: 137n }));
    expect(token.balanceOf).not.toHaveBeenCalled();
  });

  it("survives StrictMode cleanup and reads the active generation", async () => {
    const { container } = render(
      <React.StrictMode>
        <USERPANEL />
      </React.StrictMode>,
    );
    await settled();
    expect(balances(container)).toEqual(["2 POL", "3 BIGGI", "4", "5"]);
  });

  it("does not turn failed inventory reads into an empty wallet", async () => {
    collection.balanceOf.mockRejectedValue(new Error("RPC unavailable"));
    tickets.balanceOf.mockRejectedValue(new Error("RPC unavailable"));
    const { container } = render(<USERPANEL />);
    await settled();
    expect(balances(container)).toEqual(["2 POL", "3 BIGGI", "--", "--"]);
    expect(
      screen.queryByText("No NFTs detected yet. Mint a ticket to begin."),
    ).not.toBeInTheDocument();
  });

  it("preserves real zero balances", async () => {
    collection.balanceOf.mockResolvedValue(0n);
    tickets.balanceOf.mockResolvedValue(0n);
    const { container } = render(<USERPANEL claimable={0} onClaim={vi.fn()} />);
    await settled();
    expect(balances(container).slice(2)).toEqual(["0", "0"]);
    expect(claimLabel(container)).toBe("0 BIGGI");
    expect(
      screen.getByRole("button", { name: "Claim rewards" }),
    ).toBeDisabled();
  });

  it.each([null, undefined, "", "  ", "NaN", NaN, -1])(
    "keeps unknown or invalid claimable %s unavailable",
    async (claimable) => {
      const { container } = render(
        <USERPANEL
          claimable={claimable}
          myNFTs={[{ tokenId: "1" }]}
          onClaim={vi.fn()}
        />,
      );
      await settled();
      expect(claimLabel(container)).toBe("--");
      expect(
        screen.getByRole("button", { name: "Claim rewards" }),
      ).toBeDisabled();
    },
  );

  it("enables a valid positive claim without converting its display through Number", async () => {
    const { container } = render(
      <USERPANEL claimable="9007199254740993.25" onClaim={vi.fn()} />,
    );
    await settled();
    expect(claimLabel(container)).toBe("9,007,199,254,740,993.25 BIGGI");
    expect(screen.getByRole("button", { name: "Claim rewards" })).toBeEnabled();
  });

  it("hides inventory and claim props belonging to the previous parent wallet", async () => {
    mocks.web3 = { ...mocks.web3, account: other };
    tickets.balanceOf.mockRejectedValue(new Error("unavailable"));
    const { container } = render(
      <USERPANEL
        walletAddress={account}
        myNFTs={[{ tokenId: "12", isTicket: true }]}
        claimable="5"
        onClaim={vi.fn()}
        onRedeem={vi.fn()}
      />,
    );
    await settled();
    expect(claimLabel(container)).toBe("--");
    expect(
      screen.getByRole("button", { name: "Claim rewards" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Redeem ticket" }),
    ).toBeDisabled();
    expect(screen.queryByText("#12")).not.toBeInTheDocument();
  });

  it.each([null, undefined, -1, 1.5, 9007199254740992])(
    "does not accept malformed inventory balance %s",
    async (value) => {
      collection.balanceOf.mockResolvedValue(value);
      tickets.balanceOf.mockResolvedValue(value);
      const { container } = render(<USERPANEL />);
      await settled();
      expect(balances(container).slice(2)).toEqual(["--", "--"]);
    },
  );

  it("does not assume token decimals after a missing response", async () => {
    token.decimals.mockResolvedValue(null);
    const { container } = render(<USERPANEL />);
    await settled();
    expect(balances(container)[1]).toBe("--");
  });

  it("does not start an orphaned balance promise if the decimals method is missing", async () => {
    token.decimals = undefined;
    token.balanceOf.mockRejectedValue(new Error("RPC unavailable"));
    const { container } = render(<USERPANEL />);
    await settled();
    expect(balances(container)[1]).toBe("--");
    expect(token.balanceOf).not.toHaveBeenCalled();
  });

  it("handles a synchronous decimals failure and a rejected balance together", async () => {
    token.decimals.mockImplementation(() => {
      throw new Error("Invalid reader");
    });
    token.balanceOf.mockRejectedValue(new Error("RPC unavailable"));
    const { container } = render(<USERPANEL />);
    await settled();
    expect(balances(container)[1]).toBe("--");
  });

  it("accepts zero decimals as a real token value", async () => {
    token.decimals.mockResolvedValue(0n);
    token.balanceOf.mockResolvedValue(123n);
    const { container } = render(<USERPANEL />);
    await settled();
    expect(balances(container)[1]).toBe("123 BIGGI");
  });

  it("does not declare no community prize while the result is loading or missing", async () => {
    mocks.community = {
      ...mocks.community,
      loading: true,
      snapshot: { configured: true, claimableEvents: null },
    };
    const { rerender } = render(<USERPANEL />);
    expect(
      screen.queryByText("No community prize is claimable right now."),
    ).not.toBeInTheDocument();
    mocks.community = { ...mocks.community, loading: false };
    rerender(<USERPANEL />);
    await settled();
    expect(
      screen.getByText("Community data is temporarily unavailable."),
    ).toBeInTheDocument();
  });
});
