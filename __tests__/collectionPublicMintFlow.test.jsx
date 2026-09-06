import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  panel: null,
  contract: {},
  controller: {},
  provider: {},
  wallet: {},
  reader: {},
  stats: { fetchStats: vi.fn().mockResolvedValue(undefined) },
  readJson: vi.fn(),
}));

vi.mock("../src/providers/Web3Provider", () => ({
  useOptionalWeb3: () => mocks.wallet,
}));
vi.mock("../src/providers/ContractsProvider", () => ({
  useOptionalContracts: () => null,
}));
vi.mock("../src/hooks/useChapterSeriesReader", () => ({
  default: () => mocks.reader,
}));
vi.mock("../src/hooks/useStatsRewards", () => ({
  useStatsREWARDS: () => mocks.stats,
}));
vi.mock("../src/hooks/useIsMobile", () => ({ default: () => false }));
vi.mock("../src/hooks/useIsTouch", () => ({ default: () => false }));
vi.mock("../src/shared/utils/contract", () => ({
  ensurePolygon: vi.fn(),
  getChapterMain2: async () => mocks.contract,
  getReadOnlyChapterMain: () => mocks.contract,
  getReadOnlyChapterMain2: () => mocks.contract,
  getROProvider: () => mocks.provider,
}));
vi.mock("../src/shared/utils/ipfs", () => ({
  readJsonFromURI: (...args) => mocks.readJson(...args),
  resolveImageUrl: async () => "https://example.com/public.png",
}));
vi.mock("ethers", async (importOriginal) => ({
  ...(await importOriginal()),
  Contract: function () {
    return mocks.controller;
  },
}));
vi.mock(
  "../src/features/rewards/COLLECTION/CollectionBlocksGrid.Collection2Panel",
  () => ({
    default: (props) => {
      mocks.panel = props;
      return <div>Public mint</div>;
    },
  }),
);

import CollectionBlocksGrid from "../src/features/rewards/COLLECTION/CollectionBlocksGrid.jsx";

const hash = `0x${"a".repeat(64)}`;
const replacementHash = `0x${"b".repeat(64)}`;
const price = 100n * 10n ** 18n;
const info = (index) => ({
  minted: false,
  background: 1,
  blockIdx: Math.floor((index - 1) / 10) + 1,
  mainId: BigInt(index),
  ticketPrice: 0n,
  blockPrice: 0n,
  finalPrice: 0n,
});

beforeEach(() => {
  mocks.panel = null;
  mocks.provider = {
    getBalance: vi.fn().mockResolvedValue(price * 100n),
    getTransactionReceipt: vi.fn(),
  };
  mocks.wallet = {
    account: `0x${"1".repeat(40)}`,
    chainId: 137,
    signer: { provider: mocks.provider },
  };
  mocks.reader = {
    data: {
      chapters: [{ chapterId: "1", active: true, publicUnlocked: true }],
    },
    refresh: vi.fn().mockResolvedValue(undefined),
  };
  mocks.controller = { isPublicMintUnlocked: vi.fn().mockResolvedValue(true) };
  mocks.contract = {
    MAX_SUPPLY: vi.fn().mockResolvedValue(100n),
    paused: vi.fn().mockResolvedValue(false),
    metadataConsistency: vi.fn().mockResolvedValue([100n, true, true]),
    biggiMinted: vi.fn().mockResolvedValue(0n),
    nftInfo: vi.fn(async (index) => info(index)),
    blockBaseURIs: vi.fn().mockResolvedValue("ipfs://public/"),
    getCurrentBlockPrice: vi.fn(async (block) => BigInt(block) * price),
    getBlockMintCount: vi.fn().mockResolvedValue(0n),
    getEffectiveBlockPrice: vi.fn().mockResolvedValue(price),
    chapterController: vi.fn().mockResolvedValue(`0x${"2".repeat(40)}`),
    chapterId: vi.fn().mockResolvedValue(1n),
    mintPublic: vi.fn().mockResolvedValue({
      hash,
      wait: vi.fn().mockResolvedValue({ hash, status: 1 }),
    }),
  };
  mocks.readJson.mockImplementation(async (uri) => {
    const index = Number(uri.match(/Biggi_(\d+)_/)[1]);
    return {
      image: "ipfs://public-image",
      attributes: [
        { trait_type: "Collection Kind", value: "PUBLIC" },
        { trait_type: "Main ID", value: index },
        { trait_type: "Block Index", value: info(index).blockIdx },
        { trait_type: "Image Finalized", value: "Yes" },
      ],
    };
  });
});

