import fs from "node:fs";
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { parse } from "@babel/parser";
import { formatEther } from "ethers";
import { describe, expect, it, vi } from "vitest";
import { buildRewardClaimPayload } from "../src/shared/utils/assetIdentity.js";

const source = fs.readFileSync("src/app/AppCore.jsx", "utf8");
let callbackSource;
const callbacks = new Map();
const stateDeclarations = [];
function visit(node) {
  if (!node || typeof node !== "object") return;
  if (
    node.type === "VariableDeclarator" &&
    (["claimableContext", "myClaimable"].includes(node.id.name) ||
      node.id.elements?.[0]?.name === "claimableSnapshot")
  )
    stateDeclarations.push(`const ${source.slice(node.start, node.end)};`);
  if (
    node.type === "VariableDeclarator" &&
    node.init?.arguments?.[0]?.type === "ArrowFunctionExpression"
  ) {
    const fn = node.init.arguments[0];
    callbacks.set(node.id.name, source.slice(fn.start, fn.end));
  }
  if (
    node.type === "VariableDeclarator" &&
    node.id.name === "refreshClaimable"
  ) {
    const callback = node.init.arguments[0];
    callbackSource = source.slice(callback.start, callback.end);
  }
  Object.values(node).forEach((value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") visit(value);
  });
}
visit(parse(source, { sourceType: "module", plugins: ["jsx"] }));

const account = `0x${"1".repeat(40)}`;
const primary = `0x${"a".repeat(40)}`;
const secondary = `0x${"b".repeat(40)}`;
function fixture(assets = [{ tokenId: "1", contractAddress: primary }]) {
  const brl = {
    claimablePreview: vi.fn(async () => [2n, 5n * 10n ** 18n]),
    claimStatus: vi.fn(async () => [99n * 10n ** 18n]),
  };
  const scope = {
    claimableFetchRef: { current: 0 },
    walletAddress: account,
    walletAddressRef: { current: account },
    myNFTs: assets,
    maxSupply: 550,
    buildRewardClaimPayload,
    getReadOnlyLiquidityContract: vi.fn(async () => brl),
    resolveRewardCollectionScope: vi.fn(async () => ({
      primaryCollectionAddress: primary,
      allowedCollectionAddresses: [primary, secondary],
    })),
    toNumEth: (v) => (v == null ? null : Number(formatEther(v))),
    setMyClaimable: vi.fn(),
    claimableContext: { walletAddress: account, myNFTs: assets },
    setClaimableSnapshot: vi.fn(),
  };
  // Execute the production callback, not a reimplementation of its read logic.
  const refresh = new Function(
    ...Object.keys(scope),
    `return (${callbackSource});`,
  )(...Object.values(scope));
  return { brl, scope, refresh };
}

