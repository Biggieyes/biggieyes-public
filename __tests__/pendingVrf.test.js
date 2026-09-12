import { beforeEach, describe, expect, it, vi } from "vitest";
import { Interface } from "ethers";
import { CORE_CHAPTERS } from "../src/shared/utils/addresses.js";
import {
  clearPendingVrf,
  findVrfCompletion,
  loadPendingVrf,
  normalizePendingVrf,
  pendingVrfFromReceipt,
  resolvePendingVrf,
  savePendingVrf,
} from "../src/shared/utils/pendingVrf.js";

const account = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";
const hash = `0x${"a".repeat(64)}`;
const contextFor = (chapterId = 2) => ({
  chainId: 137,
  account,
  chapterId,
  collection: CORE_CHAPTERS.find((c) => c.chapterId === chapterId).main,
  requestId: "9123",
  ticketId: "3",
  startBlock: 123,
  txHash: hash,
});
const iface = new Interface([
  "event VRFRequested(address indexed user,uint256 requestId,uint256 ticketId)",
  "event PendingMintRetried(address indexed user,uint256 indexed oldRequestId,uint256 indexed newRequestId,uint256 ticketId)",
]);
const contractFor = (chapterId, request = 0n) => ({
  target: contextFor(chapterId).collection,
  interface: iface,
  pendingMintRequest: vi.fn().mockResolvedValue(request),
  pendingTicketId: vi.fn().mockResolvedValue(3n),
  filters: {
    VRFFulfillStarted: () => "start",
    NFTMinted: () => "mint",
    PendingMintEmergencyResolved: () => "emergency",
  },
});
beforeEach(() => window.localStorage.clear());

describe("chapter-scoped VRF reconciliation", () => {
  it("stores an observed block before reading a pending request for later log reconciliation", async () => {
    const provider = { getBlockNumber: vi.fn().mockResolvedValue(777) };
    const result = await resolvePendingVrf({
      account,
      provider,
      getContract: (id) => contractFor(id, 9123n),
    });
    expect(result.context.startBlock).toBe(777);
    expect(savePendingVrf(result.context).startBlock).toBe(777);
  });
  it.each([1, 2, 3, 4, 5])(
    "finds chapter %s after reload without defaulting to Originals",
    async (chapterId) => {
      const getContract = vi.fn((id) =>
        contractFor(id, id === chapterId ? 9123n : 0n),
      );
      const result = await resolvePendingVrf({ account, getContract });
      expect(result.context).toMatchObject({
        chainId: 137,
        account,
        chapterId,
        collection: contextFor(chapterId).collection,
        requestId: "9123",
        ticketId: "3",
      });
    },
  );

  it("persists only the canonical chain, collection and account", () => {
    const context = contextFor();
    savePendingVrf(context);
    expect(loadPendingVrf(account)).toEqual(context);
    expect(loadPendingVrf(other)).toBeNull();
    expect(
      normalizePendingVrf({ ...context, chainId: 80002 }, account),
    ).toBeNull();
    expect(
      normalizePendingVrf({ ...context, collection: other }, account),
    ).toBeNull();
    clearPendingVrf(account);
    expect(loadPendingVrf(account)).toBeNull();
  });

  it("retains a remembered request when pending is zero, without claiming completion", async () => {
    const preferred = contextFor(5);
    const getContract = vi.fn((id) => contractFor(id));
    const result = await resolvePendingVrf({ account, preferred, getContract });
    expect(result.context).toEqual(preferred);
    expect(getContract).toHaveBeenCalledOnce();
    expect(getContract).toHaveBeenCalledWith(5, undefined);
  });

  it("does not turn an RPC failure into no pending request", async () => {
    const contract = contractFor(2);
    contract.pendingMintRequest.mockRejectedValue(new Error("429"));
    await expect(
      resolvePendingVrf({
        account,
        preferred: contextFor(),
        getContract: () => contract,
      }),
    ).rejects.toThrow("429");
  });

  it("recovers the exact request from a receipt and detects an onchain revert", async () => {
    const preferred = { ...contextFor(), requestId: "" };
    const event = iface.encodeEventLog(iface.getEvent("VRFRequested"), [
      account,
      9123n,
      3n,
    ]);
    const provider = {
      getTransactionReceipt: vi.fn().mockResolvedValue({
        status: 1,
        blockNumber: 130,
        logs: [{ ...event, address: preferred.collection }],
      }),
    };
    const getContract = () => contractFor(2);
    const result = await resolvePendingVrf({
      account,
      preferred,
      provider,
      getContract,
    });
    expect(result.context.requestId).toBe("9123");
    expect(result.context.startBlock).toBe(130);
    provider.getTransactionReceipt.mockResolvedValue({ status: 0 });
    expect(
      (await resolvePendingVrf({ account, preferred, provider, getContract }))
        .reverted,
    ).toBe(true);
  });

  it("tracks the new request ID on an explicit retry", () => {
    const context = contextFor();
    const event = iface.encodeEventLog(iface.getEvent("PendingMintRetried"), [
      account,
      9123n,
      9999n,
      3n,
    ]);
    const next = pendingVrfFromReceipt(
      context,
      { blockNumber: 140, logs: [{ ...event, address: context.collection }] },
      contractFor(2),
    );
    expect(next).toMatchObject({
      requestId: "9999",
      ticketId: "3",
      startBlock: 140,
    });
  });

  it("requires the request, wallet and NFT mint in the same fulfillment transaction", async () => {
    const context = contextFor();
    const start = {
      args: { requestId: 9123n, minter: account },
      transactionHash: hash,
    };
    const mint = {
      args: { minter: account, tokenId: 77n },
      transactionHash: hash,
    };
    const logs = { start: [start], mint: [mint], emergency: [] };
    const query = vi.fn(async (_, filter) => logs[filter]);
    expect(await findVrfCompletion(context, contractFor(2), query, 150)).toBe(
      mint,
    );
    start.args.requestId = 3n; // A ticket ID is not a VRF request ID.
    expect(
      await findVrfCompletion(context, contractFor(2), query, 150),
    ).toBeNull();
    start.args.requestId = 9123n;
    start.args.minter = other;
    expect(
      await findVrfCompletion(context, contractFor(2), query, 150),
    ).toBeNull();
    start.args.minter = account;
    mint.transactionHash = `0x${"b".repeat(64)}`;
    expect(
      await findVrfCompletion(context, contractFor(2), query, 150),
    ).toBeNull();
    expect(
      await findVrfCompletion(context, contractFor(1), query, 150),
    ).toBeNull();
  });

  it("recognizes a matching emergency resolution but not one for another wallet", async () => {
    const context = contextFor();
    const mint = { args: { minter: account }, transactionHash: hash };
    const event = {
      args: { user: account, requestId: 9123n },
      transactionHash: hash,
    };
    const query = async (_, filter) =>
      filter === "mint" ? [mint] : filter === "emergency" ? [event] : [];
    expect(await findVrfCompletion(context, contractFor(2), query, 150)).toBe(
      mint,
    );
    event.args.user = other;
    expect(
      await findVrfCompletion(context, contractFor(2), query, 150),
    ).toBeNull();
  });
});
