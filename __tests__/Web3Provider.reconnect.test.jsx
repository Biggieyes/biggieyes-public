import * as React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

const mocks = vi.hoisted(() => {
  const address = "0x1234567890123456789012345678901234567890";
  const roProvider = { kind: "read-only" };
  const signer = {
    getAddress: vi.fn().mockResolvedValue(address),
  };
  const browserProviderInstance = {
    getSigner: vi.fn().mockResolvedValue(signer),
    getNetwork: vi.fn().mockResolvedValue({ chainId: 137n }),
  };

  return {
    address,
    roProvider,
    signer,
    browserProviderInstance,
    BrowserProvider: vi.fn().mockImplementation(function BrowserProviderMock() {
      return browserProviderInstance;
    }),
    clearInjectedProvider: vi.fn(),
    ensurePolygon: vi.fn().mockResolvedValue(undefined),
    getInjectedProvider: vi.fn().mockReturnValue(null),
    getROProvider: vi.fn().mockReturnValue(roProvider),
    hasInjectedProviderOverride: vi.fn().mockReturnValue(false),
    setInjectedProvider: vi.fn(),
    syncPolygonRpcIfNeeded: vi.fn().mockResolvedValue(undefined),
    getInjectedProviderCandidates: vi.fn().mockReturnValue([]),
    isMetaMaskExtensionMissingError: vi.fn().mockReturnValue(false),
    isLikelyMetaMaskSdkProvider: vi.fn().mockReturnValue(false),
    requestInjectedAccounts: vi.fn(async (provider) =>
      provider.request({ method: "eth_requestAccounts" }),
    ),
    startInjectedProviderDiscovery: vi.fn(),
    getWalletConnectMobileLinks: vi.fn().mockReturnValue(["metamask"]),
    shouldUseMetaMaskMobileFallback: vi.fn().mockReturnValue(false),
    clearWalletConnectSession: vi.fn().mockResolvedValue(false),
    connectWithWalletConnect: vi.fn(),
    restoreWalletConnectSession: vi.fn().mockResolvedValue(null),
  };
});

vi.mock("ethers", () => ({
  BrowserProvider: mocks.BrowserProvider,
}));

vi.mock("@/shared/utils/contract", () => ({
  ACTIVE_CHAIN: { chainId: 137, hex: "0x89" },
  clearInjectedProvider: mocks.clearInjectedProvider,
  ensurePolygon: mocks.ensurePolygon,
  getInjectedProvider: mocks.getInjectedProvider,
  getROProvider: mocks.getROProvider,
  hasInjectedProviderOverride: mocks.hasInjectedProviderOverride,
  setInjectedProvider: mocks.setInjectedProvider,
  syncPolygonRpcIfNeeded: mocks.syncPolygonRpcIfNeeded,
}));

vi.mock("@/shared/utils/injectedProviders", () => ({
  getInjectedProviderCandidates: mocks.getInjectedProviderCandidates,
  isMetaMaskExtensionMissingError: mocks.isMetaMaskExtensionMissingError,
  isLikelyMetaMaskSdkProvider: mocks.isLikelyMetaMaskSdkProvider,
  requestInjectedAccounts: mocks.requestInjectedAccounts,
  startInjectedProviderDiscovery: mocks.startInjectedProviderDiscovery,
}));

vi.mock("@/shared/utils/mobileWallet", () => ({
  getWalletConnectMobileLinks: mocks.getWalletConnectMobileLinks,
  shouldUseMetaMaskMobileFallback: mocks.shouldUseMetaMaskMobileFallback,
}));

vi.mock("@/wallet/wc.js", () => ({
  clearWalletConnectSession: mocks.clearWalletConnectSession,
  connectWithWalletConnect: mocks.connectWithWalletConnect,
  restoreWalletConnectSession: mocks.restoreWalletConnectSession,
}));

import { Web3Provider } from "../src/providers/Web3Provider.jsx";
import { useWeb3 } from "../src/providers/Web3Context.js";

