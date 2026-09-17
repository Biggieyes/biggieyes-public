import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContractsProvider } from "../src/providers/ContractsProvider.jsx";
import { useContracts } from "../src/providers/ContractsContext.js";

const mocks = vi.hoisted(() => ({
  web3: { signer: null, provider: null },
  ro: { id: "mainnet-reader" },
  tokenRead: vi.fn(),
  tokenWrite: vi.fn(),
  chapterRead: vi.fn(),
  chapterWrite: vi.fn(),
}));
vi.mock("../src/providers/Web3Context.js", () => ({ useWeb3: () => mocks.web3 }));
vi.mock("@/shared/utils/contract", async (load) => ({
  ...(await load()),
  getROProvider: () => mocks.ro,
  getTokenRO: mocks.tokenRead,
  getToken: mocks.tokenWrite,
  getReadOnlyChapterMain: mocks.chapterRead,
  getChapterMain: mocks.chapterWrite,
}));

let current;
function Consumer() {
  current = useContracts();
  return null;
}
const panel = () => (
  <ContractsProvider>
    <Consumer />
  </ContractsProvider>
);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.web3 = { signer: null, provider: null };
  mocks.tokenRead.mockImplementation((provider) => ({
    kind: "read",
    provider,
  }));
  mocks.tokenWrite.mockResolvedValue({ kind: "write" });
  mocks.chapterRead.mockImplementation((chapter, provider) => ({
    chapter,
    provider,
  }));
  mocks.chapterWrite.mockImplementation((chapter, signer) => ({
    chapter,
    signer,
  }));
});
afterEach(cleanup);

describe("ContractsProvider stable factories", () => {
  it("keeps its context stable across unrelated renders without eagerly calling factories", () => {
    const view = render(panel());
    const before = current;
    view.rerender(panel());
    expect(current).toBe(before);
    expect(mocks.tokenRead).not.toHaveBeenCalled();
    expect(mocks.tokenWrite).not.toHaveBeenCalled();
  });
  it("uses the current signer after connection, account change and disconnection", async () => {
    const view = render(panel());
    await expect(current.chapterMainWrite(2)).resolves.toEqual({
      chapter: 2,
      provider: mocks.ro,
    });
    for (const signer of [{ id: "first" }, { id: "second" }]) {
      mocks.web3 = { ...mocks.web3, signer };
      view.rerender(panel());
      await expect(current.chapterMainWrite(2)).resolves.toEqual({
        chapter: 2,
        signer,
      });
    }
    mocks.web3 = { ...mocks.web3, signer: null };
    view.rerender(panel());
    await expect(current.chapterMainWrite(2)).resolves.toEqual({
      chapter: 2,
      provider: mocks.ro,
    });
    expect(mocks.chapterWrite).toHaveBeenCalledTimes(2);
  });
  it("preserves the existing read-only fallback after a write factory rejects", async () => {
    mocks.web3.signer = { id: "connected" };
    mocks.tokenWrite.mockRejectedValueOnce(Error("Signer unavailable"));
    render(panel());
    await act(async () => {
      await expect(current.tokenWrite()).resolves.toEqual({
        kind: "read",
        provider: mocks.ro,
      });
    });
    expect(mocks.tokenWrite).toHaveBeenCalledOnce();
    expect(mocks.tokenRead).toHaveBeenCalledWith(mocks.ro);
  });
});
