import fs from "node:fs";
import { parse } from "@babel/parser";
import { Interface } from "ethers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CORE_CHAPTERS } from "../src/shared/utils/addresses.js";
import * as writes from "../src/shared/utils/writeRetry.js";
import * as pendingVrf from "../src/shared/utils/pendingVrf.js";

const source = fs.readFileSync("src/app/AppCore.jsx", "utf8");
const callbacks = new Map();
const visit = (node) => {
  if (!node || typeof node !== "object") return;
  if (node.type === "VariableDeclarator" && node.init?.arguments?.[0]) {
    const callback = node.init.arguments[0];
    if (callback.type === "ArrowFunctionExpression") {
      callbacks.set(node.id.name, source.slice(callback.start, callback.end));
    }
  }
  Object.values(node).forEach((value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") visit(value);
  });
};
visit(parse(source, { sourceType: "module", plugins: ["jsx"] }));

// Execute the production callbacks, with only their external dependencies replaced.
// This is callback integration coverage, not a mounted AppCore or browser E2E test.
function callback(name, scope) {
  if (!callbacks.has(name)) throw new Error(`Missing callback ${name}`);
  return new Function(
    ...Object.keys(scope),
    `return (${callbacks.get(name)});`,
  )(...Object.values(scope));
}

const account = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";
const hash = `0x${"a".repeat(64)}`;
const replacementHash = `0x${"b".repeat(64)}`;
const iface = new Interface([
  "event VRFRequested(address indexed user,uint256 requestId,uint256 ticketId)",
  "event PendingMintRetried(address indexed user,uint256 indexed oldRequestId,uint256 indexed newRequestId,uint256 ticketId)",
]);

