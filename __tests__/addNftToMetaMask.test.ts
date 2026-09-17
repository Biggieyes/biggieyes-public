import { afterEach, describe, expect, it, vi } from "vitest";
import { addNftToMetaMask } from "../src/lib/addNftToMetaMask";

const CONTRACT = "0x1111111111111111111111111111111111111111";
const ACCOUNT = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const params = {
  contractAddress: CONTRACT,
  tokenId: "1001",
  expectedAccount: ACCOUNT,
};
function installWallet(
  options: {
    chain?: string;
    account?: string;
    watch?: () => unknown;
    switchChain?: () => unknown;
  } = {},
) {
  let chain = options.chain || "0x89";
  const provider = {
    isMetaMask: true,
    request: vi.fn(async ({ method, params: payload }) => {
      if (method === "eth_chainId") return chain;
      if (method === "eth_accounts") return [options.account || ACCOUNT];
      if (method === "wallet_switchEthereumChain") {
        if (options.switchChain) return options.switchChain();
        chain = payload[0].chainId;
        return null;
      }
      if (method === "wallet_watchAsset")
        return options.watch ? options.watch() : true;
      throw new Error(`Unexpected wallet method: ${method}`);
    }),
  };
  vi.stubGlobal("ethereum", provider);
  return provider;
}
afterEach(() => vi.unstubAllGlobals());

describe("MetaMask NFT import", () => {
  it("uses the actual ERC721 token ID on Polygon without sending a transaction or approval", async () => {
    const provider = installWallet();
    expect(await addNftToMetaMask(params)).toBe(true);
    expect(provider.request).toHaveBeenLastCalledWith({
      method: "wallet_watchAsset",
      params: {
        type: "ERC721",
        options: { address: CONTRACT, tokenId: "1001" },
      },
    });
    expect(provider.request.mock.calls.map(([call]) => call.method)).toEqual([
      "eth_chainId",
      "eth_accounts",
      "eth_chainId",
      "wallet_watchAsset",
    ]);
  });

  it("switches from Amoy to Polygon mainnet before import", async () => {
    const provider = installWallet({ chain: "0x13882" });
    expect(await addNftToMetaMask(params)).toBe(true);
    expect(provider.request).toHaveBeenCalledWith({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x89" }],
    });
  });

  it("does not proceed if a switch reports success but remains on the wrong chain", async () => {
    const provider = installWallet({ chain: "0x1", switchChain: () => null });
    await expect(addNftToMetaMask(params)).rejects.toThrow("Wrong network");
    expect(
      provider.request.mock.calls.some(
        ([call]) => call.method === "wallet_watchAsset",
      ),
    ).toBe(false);
  });

  it.each(["watch", "switchChain"] as const)(
    "handles rejection of %s without reporting success",
    async (step) => {
      const provider = installWallet({
        chain: step === "switchChain" ? "0x1" : "0x89",
        [step]: () => {
          throw Object.assign(new Error("User rejected"), { code: 4001 });
        },
      });
      expect(await addNftToMetaMask(params)).toBe(false);
      if (step === "switchChain")
        expect(provider.request).toHaveBeenCalledTimes(2);
    },
  );

  it("selects MetaMask when another extension owns window.ethereum", async () => {
    const metamask = installWallet();
    const rabby = { isMetaMask: true, isRabby: true, request: vi.fn() };
    vi.stubGlobal("ethereum", { ...rabby, providers: [rabby, metamask] });
    expect(await addNftToMetaMask(params)).toBe(true);
    expect(rabby.request).not.toHaveBeenCalled();
    expect(metamask.request).toHaveBeenCalled();
  });

  it("does not send an import to a non-MetaMask wallet", async () => {
    const request = vi.fn();
    vi.stubGlobal("ethereum", { isCoinbaseWallet: true, request });
    await expect(addNftToMetaMask(params)).rejects.toThrow(
      "MetaMask provider not found",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("prevents importing into a different selected account", async () => {
    const provider = installWallet({ account: CONTRACT });
    await expect(addNftToMetaMask(params)).rejects.toMatchObject({
      code: "IMPORT_ACCOUNT_MISMATCH",
    });
    expect(
      provider.request.mock.calls.some(
        ([call]) => call.method === "wallet_watchAsset",
      ),
    ).toBe(false);
  });

  it("keeps uint256 token IDs exact", async () => {
    const provider = installWallet();
    const id = (2n ** 256n - 1n).toString();
    await addNftToMetaMask({ ...params, tokenId: id });
    expect(provider.request).toHaveBeenLastCalledWith({
      method: "wallet_watchAsset",
      params: {
        type: "ERC721",
        options: { address: CONTRACT, tokenId: id },
      },
    });
  });

  it.each([
    "",
    "-1",
    "1.5",
    "undefined",
    Number.MAX_SAFE_INTEGER + 1,
    (2n ** 256n).toString(),
  ])(
    "rejects invalid token ID %s before opening the wallet",
    async (tokenId) => {
      const provider = installWallet();
      await expect(addNftToMetaMask({ ...params, tokenId })).rejects.toThrow(
        "Invalid token ID",
      );
      expect(provider.request).not.toHaveBeenCalled();
    },
  );

  it("rejects a zero contract address before opening the wallet", async () => {
    const provider = installWallet();
    await expect(
      addNftToMetaMask({ ...params, contractAddress: `0x${"0".repeat(40)}` }),
    ).rejects.toThrow("Invalid contract address");
    expect(provider.request).not.toHaveBeenCalled();
  });

  it.each([false, null, "true", { result: true }])(
    "does not mistake %j for success",
    async (result) => {
      installWallet({ watch: () => result });
      expect(await addNftToMetaMask(params)).toBe(false);
    },
  );

  it("blocks concurrent imports across cards and releases the lock after failure", async () => {
    let reject;
    const pending = new Promise((_resolve, fail) => {
      reject = fail;
    });
    const watch = vi.fn().mockReturnValueOnce(pending).mockResolvedValue(true);
    installWallet({ watch });
    const first = addNftToMetaMask(params);
    const result = expect(first).rejects.toMatchObject({ code: 4200 });
    await vi.waitFor(() => expect(watch).toHaveBeenCalledTimes(1));
    await expect(
      addNftToMetaMask({ ...params, tokenId: "1002" }),
    ).rejects.toMatchObject({ code: -32002 });
    reject(Object.assign(new Error("Unsupported"), { code: 4200 }));
    await result;
    expect(await addNftToMetaMask(params)).toBe(true);
  });
});
