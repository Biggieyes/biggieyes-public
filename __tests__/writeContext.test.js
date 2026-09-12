import { BrowserProvider, Contract } from "ethers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertWriteContext } from "../src/shared/utils/writeRetry.js";

const account = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";
const providers = [];
afterEach(() => {
  for (const provider of providers.splice(0)) provider.destroy();
});

async function wallet() {
  const state = { accounts: [account], chainId: "0x89", current: account };
  const injected = {
    request: vi.fn(async ({ method }) => {
      if (method === "eth_chainId") return state.chainId;
      if (method === "eth_accounts") return state.accounts;
      throw new Error(`Unexpected wallet request: ${method}`);
    }),
  };
  const provider = new BrowserProvider(injected, "any", { cacheTimeout: -1 });
  providers.push(provider);
  const signer = await provider.getSigner();
  const contract = new Contract(
    other,
    ["function mintTicketForChapter(uint256) payable"],
    signer,
  );
  return {
    state,
    injected,
    provider,
    check: () =>
      assertWriteContext({
        contract,
        account,
        getCurrentAccount: () => state.current,
        chainId: 137,
      }),
  };
}

describe("signing context with the installed ethers BrowserProvider", () => {
  it("accepts the actual Polygon mainnet signing account without requesting a signature", async () => {
    const f = await wallet();
    await expect(f.check()).resolves.toBeUndefined();
    expect(
      f.injected.request.mock.calls.every(([p]) =>
        ["eth_accounts", "eth_chainId"].includes(p.method),
      ),
    ).toBe(true);
  });

  it("serializes the explicit mainnet chain into the wallet request", async () => {
    const f = await wallet();
    expect(
      f.provider.getRpcTransaction({ chainId: 137, from: account, to: other }),
    ).toMatchObject({
      chainId: "0x89",
      from: account,
      to: other,
    });
    expect(
      f.injected.request.mock.calls.some(
        ([p]) => p.method === "eth_sendTransaction",
      ),
    ).toBe(false);
  });
  it("rejects an actual chain change even while getNetwork retains the old network", async () => {
    const f = await wallet();
    expect((await f.provider.getNetwork()).chainId).toBe(137n);
    f.state.chainId = "0x13882";
    await expect(f.check()).rejects.toThrow(/network/i);
  });
  it("does not trust a cached signer when the wallet account changed before the UI event", async () => {
    const f = await wallet();
    f.state.accounts = [other];
    await expect(f.check()).rejects.toThrow(/wallet|account/i);
  });
  it("rejects a disconnect without opening eth_requestAccounts again", async () => {
    const f = await wallet();
    f.state.accounts = [];
    await expect(f.check()).rejects.toThrow(/wallet|account/i);
    expect(
      f.injected.request.mock.calls.some(
        ([p]) => p.method === "eth_requestAccounts",
      ),
    ).toBe(false);
  });
  it("rejects a UI account change during the final network request", async () => {
    const f = await wallet();
    f.injected.request.mockImplementation(async ({ method }) => {
      if (method === "eth_accounts") return [account];
      if (method === "eth_chainId") {
        f.state.current = other;
        return "0x89";
      }
      throw new Error("Unexpected request");
    });
    await expect(f.check()).rejects.toThrow(/wallet/i);
  });
  it("fails closed when network verification is unavailable", async () => {
    const f = await wallet();
    f.injected.request.mockImplementation(async ({ method }) => {
      if (method === "eth_accounts") return [account];
      throw Object.assign(new Error("RPC unavailable"), { code: -32005 });
    });
    await expect(f.check()).rejects.toThrow();
  });
});