async function openPublic() {
  render(
    <CollectionBlocksGrid
      activeCOLLECTION="COLLECTION2"
      blockPrices={Array(10).fill(999)}
      blockMintCounts={Array(10).fill(45)}
    />,
  );
  await waitFor(() => expect(mocks.panel?.selectedArtwork.valid).toBe(true));
  await waitFor(() =>
    expect(mocks.panel?.COLLECTIONTotals.maxSupply).toBe(100),
  );
}

describe("Public mint transaction flow", () => {
  it("uses Public reads instead of the dashboard's VRF counts and prices", async () => {
    await openPublic();
    expect(mocks.panel.blockEntries[0].minted).toBe(0);
    expect(mocks.panel.blockEntries[0].currentPrice).toBe(100);
  });

  it("submits only once and keeps the result bound to the minted NFT", async () => {
    let confirm;
    mocks.contract.mintPublic.mockResolvedValue({
      hash,
      wait: () =>
        new Promise((resolve) => {
          confirm = resolve;
        }),
    });
    await openPublic();
    let pending;
    act(() => {
      pending = mocks.panel.onMint(1);
      void mocks.panel.onMint(1);
    });
    await waitFor(() => expect(mocks.panel.mintState.status).toBe("pending"));
    act(() => mocks.panel.onTokenIdChange("2"));
    await waitFor(() => expect(mocks.panel.selectedNftInfo?.mainId).toBe("2"));
    await act(async () => {
      confirm({ hash, status: 1 });
      await pending;
    });
    expect(mocks.contract.mintPublic).toHaveBeenCalledTimes(1);
    expect(mocks.contract.mintPublic).toHaveBeenCalledWith(1, { value: price });
    expect(mocks.panel.mintState.index).toBe(1);
    expect(mocks.panel.selectedNftInfo.minted).toBe(false);
  });

  it("retains a submitted hash on RPC failure and checks it without minting again", async () => {
    mocks.contract.mintPublic.mockResolvedValue({
      hash,
      wait: vi.fn().mockRejectedValue(new Error("RPC timeout")),
    });
    await openPublic();
    await act(async () => {
      await mocks.panel.onMint(1);
    });
    expect(mocks.panel.mintState.status).toBe("unconfirmed");
    expect(mocks.panel.mintState.txHash).toBe(hash);
    mocks.provider.getTransactionReceipt.mockResolvedValue({ hash, status: 1 });
    await act(async () => {
      await mocks.panel.onMint(1);
    });
    expect(mocks.provider.getTransactionReceipt).toHaveBeenCalledWith(hash);
    expect(mocks.contract.mintPublic).toHaveBeenCalledTimes(1);
    expect(mocks.panel.mintState.status).toBe("success");
  });

  it("recognizes a wallet speed-up and links the confirmed replacement", async () => {
    mocks.contract.mintPublic.mockResolvedValue({
      hash,
      wait: vi.fn().mockRejectedValue({
        code: "TRANSACTION_REPLACED",
        cancelled: false,
        receipt: { hash: replacementHash, status: 1 },
        replacement: { hash: replacementHash },
      }),
    });
    await openPublic();
    await act(async () => {
      await mocks.panel.onMint(1);
    });
    expect(mocks.panel.mintState.status).toBe("success");
    expect(mocks.panel.mintState.txHash).toBe(replacementHash);
  });

  it("rechecks the chapter lock before requesting a transaction", async () => {
    await openPublic();
    mocks.controller.isPublicMintUnlocked.mockResolvedValue(false);
    await act(async () => {
      await mocks.panel.onMint(1);
    });
    expect(mocks.panel.mintState.status).toBe("error");
    expect(mocks.contract.mintPublic).not.toHaveBeenCalled();
  });
});