function fixture(chapterId = 2) {
  const chapter = CORE_CHAPTERS.find((c) => c.chapterId === chapterId);
  const state = { account, chainId: 137n };
  const provider = {
    getNetwork: vi.fn(async () => ({ chainId: state.chainId })),
    getBalance: vi.fn().mockResolvedValue(10n ** 20n),
    send: vi.fn(async (method) => {
      if (method === "eth_accounts") return [state.account];
      if (method === "eth_chainId") return `0x${state.chainId.toString(16)}`;
      throw new Error(`Unexpected signing RPC: ${method}`);
    }),
  };
  const context = {
    chainId: 137,
    account,
    chapterId,
    collection: chapter.main,
    ticketId: "3",
    requestId: "9123",
    txHash: hash,
    startBlock: 123,
  };
  const receipt = {
    status: 1,
    hash,
    blockNumber: 123,
    logs: [
      {
        address: chapter.main,
        ...iface.encodeEventLog(iface.getEvent("VRFRequested"), [
          account,
          9123n,
          3n,
        ]),
      },
    ],
  };
  const tx = { hash, wait: vi.fn().mockResolvedValue(receipt) };
  const read = {
    target: chapter.main,
    interface: iface,
    pendingMintRequest: vi.fn().mockResolvedValue(0n),
    pendingTicketId: vi.fn().mockResolvedValue(3n),
    claimablePreview: vi.fn().mockResolvedValue([1n, 10n ** 18n]),
  };
  const write = {
    target: chapter.main,
    runner: { provider, getAddress: vi.fn(async () => state.account) },
    mintTicketForChapter: vi.fn().mockResolvedValue(tx),
    redeemTicket: vi.fn().mockResolvedValue(tx),
    retryPendingMint: vi.fn().mockResolvedValue(tx),
    claim: vi.fn().mockResolvedValue(tx),
  };
  const scope = {
    ...writes,
    ...pendingVrf,
    ACTIVE_CHAIN: { chainId: 137 },
    walletAddress: account,
    walletAddressRef: { current: account },
    contractRef: { current: read },
    pendingVrfRef: { current: null },
    pendingTicketIdRef: { current: null },
    lastRedeemTicketIdRef: { current: null },
    mintDisabledReason: "",
    delegatedInflightMessage: "Delegated transaction pending",
    isRedeeming: false,
    VRFPending: false,
    ticketMinted: 10,
    maxTickets: 50,
    biggiMinted: 10,
    maxSupply: 500,
    pendingReferral: null,
    myNFTs: [{ tokenId: "3", isTicket: true }],
    acquireWriteTxLock: vi.fn().mockReturnValue(true),
    releaseWriteTxLock: vi.fn(),
    isDelegatedInflightActive: () => false,
    isDelegatedInflightLimitError: () => false,
    isRateLimitedRpcError: () => false,
    isUserRejectedAction: (error) => error?.code === 4001,
    showUserAlert: vi.fn(),
    clearTxStatus: vi.fn(),
    updateTxStatus: vi.fn(),
    ensurePolygon: vi.fn().mockResolvedValue(undefined),
    getReadOnlyContract: () => read,
    getReadOnlyChapterMain: () => read,
    getReadOnlyTicketHub: () => read,
    getProviderFor: () => provider,
    getContractCheckProvider: (p) => p,
    assertContractDeployed: vi.fn().mockResolvedValue(undefined),
    hasPendingAccountTransaction: vi.fn().mockResolvedValue(false),
    resolveTicketPriceWei: vi.fn().mockResolvedValue(1n),
    getTicketHub: vi.fn().mockResolvedValue(write),
    getChapterMain: vi.fn().mockResolvedValue(write),
    resolveActiveTicketChapterId: vi.fn().mockResolvedValue(chapterId),
    resolveRedeemableTicketForActiveChapter: vi
      .fn()
      .mockResolvedValue({ ticketId: 3n, chapterId }),
    getBlockNumberWithFallback: vi.fn().mockResolvedValue(123),
    buildFeeOverrides: vi.fn().mockResolvedValue({}),
    extractMintedTicketIdFromReceipt: vi.fn().mockReturnValue(3n),
    attemptMintedTicketReferralAttribution: vi.fn().mockResolvedValue(true),
    fetchStats: vi.fn().mockResolvedValue(undefined),
    fetchREWARDS: vi.fn().mockResolvedValue(undefined),
    fetchLastMinted: vi.fn().mockResolvedValue(undefined),
    fetchWalletAssets: vi.fn().mockResolvedValue(undefined),
    refreshVRFPanel: vi.fn().mockResolvedValue(undefined),
    scheduleRefreshVRF: vi.fn(),
    prettyError: (e) => e.message || e.code || "error",
    withTimeout: (p) => p,
    isMissingRevertDataError: () => false,
    resolveRetryPendingSupport: vi.fn().mockResolvedValue(true),
    resolveVrfMain: vi
      .fn()
      .mockResolvedValue({ contract: read, context, chapterId }),
    getReadOnlyLiquidityContract: () => read,
    resolveRewardCollectionScope: vi.fn().mockResolvedValue({}),
    buildRewardClaimPayload: () => ({
      tokenIds: [3n],
      shouldUseCollectionAware: false,
    }),
    getLiquidityContract: vi.fn().mockResolvedValue(write),
    refreshClaimable: vi.fn().mockResolvedValue(undefined),
    buildVrfRevealResult: vi.fn().mockReturnValue(null),
  };
  for (const name of [
    "setIsMinting",
    "setIsRedeeming",
    "setIsClaiming",
    "setRedeemMsg",
    "setRedeemError",
    "setVrfRevealResult",
    "setRedeemStartBlock",
    "setRedeemStartedAt",
    "setVRFPending",
    "setPendingTicketId",
    "setTopFirstId",
    "setMyNFTs",
  ])
    scope[name] = vi.fn();
  scope.rememberPendingVrf = callback("rememberPendingVrf", scope);
  return {
    scope,
    state,
    read,
    write,
    tx,
    receipt,
    context,
    run: (name) => callback(name, scope)(),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AppCore write lifecycle", () => {
  it.each(["mintTicket", "redeemTicket", "claimREWARDS", "retryPendingMint"])(
    "%s includes Polygon mainnet in the submitted transaction",
    async (name) => {
      const f = fixture();
      if (name === "retryPendingMint")
        f.read.pendingMintRequest.mockResolvedValue(9123n);
      await f.run(name);
      const send =
        name === "mintTicket"
          ? f.write.mintTicketForChapter
          : name === "claimREWARDS"
            ? f.write.claim
            : f.write[name];
      expect(send).toHaveBeenCalledOnce();
      expect(send.mock.calls[0].at(-1)).toMatchObject({ chainId: 137 });
      expect(f.scope.releaseWriteTxLock).toHaveBeenCalledOnce();
    },
  );

  it.each([null, { status: 0 }, { status: 1 }])(
    "does not claim a completed mint for an invalid receipt or cancelled replacement: %j",
    async (receipt) => {
      const f = fixture();
      if (receipt?.status === 1) {
        f.tx.wait.mockRejectedValue({
          code: "TRANSACTION_REPLACED",
          reason: "cancelled",
          cancelled: true,
          receipt,
        });
      } else {
        f.tx.wait.mockResolvedValue(receipt);
      }
      await f.run("mintTicket");
      expect(f.write.mintTicketForChapter).toHaveBeenCalledOnce();
      expect(
        f.scope.updateTxStatus.mock.calls.some(
          ([s]) => s.stage === "confirmed",
        ),
      ).toBe(false);
      expect(
        f.scope.showUserAlert.mock.calls.some(
          (args) => args[1] === "mint-success",
        ),
      ).toBe(false);
      expect(f.scope.releaseWriteTxLock).toHaveBeenCalledOnce();
    },
  );

  it.each(["mintTicket", "redeemTicket", "claimREWARDS", "retryPendingMint"])(
    "%s does not resend a wallet-rejected transaction",
    async (name) => {
      const f = fixture();
      if (name === "retryPendingMint")
        f.read.pendingMintRequest.mockResolvedValue(9123n);
      const send =
        name === "mintTicket"
          ? f.write.mintTicketForChapter
          : name === "claimREWARDS"
            ? f.write.claim
            : f.write[name];
      send.mockRejectedValue({ code: 4001, message: "User rejected" });
      await f.run(name);
      expect(send).toHaveBeenCalledOnce();
      expect(f.tx.wait).not.toHaveBeenCalled();
      expect(
        f.scope.updateTxStatus.mock.calls.some(
          ([s]) => s.stage === "confirmed",
        ),
      ).toBe(false);
      expect(f.scope.releaseWriteTxLock).toHaveBeenCalledOnce();
    },
  );

  it("accepts a repriced ticket mint and displays the confirmed replacement hash", async () => {
    const f = fixture();
    f.tx.wait.mockRejectedValue({
      code: "TRANSACTION_REPLACED",
      reason: "repriced",
      cancelled: false,
      receipt: { ...f.receipt, hash: replacementHash },
    });
    await f.run("mintTicket");
    expect(f.write.mintTicketForChapter).toHaveBeenCalledOnce();
    expect(f.scope.updateTxStatus).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "confirmed", hash: replacementHash }),
      9000,
    );
    expect(f.scope.showUserAlert).toHaveBeenCalledWith(
      "Ticket minted.",
      "mint-success",
      1200,
    );
    expect(f.scope.releaseWriteTxLock).toHaveBeenCalledOnce();
  });

  it.each(["mintTicket", "redeemTicket", "claimREWARDS", "retryPendingMint"])(
    "%s refuses an account change during fee preparation",
    async (name) => {
      const f = fixture();
      if (name === "retryPendingMint")
        f.read.pendingMintRequest.mockResolvedValue(9123n);
      f.scope.buildFeeOverrides.mockImplementation(async () => {
        f.state.account = other;
        f.scope.walletAddressRef.current = other;
        return {};
      });
      await f.run(name);
      for (const fn of [
        f.write.mintTicketForChapter,
        f.write.redeemTicket,
        f.write.claim,
        f.write.retryPendingMint,
      ])
        expect(fn).not.toHaveBeenCalled();
      expect(f.scope.releaseWriteTxLock).toHaveBeenCalledOnce();
    },
  );

  it.each(["mintTicket", "redeemTicket", "claimREWARDS", "retryPendingMint"])(
    "%s refuses a chain change during fee preparation",
    async (name) => {
      const f = fixture();
      if (name === "retryPendingMint")
        f.read.pendingMintRequest.mockResolvedValue(9123n);
      f.scope.buildFeeOverrides.mockImplementation(async () => {
        f.state.chainId = 80002n;
        return {};
      });
      await f.run(name);
      for (const fn of [
        f.write.mintTicketForChapter,
        f.write.redeemTicket,
        f.write.claim,
        f.write.retryPendingMint,
      ])
        expect(fn).not.toHaveBeenCalled();
      expect(f.scope.releaseWriteTxLock).toHaveBeenCalledOnce();
    },
  );

  it("does not request referral signing for another wallet after a mint confirms", async () => {
    const f = fixture();
    f.scope.pendingReferral = other;
    f.tx.wait.mockImplementation(async () => {
      f.scope.walletAddressRef.current = other;
      return f.receipt;
    });
    await f.run("mintTicket");
    expect(
      f.scope.attemptMintedTicketReferralAttribution,
    ).not.toHaveBeenCalled();
    expect(f.scope.releaseWriteTxLock).toHaveBeenCalledOnce();
  });

  it.each([1, 2, 3, 4, 5])(
    "persists chapter %s confirmation for its original wallet after disconnect",
    async (chapterId) => {
      const f = fixture(chapterId);
      f.tx.wait.mockImplementation(async () => {
        f.scope.walletAddressRef.current = "";
        f.scope.pendingVrfRef.current = null;
        return f.receipt;
      });
      await f.run("redeemTicket");
      expect(pendingVrf.loadPendingVrf(account)).toMatchObject(f.context);
      expect(pendingVrf.loadPendingVrf(other)).toBeNull();
      expect(f.scope.pendingVrfRef.current).toBeNull();
      expect(f.scope.setMyNFTs).not.toHaveBeenCalled();
      const getContract = vi.fn(() => f.read);
      const resumed = await pendingVrf.resolvePendingVrf({
        account,
        preferred: pendingVrf.loadPendingVrf(account),
        getContract,
      });
      expect(getContract).toHaveBeenCalledWith(chapterId, undefined);
      f.read.filters = {
        VRFFulfillStarted: () => "start",
        NFTMinted: () => "mint",
        PendingMintEmergencyResolved: () => "emergency",
      };
      const mint = {
        args: { minter: account, tokenId: 77n },
        transactionHash: replacementHash,
      };
      const logs = {
        start: [
          {
            args: { minter: account, requestId: 9123n },
            transactionHash: replacementHash,
          },
        ],
        mint: [mint],
        emergency: [],
      };
      const completion = await pendingVrf.findVrfCompletion(
        resumed.context,
        resumed.contract,
        async (_, filter) => logs[filter],
        150,
      );
      expect(completion).toBe(mint);
    },
  );

  it("does not label the burned ticket as the latest NFT while VRF is pending", async () => {
    const f = fixture();
    await f.run("redeemTicket");
    expect(f.scope.setTopFirstId).not.toHaveBeenCalled();
    expect(f.scope.setVRFPending).toHaveBeenCalledWith(true);
  });

  it("does not overwrite the new wallet's VRF state with an old wallet rejection", async () => {
    const f = fixture();
    const nextContext = { ...f.context, account: other, requestId: "9999" };
    f.write.redeemTicket.mockImplementation(async () => {
      f.scope.walletAddressRef.current = other;
      f.scope.pendingVrfRef.current = pendingVrf.savePendingVrf(nextContext);
      for (const name of [
        "setVRFPending",
        "setRedeemMsg",
        "setPendingTicketId",
      ])
        f.scope[name].mockClear();
      throw { code: 4001, message: "Old wallet rejected" };
    });
    await f.run("redeemTicket");
    expect(f.scope.setVRFPending).not.toHaveBeenCalled();
    expect(f.scope.setRedeemMsg).not.toHaveBeenCalled();
    expect(f.scope.setPendingTicketId).not.toHaveBeenCalled();
    expect(f.scope.pendingVrfRef.current).toEqual(nextContext);
    expect(f.scope.releaseWriteTxLock).toHaveBeenCalledOnce();
  });

  it("keeps a confirmed claim result without refreshing the previous wallet's claim panel", async () => {
    const f = fixture();
    f.tx.wait.mockImplementation(async () => {
      f.scope.walletAddressRef.current = other;
      return f.receipt;
    });
    expect(await f.run("claimREWARDS")).toMatchObject({
      status: "confirmed",
      hash,
    });
    expect(f.scope.refreshClaimable).not.toHaveBeenCalled();
    expect(f.scope.releaseWriteTxLock).toHaveBeenCalledOnce();
  });

  it("clears a reverted redeem only for its original wallet after an account switch", async () => {
    const f = fixture();
    const nextContext = { ...f.context, account: other, requestId: "9999" };
    f.tx.wait.mockImplementation(async () => {
      f.scope.walletAddressRef.current = other;
      f.scope.pendingVrfRef.current = pendingVrf.savePendingVrf(nextContext);
      return { ...f.receipt, status: 0 };
    });
    await f.run("redeemTicket");
    expect(pendingVrf.loadPendingVrf(account)).toBeNull();
    expect(pendingVrf.loadPendingVrf(other)).toEqual(nextContext);
    expect(f.scope.pendingVrfRef.current).toEqual(nextContext);
    expect(f.scope.releaseWriteTxLock).toHaveBeenCalledOnce();
  });

  it.each([2, 3, 4, 5])(
    "uses chapter %s for retry and restores the new request after repricing",
    async (chapterId) => {
      const f = fixture(chapterId);
      f.read.pendingMintRequest.mockResolvedValue(9123n);
      f.scope.pendingVrfRef.current = pendingVrf.savePendingVrf(f.context);
      f.tx.wait.mockRejectedValue({
        code: "TRANSACTION_REPLACED",
        reason: "repriced",
        cancelled: false,
        receipt: {
          ...f.receipt,
          hash: replacementHash,
          logs: [
            {
              address: f.context.collection,
              ...iface.encodeEventLog(iface.getEvent("PendingMintRetried"), [
                account,
                9123n,
                9999n,
                3n,
              ]),
            },
          ],
        },
      });
      await f.run("retryPendingMint");
      expect(f.scope.getChapterMain).toHaveBeenCalledWith(chapterId);
      expect(f.write.retryPendingMint).toHaveBeenCalledOnce();
      expect(pendingVrf.loadPendingVrf(account)).toMatchObject({
        chapterId,
        requestId: "9999",
        txHash: replacementHash,
      });
    },
  );
});