describe("AppCore token claim preview reads", () => {
  it.each(["wallet", "inventory"])(
    "hides a previously loaded claim immediately after changing %s",
    (changed) => {
      const useSnapshot = new Function(
        "React",
        "walletAddress",
        "myNFTs",
        `${stateDeclarations.join("\n")} return {myClaimable, setClaimableSnapshot, claimableContext};`,
      );
      const assets = [{ tokenId: "1", contractAddress: primary }];
      const { result, rerender } = renderHook(
        ({ wallet, items }) => useSnapshot(React, wallet, items),
        { initialProps: { wallet: account, items: assets } },
      );
      act(() =>
        result.current.setClaimableSnapshot({
          context: result.current.claimableContext,
          value: 5,
        }),
      );
      expect(result.current.myClaimable).toBe(5);
      rerender({
        wallet: changed === "wallet" ? secondary : account,
        items: changed === "inventory" ? [...assets] : assets,
      });
      expect(result.current.myClaimable).toBeNull();
    },
  );
  it("reads a valid legacy preview amount and preserves its numeric public interface", async () => {
    const f = fixture();
    expect(await f.refresh()).toBe(5);
    expect(f.scope.setClaimableSnapshot).toHaveBeenLastCalledWith({
      context: f.scope.claimableContext,
      value: 5,
    });
    expect(f.brl.claimablePreview).toHaveBeenCalledWith([1n]);
  });
  it("preserves a confirmed zero reward", async () => {
    const f = fixture();
    f.brl.claimablePreview.mockResolvedValue([0n, 0n]);
    expect(await f.refresh()).toBe(0);
  });
  it("returns unknown on RPC failure without substituting a different claim API", async () => {
    const f = fixture();
    f.brl.claimablePreview.mockRejectedValue(new Error("RPC unavailable"));
    expect(await f.refresh()).toBeNull();
    expect(f.brl.claimStatus).not.toHaveBeenCalled();
  });
  it.each([[7n], [7n, null], [7n, -1n]])(
    "rejects missing or invalid amount in preview %s",
    async (...preview) => {
      const f = fixture();
      f.brl.claimablePreview.mockResolvedValue(preview);
      expect(await f.refresh()).toBeNull();
      expect(f.brl.claimStatus).not.toHaveBeenCalled();
    },
  );
  it("does not show zero when no wallet is connected", async () => {
    const f = fixture();
    expect(await f.refresh("")).toBeNull();
    expect(f.scope.getReadOnlyLiquidityContract).not.toHaveBeenCalled();
  });
  it("does not infer zero from an inventory that may not have loaded", async () => {
    const f = fixture([]);
    expect(await f.refresh()).toBeNull();
  });
  it("excludes tickets without querying an NFT claim", async () => {
    const f = fixture([{ tokenId: "1", isTicket: true }]);
    expect(await f.refresh()).toBe(0);
    expect(f.brl.claimablePreview).not.toHaveBeenCalled();
  });
  it("uses collection addresses for overlapping IDs", async () => {
    const f = fixture([
      { tokenId: "1", contractAddress: primary },
      { tokenId: "1", contractAddress: secondary },
    ]);
    f.brl.claimablePreviewFor = vi.fn(async () => [2n, 8n * 10n ** 18n]);
    expect(await f.refresh()).toBe(8);
    expect(f.brl.claimablePreviewFor).toHaveBeenCalledWith(
      [primary, secondary],
      [1n, 1n],
    );
    expect(f.brl.claimablePreview).not.toHaveBeenCalled();
  });
  it("does not fall back to ambiguous bare IDs without collection-aware support", async () => {
    const f = fixture([{ tokenId: "1", contractAddress: secondary }]);
    expect(await f.refresh()).toBeNull();
    expect(f.brl.claimablePreview).not.toHaveBeenCalled();
    expect(f.brl.claimStatus).not.toHaveBeenCalled();
  });
  it("does not publish after the wallet changes during the read", async () => {
    const f = fixture();
    f.brl.claimablePreview.mockImplementation(async () => {
      f.scope.walletAddressRef.current = secondary;
      return [1n, 9n * 10n ** 18n];
    });
    await f.refresh();
    const published = f.scope.setClaimableSnapshot.mock.calls.map(
      ([snapshot]) => snapshot.value,
    );
    expect(published).not.toContain(9);
    expect(f.scope.setMyClaimable).not.toHaveBeenCalledWith(9);
  });
  it("ignores a request invalidated by cleanup or a newer refresh", async () => {
    const f = fixture();
    f.brl.claimablePreview.mockImplementation(async () => {
      f.scope.claimableFetchRef.current += 1;
      return [1n, 9n * 10n ** 18n];
    });
    await f.refresh();
    expect(
      f.scope.setClaimableSnapshot.mock.calls.map(([s]) => s.value),
    ).not.toContain(9);
    expect(f.scope.setMyClaimable).not.toHaveBeenCalledWith(9);
  });
  it.each(["resyncWalletAfterResume", "connectViaWalletConnect"])(
    "clears previous holdings on an account change through %s",
    async (name) => {
      const setMyNFTs = vi.fn();
      const fetchWalletAssets = vi.fn(async () => {
        expect(setMyNFTs).toHaveBeenCalledWith([]);
        return [];
      });
      const scope = {
        walletAddressRef: { current: account },
        walletConnectResumeAllowedRef: { current: false },
        getInjectedProvider: () => ({ request: async () => [secondary] }),
        connectWithWalletConnect: vi.fn(async () => ({
          address: secondary,
          provider: {},
        })),
        setWalletAddress: vi.fn(),
        setMyNFTs,
        setDynamicTraitsById: vi.fn(),
        setLastMinted: vi.fn(),
        restoreTopFirstForAddress: vi.fn(),
        attachEventListeners: vi.fn(),
        fetchStats: vi.fn(),
        fetchREWARDS: vi.fn(),
        fetchLastMinted: vi.fn(),
        refreshVRFPanel: vi.fn(),
        fetchWalletAssets,
        setInjectedProvider: vi.fn(),
        contractRef: { current: null },
        getReadOnlyContract: vi.fn(),
        startInfoGate: vi.fn(),
      };
      const run = new Function(
        ...Object.keys(scope),
        `return (${callbacks.get(name)});`,
      )(...Object.values(scope));
      await run();
      expect(fetchWalletAssets).toHaveBeenCalledWith(secondary);
      expect(scope.setDynamicTraitsById).toHaveBeenCalledWith({});
      expect(scope.walletAddressRef.current).toBe(secondary);
    },
  );
});
