import { vi } from "vitest";

const mocks = vi.hoisted(() => {
  const address = "0x1234567890123456789012345678901234567890";
  const signer = {
    getAddress: vi.fn().mockResolvedValue(address),
  };
  const browserProvider = {
    pollingInterval: 0,
    getSigner: vi.fn().mockResolvedValue(signer),
    getNetwork: vi.fn().mockResolvedValue({ chainId: 80002n }),
  };

  const staleProvider = {
    session: { topic: "stale-session" },
    chainId: 80002,
    enable: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    request: vi.fn(),
  };
  const freshProvider = {
    session: null,
    chainId: 80002,
    enable: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    request: vi.fn(async ({ method }) => {
      if (method === "eth_accounts") return [address];
      if (method === "eth_chainId") return "0x13882";
      return null;
    }),
  };

  return {
    address,
    signer,
    browserProvider,
    staleProvider,
    freshProvider,
    BrowserProvider: vi
      .fn()
      .mockImplementation(function BrowserProviderMock() {
        return browserProvider;
      }),
    init: vi
      .fn()
      .mockResolvedValueOnce(staleProvider)
      .mockResolvedValueOnce(freshProvider),
  };
});

vi.mock("ethers", () => ({
  BrowserProvider: mocks.BrowserProvider,
}));

vi.mock("@walletconnect/ethereum-provider", () => ({
  EthereumProvider: {
    init: mocks.init,
  },
}));

vi.mock("@/shared/utils/contract", () => ({
  AMOY: {
    chainId: 80002,
    hex: "0x13882",
    name: "Polygon Amoy",
    currency: { name: "POL", symbol: "POL", decimals: 18 },
    explorer: "https://amoy.polygonscan.com",
    rpcUrl: "https://rpc-amoy.example",
  },
  PUBLIC_AMOY_RPCS: ["https://rpc-amoy.example"],
  getPrimaryRpcUrl: vi.fn().mockReturnValue("https://rpc-amoy.example"),
  getWalletRpcUrls: vi.fn().mockReturnValue(["https://rpc-amoy.example"]),
}));

vi.mock("@/shared/utils/mobileWallet", () => ({
  getWalletConnectMobileLinks: vi.fn().mockReturnValue(["metamask"]),
}));

import { connectWithWalletConnect } from "../src/wallet/wc.js";

describe("connectWithWalletConnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_WC_PROJECT_ID", "test-project-id");
    mocks.BrowserProvider.mockImplementation(function BrowserProviderMock() {
      return mocks.browserProvider;
    });
    mocks.browserProvider.getSigner.mockResolvedValue(mocks.signer);
    mocks.browserProvider.getNetwork.mockResolvedValue({ chainId: 80002n });
    mocks.init
      .mockResolvedValueOnce(mocks.staleProvider)
      .mockResolvedValueOnce(mocks.freshProvider);
  });

  it("drops a stale WalletConnect session before reconnecting", async () => {
    const result = await connectWithWalletConnect({ forceNewSession: true });

    expect(mocks.init).toHaveBeenCalledTimes(2);
    expect(mocks.staleProvider.disconnect).toHaveBeenCalledTimes(1);
    expect(mocks.staleProvider.enable).not.toHaveBeenCalled();
    expect(mocks.freshProvider.connect).toHaveBeenCalledTimes(1);
    expect(result.address).toBe(mocks.address);
  });
});