function Probe() {
  const { account, chainId, connectMetaMask, provider } = useWeb3();

  return (
    <div>
      <div data-testid="account">{account || "empty"}</div>
      <div data-testid="provider-kind">{provider?.kind || "wallet"}</div>
      <div data-testid="chain-id">{chainId ?? "unknown"}</div>
      <button type="button" onClick={() => connectMetaMask()}>
        connect
      </button>
    </div>
  );
}

describe("Web3Provider reconnect policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.getInjectedProvider.mockReturnValue(null);
    mocks.getROProvider.mockReturnValue(mocks.roProvider);
    mocks.hasInjectedProviderOverride.mockReturnValue(false);
    mocks.getInjectedProviderCandidates.mockReturnValue([]);
    mocks.shouldUseMetaMaskMobileFallback.mockReturnValue(false);
    mocks.isMetaMaskExtensionMissingError.mockReturnValue(false);
    mocks.isLikelyMetaMaskSdkProvider.mockReturnValue(false);
    mocks.restoreWalletConnectSession.mockResolvedValue(null);
    mocks.BrowserProvider.mockImplementation(function BrowserProviderMock() {
      return mocks.browserProviderInstance;
    });
    mocks.browserProviderInstance.getSigner.mockResolvedValue(mocks.signer);
    mocks.browserProviderInstance.getNetwork.mockResolvedValue({
      chainId: 137n,
    });
  });

  it("does not restore a signer from an in-flight refresh after disconnect", async () => {
    let resolveSigner;
    const listeners = {};
    const injected = {
      isMetaMask: true,
      request: vi.fn(),
      on: vi.fn((event, cb) => {
        listeners[event] = cb;
      }),
      removeListener: vi.fn(),
    };
    mocks.hasInjectedProviderOverride.mockReturnValue(true);
    mocks.getInjectedProviderCandidates.mockReturnValue([injected]);
    mocks.browserProviderInstance.getSigner.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSigner = resolve;
        }),
    );
    const { unmount } = render(
      <Web3Provider>
        <Probe />
      </Web3Provider>,
    );
    await waitFor(() => expect(resolveSigner).toBeTypeOf("function"));
    await act(async () => listeners.disconnect());
    await act(async () => resolveSigner(mocks.signer));
    expect(screen.getByTestId("account")).toHaveTextContent("empty");
    expect(screen.getByTestId("provider-kind")).toHaveTextContent("read-only");
    unmount();
    expect(injected.removeListener).toHaveBeenCalledWith(
      "accountsChanged",
      listeners.accountsChanged,
    );
    expect(injected.removeListener).toHaveBeenCalledWith(
      "disconnect",
      listeners.disconnect,
    );
  });

  it("retains the latest account when the preceding refresh finishes late", async () => {
    let resolveOld;
    const listeners = {};
    const injected = {
      isMetaMask: true,
      request: vi.fn(),
      on: vi.fn((event, cb) => {
        listeners[event] = cb;
      }),
      removeListener: vi.fn(),
    };
    mocks.hasInjectedProviderOverride.mockReturnValue(true);
    mocks.getInjectedProviderCandidates.mockReturnValue([injected]);
    mocks.browserProviderInstance.getSigner.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    render(
      <Web3Provider>
        <Probe />
      </Web3Provider>,
    );
    await waitFor(() => expect(resolveOld).toBeTypeOf("function"));
    const latest = "0x9999999999999999999999999999999999999999";
    mocks.browserProviderInstance.getSigner.mockResolvedValue({
      getAddress: async () => latest,
    });
    await act(async () => listeners.accountsChanged([latest]));
    await act(async () => resolveOld(mocks.signer));
    expect(screen.getByTestId("account")).toHaveTextContent(latest);
  });

  it("does not silently reconnect an injected wallet on mount", async () => {
    const injected = {
      isMetaMask: true,
      request: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    mocks.getInjectedProviderCandidates.mockReturnValue([injected]);

    render(
      <Web3Provider>
        <Probe />
      </Web3Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("account")).toHaveTextContent("empty");
    });

    expect(screen.getByTestId("provider-kind")).toHaveTextContent("read-only");
    expect(mocks.getROProvider).toHaveBeenCalled();
    expect(mocks.BrowserProvider).not.toHaveBeenCalled();
    expect(mocks.browserProviderInstance.getSigner).not.toHaveBeenCalled();
  });

  it("does not restore the previous network after a newer chainChanged refresh", async () => {
    let resolveOldNetwork;
    const listeners = {};
    const injected = {
      isMetaMask: true,
      request: vi.fn(),
      on: vi.fn((event, handler) => {
        listeners[event] = handler;
      }),
      removeListener: vi.fn(),
    };
    mocks.hasInjectedProviderOverride.mockReturnValue(true);
    mocks.getInjectedProviderCandidates.mockReturnValue([injected]);
    mocks.browserProviderInstance.getNetwork.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOldNetwork = resolve;
        }),
    );
    render(
      <Web3Provider>
        <Probe />
      </Web3Provider>,
    );
    await waitFor(() => expect(resolveOldNetwork).toBeTypeOf("function"));
    mocks.browserProviderInstance.getNetwork.mockResolvedValue({
      chainId: 80002n,
    });
    await act(async () => listeners.chainChanged("0x13882"));
    expect(screen.getByTestId("chain-id")).toHaveTextContent("80002");
    await act(async () => resolveOldNetwork({ chainId: 137n }));
    expect(screen.getByTestId("chain-id")).toHaveTextContent("80002");
  });

  it("keeps the explicit MetaMask session when an older WalletConnect restore arrives late", async () => {
    let resolveRestore;
    const injected = {
      isMetaMask: true,
      request: vi.fn(async ({ method }) =>
        method === "eth_requestAccounts" ? [mocks.address] : "0x89",
      ),
      on: vi.fn(),
      removeListener: vi.fn(),
    };
    window.localStorage.setItem("biggi_walletconnect_resume_v1", "1");
    mocks.getInjectedProviderCandidates.mockReturnValue([injected]);
    mocks.restoreWalletConnectSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRestore = resolve;
        }),
    );
    render(
      <Web3Provider>
        <Probe />
      </Web3Provider>,
    );
    await waitFor(() => expect(resolveRestore).toBeTypeOf("function"));
    await userEvent.click(screen.getByRole("button", { name: /connect/i }));
    await waitFor(() =>
      expect(screen.getByTestId("account")).toHaveTextContent(mocks.address),
    );
    const oldProvider = { request: vi.fn() };
    await act(async () =>
      resolveRestore({
        provider: oldProvider,
        ethersProvider: { kind: "old-walletconnect" },
        signer: {
          getAddress: async () => "0x9999999999999999999999999999999999999999",
        },
        address: "0x9999999999999999999999999999999999999999",
        chainId: 137,
      }),
    );
    expect(screen.getByTestId("account")).toHaveTextContent(mocks.address);
    expect(mocks.setInjectedProvider).not.toHaveBeenCalledWith(oldProvider);
  });

  it("leaves one listener per wallet event during StrictMode replay and preserves other subscribers", async () => {
    const external = () => {};
    const listeners = { accountsChanged: new Set([external]) };
    const injected = {
      isMetaMask: true,
      request: vi.fn(),
      on: (event, handler) => (listeners[event] ??= new Set()).add(handler),
      removeListener: (event, handler) => listeners[event]?.delete(handler),
    };
    mocks.hasInjectedProviderOverride.mockReturnValue(true);
    mocks.getInjectedProviderCandidates.mockReturnValue([injected]);
    const { unmount } = render(
      <React.StrictMode>
        <Web3Provider>
          <Probe />
        </Web3Provider>
      </React.StrictMode>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("account")).toHaveTextContent(mocks.address),
    );
    expect(listeners.accountsChanged.size).toBe(2);
    expect(listeners.chainChanged.size).toBe(1);
    expect(listeners.disconnect.size).toBe(1);
    expect(listeners.session_delete.size).toBe(1);
    unmount();
    expect([...listeners.accountsChanged]).toEqual([external]);
    expect(listeners.chainChanged.size).toBe(0);
    expect(listeners.disconnect.size).toBe(0);
    expect(listeners.session_delete.size).toBe(0);
  });

  it("connects only after an explicit user action", async () => {
    const injected = {
      isMetaMask: true,
      request: vi.fn(async ({ method }) => {
        if (method === "eth_requestAccounts") return [mocks.address];
        if (method === "eth_chainId") return "0x89";
        return null;
      }),
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    mocks.getInjectedProviderCandidates.mockReturnValue([injected]);

    render(
      <Web3Provider>
        <Probe />
      </Web3Provider>,
    );

    await userEvent.click(screen.getByRole("button", { name: /connect/i }));

    await waitFor(() => {
      expect(screen.getByTestId("account")).toHaveTextContent(mocks.address);
    });

    expect(injected.request).toHaveBeenCalledWith({
      method: "eth_requestAccounts",
    });
    expect(mocks.requestInjectedAccounts).toHaveBeenCalledWith(injected, {
      forceSelection: true,
    });
    expect(mocks.setInjectedProvider).toHaveBeenCalledWith(injected);
    expect(mocks.syncPolygonRpcIfNeeded).not.toHaveBeenCalled();
    expect(mocks.BrowserProvider).toHaveBeenCalledTimes(1);
    expect(mocks.browserProviderInstance.getSigner).toHaveBeenCalled();
  });

  it("does not open WalletConnect from the MetaMask action", async () => {
    mocks.getInjectedProviderCandidates.mockReturnValue([]);
    mocks.shouldUseMetaMaskMobileFallback.mockReturnValue(true);

    render(
      <Web3Provider>
        <Probe />
      </Web3Provider>,
    );

    await userEvent.click(screen.getByRole("button", { name: /connect/i }));

    await waitFor(() => {
      expect(screen.getByTestId("account")).toHaveTextContent("empty");
    });

    expect(mocks.connectWithWalletConnect).not.toHaveBeenCalled();
    expect(mocks.setInjectedProvider).not.toHaveBeenCalled();
  });

  it("restores a persisted WalletConnect session on mount", async () => {
    const restoredProvider = {
      request: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    };
    const restoredEthersProvider = { kind: "walletconnect" };

    window.localStorage.setItem("biggi_walletconnect_resume_v1", "1");
    mocks.restoreWalletConnectSession.mockResolvedValue({
      provider: restoredProvider,
      ethersProvider: restoredEthersProvider,
      signer: mocks.signer,
      address: mocks.address,
      chainId: 137,
    });

    render(
      <Web3Provider>
        <Probe />
      </Web3Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("account")).toHaveTextContent(mocks.address);
    });

    expect(mocks.restoreWalletConnectSession).toHaveBeenCalledTimes(1);
    expect(mocks.setInjectedProvider).toHaveBeenCalledWith(restoredProvider);
    expect(screen.getByTestId("provider-kind")).toHaveTextContent(
      "walletconnect",
    );
  });

  it("treats an injected provider override as an explicit connection", async () => {
    const injected = {
      isMetaMask: true,
      request: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    mocks.hasInjectedProviderOverride.mockReturnValue(true);
    mocks.getInjectedProviderCandidates.mockReturnValue([injected]);

    render(
      <Web3Provider>
        <Probe />
      </Web3Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("account")).toHaveTextContent(mocks.address);
    });

    expect(mocks.BrowserProvider).toHaveBeenCalledTimes(1);
    expect(mocks.browserProviderInstance.getSigner).toHaveBeenCalled();
  });
});
