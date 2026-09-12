import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  nftAdminArguments,
  submitNftAdminAction,
} from "../src/shared/services/nftRewardsAdmin.js";
import NftRewardsAdmin from "../src/components/admin/NftRewardsAdmin.jsx";

const { contract, stats } = vi.hoisted(() => ({
  contract: {},
  stats: vi.fn(),
}));
vi.mock("ethers", async (original) => ({
  ...(await original()),
  Contract: vi.fn(function () {
    return contract;
  }),
}));
vi.mock("../src/shared/utils/contract", () => ({
  getROProvider: () => ({
    getNetwork: async () => ({ chainId: 137n }),
    getBlockNumber: async () => 123,
  }),
}));
vi.mock("../src/shared/services/nftRewardsService.js", () => ({
  default: vi.fn(function () {
    this.getAllStats = stats;
  }),
}));
const OWNER = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";
const TARGET = "0x3333333333333333333333333333333333333333";
const signer = {
  getAddress: async () => OWNER,
  provider: {
    getNetwork: async () => ({ chainId: 137n }),
    getBlock: async () => ({ timestamp: 2000 }),
  },
};
const submit = (extra = {}) =>
  submitNftAdminAction({
    address: TARGET,
    action: "createManualReward",
    values: { winner: OTHER, uri: "ipfs://one" },
    signer,
    walletAddress: OWNER,
    ...extra,
  });

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  for (const key of Object.keys(contract)) delete contract[key];
  contract.owner = vi.fn().mockResolvedValue(OWNER);
  contract.usedVrfRequestIds = vi.fn().mockResolvedValue(false);
  contract.createManualReward = vi
    .fn()
    .mockResolvedValue({
      hash: "0xabc",
      wait: async () => ({ status: 1, logs: [] }),
    });
  contract.createManualReward.estimateGas = vi.fn().mockResolvedValue(100n);
  stats.mockResolvedValue({
    owner: OWNER,
    vrfRouter: TARGET,
    mysteryRetryDelay: 900n,
  });
});

describe("NFT Rewards V2 owner transactions", () => {
  it("preserves commas inside URIs and deduplicates recipients", () => {
    expect(
      nftAdminArguments("createMysteryEvent", {
        uris: "data:application/json,{}",
        eligible: `${OWNER}\n${OWNER}`,
      }),
    ).toEqual([["data:application/json,{}"], [OWNER]]);
    expect(() =>
      nftAdminArguments("createMysteryEvent", {
        uris: "ipfs://one\nipfs://two",
        eligible: `${OWNER},${OWNER}`,
      }),
    ).toThrow("different eligible");
  });
  it.each([
    [
      "createManualReward",
      { winner: "0x0000000000000000000000000000000000000000", uri: "one" },
    ],
    ["createManualReward", { winner: OWNER, uri: " " }],
    ["requestMysteryRandom", { eventId: "1.5" }],
    ["retryMysteryRandom", { eventId: "0" }],
    ["setMysteryRetryDelay", { delay: String(1n << 64n) }],
    ["setMainContract", {}],
    ["setVrfRouter", {}],
  ])("rejects invalid or removed action %s", (action, values) => {
    expect(() => nftAdminArguments(action, values)).toThrow();
  });
  it("blocks wrong network, changed wallet and non-owner before sending", async () => {
    await expect(
      submit({
        signer: {
          ...signer,
          provider: { getNetwork: async () => ({ chainId: 80002 }) },
        },
      }),
    ).rejects.toThrow("Polygon mainnet");
    await expect(submit({ walletAddress: OTHER })).rejects.toThrow(
      "account changed",
    );
    contract.owner.mockResolvedValue(OTHER);
    await expect(submit()).rejects.toThrow("Only the NFT Rewards");
    expect(contract.createManualReward).not.toHaveBeenCalled();
  });
  it("does not bypass a failed estimate", async () => {
    contract.createManualReward.estimateGas.mockRejectedValue(
      new Error("reverted"),
    );
    await expect(submit()).rejects.toThrow("reverted");
    expect(contract.createManualReward).not.toHaveBeenCalled();
  });
  it("sends one transaction with gas buffer and requires success", async () => {
    await expect(submit()).resolves.toEqual({ hash: "0xabc" });
    expect(contract.createManualReward).toHaveBeenCalledWith(
      OTHER,
      "ipfs://one",
      { gasLimit: 120n },
    );
    contract.createManualReward.mockResolvedValue({
      wait: async () => ({ status: 0 }),
    });
    await expect(submit()).rejects.toThrow("not confirmed");
  });
  it("blocks pending draws and early retries", async () => {
    contract.events = vi
      .fn()
      .mockResolvedValue({
        kind: 3n,
        finished: false,
        randomnessRequested: true,
        vrfRequestId: 8n,
      });
    contract.vrfRequestedAt = vi.fn().mockResolvedValue(1900n);
    contract.mysteryRetryDelay = vi.fn().mockResolvedValue(900n);
    await expect(
      submit({ action: "requestMysteryRandom", values: { eventId: "1" } }),
    ).rejects.toThrow("already pending");
    await expect(
      submit({ action: "retryMysteryRandom", values: { eventId: "1" } }),
    ).rejects.toThrow("has not elapsed");
  });
  it("retries only an expired pending mystery request", async () => {
    contract.events = vi
      .fn()
      .mockResolvedValue({
        kind: 3n,
        finished: false,
        randomnessRequested: true,
        vrfRequestId: 8n,
      });
    contract.vrfRequestedAt = vi.fn().mockResolvedValue(1000n);
    contract.mysteryRetryDelay = vi.fn().mockResolvedValue(900n);
    contract.retryMysteryRandom = vi
      .fn()
      .mockResolvedValue({ hash: "0xabc", wait: async () => ({ status: 1 }) });
    contract.retryMysteryRandom.estimateGas = vi.fn().mockResolvedValue(100n);
    await submit({ action: "retryMysteryRandom", values: { eventId: "1" } });
    expect(contract.retryMysteryRandom).toHaveBeenCalledWith(1n, {
      gasLimit: 120n,
    });
  });
});

describe("NFT Rewards V2 admin panel", () => {
  it("shows V2 actions without obsolete main/router setters", async () => {
    render(
      <NftRewardsAdmin
        walletAddress={OWNER}
        chainId={137}
        getVerifiedSigner={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Assign reward" }).disabled,
      ).toBe(false),
    );
    expect(screen.queryByText("Set main")).toBeNull();
    expect(screen.queryByText("Set VRF")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Retry pending draw" }),
    ).toBeTruthy();
  });
  it("keeps owner actions disabled on read failure", async () => {
    stats.mockRejectedValue(new Error("RPC failed"));
    render(
      <NftRewardsAdmin
        walletAddress={OWNER}
        chainId={137}
        getVerifiedSigner={vi.fn()}
      />,
    );
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Assign reward" }).disabled).toBe(
      true,
    );
  });
  it("does not request signatures from a different wallet", async () => {
    const getVerifiedSigner = vi.fn();
    render(
      <NftRewardsAdmin
        walletAddress={OTHER}
        chainId={137}
        getVerifiedSigner={getVerifiedSigner}
      />,
    );
    await screen.findByText(/Read-only:/);
    fireEvent.click(screen.getByRole("button", { name: "Assign reward" }));
    expect(getVerifiedSigner).not.toHaveBeenCalled();
  });
});
